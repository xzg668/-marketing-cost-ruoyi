import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  debouncedCall,
  filterCatalog,
  flattenCatalog,
  sourceTagType,
} from '../src/components/formulaEditorUtils.js'

/**
 * T20：FormulaEditor 组件 + 纯辅助函数的契约 & 功能单测。
 *
 * 组件层（Vue 单文件）用静态内容断言（项目 node --test 不带 JSDOM），
 * 辅助层（formulaEditorUtils）走真实函数调用。
 */

// ============================ 组件静态契约 ============================
const FILE = path.resolve(import.meta.dirname, '../src/components/FormulaEditor.vue')
const content = fs.readFileSync(FILE, 'utf-8')

describe('FormulaEditor.vue 组件契约', () => {
  it('三个 Props：modelValue / materialCode / pricingMonth', () => {
    assert.match(content, /modelValue:\s*\{/)
    assert.match(content, /materialCode:\s*\{/)
    assert.match(content, /pricingMonth:\s*\{/)
  })

  it('emit update:modelValue', () => {
    assert.match(content, /defineEmits\(\[['"]update:modelValue['"]\]\)/)
  })

  it('挂载时调用 fetchCatalog() 缓存变量目录', () => {
    assert.match(content, /import\s*\{\s*fetchCatalog\s*\}\s*from\s*['"]\.\.\/api\/priceVariables['"]/)
    assert.match(content, /onMounted[\s\S]{0,200}fetchCatalog\(\)/)
  })

  it('导入 filterCatalog 纯函数做过滤', () => {
    // T21 起还会同时 import debouncedCall/sourceTagType，因此只校验 filterCatalog 名称在该 import 子句内
    assert.match(
      content,
      /import\s*\{[^}]*\bfilterCatalog\b[^}]*\}\s*from\s*['"]\.\/formulaEditorUtils['"]/
    )
  })

  it('使用 @ 作为补全触发符（lastIndexOf("@")）', () => {
    assert.match(content, /lastIndexOf\(['"]@['"]\)/)
  })

  it('选中补全项时把 `@query` 替换为 `[code]` 格式', () => {
    assert.match(content, /\[\$\{item\.code\}\]/)
  })

  it('保留原样：不在 onInput 里对中文变量做自动替换', () => {
    // 反向断言：没有对中文 range 的全局替换；仅靠 emit update:modelValue 透传
    assert.ok(!/\\u4e00-\\u9fa5/.test(content), '组件不应含中文字符 range 替换')
  })
})

// ============================ 辅助函数功能 ============================
describe('flattenCatalog', () => {
  it('三组变量都摊平且带 group 标签', () => {
    const list = flattenCatalog({
      financeFactors: [{ code: 'Cu', name: '电解铜', unit: '元/kg' }],
      partContexts: [{ code: 'blank_weight', name: '下料重量' }],
      formulaRefs: [{ code: 'Cu_excl', name: '不含税铜', formulaExpr: '[Cu]/1.13' }],
    })
    assert.equal(list.length, 3)
    assert.equal(list[0].group, 'finance')
    assert.equal(list[0].groupLabel, '财务因素')
    assert.equal(list[1].group, 'part')
    assert.equal(list[2].group, 'formula')
    assert.equal(list[2].extra.formulaExpr, '[Cu]/1.13')
  })

  it('null/undefined/非对象 → 空数组', () => {
    assert.deepEqual(flattenCatalog(null), [])
    assert.deepEqual(flattenCatalog(undefined), [])
    assert.deepEqual(flattenCatalog('oops'), [])
  })

  it('任一组缺失时仍能返回其余组', () => {
    const list = flattenCatalog({ financeFactors: [{ code: 'Cu', name: '铜' }] })
    assert.equal(list.length, 1)
    assert.equal(list[0].code, 'Cu')
  })
})

describe('filterCatalog 优先级/过滤', () => {
  const catalog = {
    financeFactors: [
      { code: 'Cu', name: '电解铜' },
      { code: 'Cu_plus', name: '宽铜' },
      { code: 'Zn', name: '电解锌' },
    ],
    partContexts: [{ code: 'blank_weight', name: '下料重量' }],
    formulaRefs: [{ code: 'Cu_excl', name: '不含税铜', formulaExpr: '' }],
  }

  it('空 query 返回所有条目（前 30）', () => {
    const list = filterCatalog(catalog, '')
    assert.equal(list.length, 5)
  })

  it('精确 code 匹配排在前面', () => {
    const list = filterCatalog(catalog, 'Cu')
    assert.equal(list[0].code, 'Cu')
  })

  it('前缀命中（code）', () => {
    const list = filterCatalog(catalog, 'cu_')
    const codes = list.map((i) => i.code)
    assert.ok(codes.includes('Cu_plus'))
    assert.ok(codes.includes('Cu_excl'))
  })

  it('name 子串命中（中文）', () => {
    const list = filterCatalog(catalog, '下料')
    assert.equal(list.length, 1)
    assert.equal(list[0].code, 'blank_weight')
  })

  it('无命中返回空数组', () => {
    assert.deepEqual(filterCatalog(catalog, 'xxxxxx'), [])
  })

  it('大小写不敏感', () => {
    const list = filterCatalog(catalog, 'CU')
    assert.ok(list.some((i) => i.code === 'Cu'))
  })
})

// ============================ T21：预览面板契约 ============================
describe('FormulaEditor.vue T21 预览面板契约', () => {
  it('导入 previewFormula API', () => {
    assert.match(
      content,
      /import\s*\{\s*previewFormula\s*\}\s*from\s*['"]\.\.\/api\/priceLinkedItems['"]/
    )
  })

  it('防抖常量 = 500ms', () => {
    assert.match(content, /PREVIEW_DEBOUNCE_MS\s*=\s*500/)
  })

  it('使用 debouncedCall 包装 runPreview', () => {
    assert.match(content, /debouncedCall\(\s*runPreview\s*,\s*PREVIEW_DEBOUNCE_MS\s*\)/)
  })

  it('监听 text / materialCode / pricingMonth 触发预览', () => {
    assert.match(content, /watch\(\s*\(\)\s*=>\s*\[[\s\S]*materialCode[\s\S]*pricingMonth/)
  })

  it('4 个预览标题：规范化表达式 / 变量赋值 / 计算结果 / 警告', () => {
    assert.match(content, /规范化表达式/)
    assert.match(content, /变量赋值/)
    assert.match(content, /计算结果/)
    assert.match(content, /警告/)
  })

  it('预览失败走 el-alert 红条，不阻塞 textarea', () => {
    assert.match(content, /type=['"]error['"]/)
    assert.match(content, /previewError/)
  })

  it('卸载时取消未触发的防抖任务', () => {
    assert.match(content, /onBeforeUnmount\([\s\S]*schedulePreview\.cancel\(\)/)
  })

  it('使用 sourceTagType 渲染变量来源 tag', () => {
    assert.match(content, /sourceTagType\(row\.source\)/)
  })
})

// ============================ debouncedCall 功能测试 ============================
describe('debouncedCall', () => {
  it('500ms 内多次调用仅在最后一次触发', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fn = mock.fn()
    const scheduled = debouncedCall(fn, 500)
    scheduled()
    scheduled()
    scheduled()
    t.mock.timers.tick(499)
    assert.equal(fn.mock.callCount(), 0, '未到延时前不应触发')
    t.mock.timers.tick(1)
    assert.equal(fn.mock.callCount(), 1, '500ms 到达后触发一次')
  })

  it('连续调用会重置计时器（滑动窗口）', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fn = mock.fn()
    const scheduled = debouncedCall(fn, 500)
    scheduled()
    t.mock.timers.tick(400)
    scheduled() // 重置 —— 再等 500ms
    t.mock.timers.tick(400)
    assert.equal(fn.mock.callCount(), 0, '被重置后仍未到点')
    t.mock.timers.tick(100)
    assert.equal(fn.mock.callCount(), 1)
  })

  it('cancel() 清除待触发任务', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fn = mock.fn()
    const scheduled = debouncedCall(fn, 500)
    scheduled()
    scheduled.cancel()
    t.mock.timers.tick(2000)
    assert.equal(fn.mock.callCount(), 0, 'cancel 后永远不应触发')
  })

  it('透传参数到 fn', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const fn = mock.fn()
    const scheduled = debouncedCall(fn, 100)
    scheduled('a', 1)
    t.mock.timers.tick(100)
    assert.deepEqual(fn.mock.calls[0].arguments, ['a', 1])
  })
})

// ============================ sourceTagType 映射 ============================
describe('sourceTagType', () => {
  it('五种已知来源映射', () => {
    assert.equal(sourceTagType('FINANCE_FACTOR'), 'success')
    assert.equal(sourceTagType('PART_CONTEXT'), '')
    assert.equal(sourceTagType('FORMULA_REF'), 'warning')
    assert.equal(sourceTagType('CONST'), 'info')
    assert.equal(sourceTagType('MISSING'), 'danger')
  })

  it('未知来源降级为 info', () => {
    assert.equal(sourceTagType('WHATEVER'), 'info')
    assert.equal(sourceTagType(undefined), 'info')
  })
})
