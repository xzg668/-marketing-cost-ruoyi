import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  calcPercentChange,
  formatNumber,
  formatPercentChange,
  shortBatchId,
} from '../src/pages/financeBasePriceUtils.js'

/**
 * T22：finance-base 页改造 —— 组件静态契约 + 纯函数单测。
 *
 * 组件层用文本断言（项目 node --test 不带 JSDOM），
 * 辅助层（financeBasePriceUtils）走真实函数调用。
 */

// ============================ 组件静态契约 ============================
const FILE = path.resolve(
  import.meta.dirname,
  '../src/pages/PriceLinkedFinanceBasePage.vue'
)
const content = fs.readFileSync(FILE, 'utf-8')

describe('PriceLinkedFinanceBasePage.vue T22 契约', () => {
  it('导入 importInfluenceFactors（新端点，multipart）', () => {
    assert.match(
      content,
      /import\s*\{[^}]*importInfluenceFactors[^}]*\}\s*from\s*['"]\.\.\/api\/financeBasePrice['"]/
    )
  })

  it('不再客户端解析 Excel —— 移除 xlsx 依赖', () => {
    assert.ok(
      !/from\s*['"]xlsx['"]/.test(content) && !/import\(['"]xlsx['"]/.test(content),
      '应完全移除 xlsx 客户端解析'
    )
  })

  it('表格有三列：当期价 / 原价 / 涨跌幅', () => {
    assert.match(content, /label="当期价"/)
    assert.match(content, /label="原价"/)
    assert.match(content, /label="涨跌幅"/)
  })

  it('顶部按钮文案改为"导入 Excel"，带 loading', () => {
    assert.match(content, /导入\s*Excel/)
    assert.match(content, /:loading="importing"/)
  })

  it('导入成功提示包含 imported 行数 + 批次号', () => {
    assert.match(content, /\$\{imported\}[\s\S]{0,60}批次\s*\$\{shortBatchId\(batchId\)\}/)
  })

  it('导入前必须选价格月份（缺失给 warning）', () => {
    assert.match(content, /请先选择价格月份再导入/)
  })

  it('导入后自动定位到本次批次', () => {
    assert.match(content, /filters\.value\.batchId\s*=\s*batchId/)
  })

  it('批次历史下拉（客户端从结果集推导）', () => {
    assert.match(content, /v-model="filters\.batchId"/)
    assert.match(content, /availableBatches/)
  })

  it('编辑弹窗新增原价字段', () => {
    assert.match(content, /v-model="formModel\.priceOriginal"/)
  })
})

// ============================ calcPercentChange ============================
describe('calcPercentChange', () => {
  it('标准涨幅', () => {
    assert.ok(Math.abs(calcPercentChange(110, 100) - 0.1) < 1e-9)
  })

  it('标准跌幅', () => {
    assert.ok(Math.abs(calcPercentChange(90, 100) - -0.1) < 1e-9)
  })

  it('持平', () => {
    assert.equal(calcPercentChange(100, 100), 0)
  })

  it('原价 0 → null（避免除 0）', () => {
    assert.equal(calcPercentChange(100, 0), null)
  })

  it('任一侧缺失/非数字 → null', () => {
    assert.equal(calcPercentChange(null, 100), null)
    assert.equal(calcPercentChange(100, null), null)
    assert.equal(calcPercentChange('abc', 100), null)
    assert.equal(calcPercentChange(100, 'xx'), null)
    assert.equal(calcPercentChange(undefined, undefined), null)
  })

  it('接受字符串数字（后端 BigDecimal 通常序列化为字符串）', () => {
    assert.ok(Math.abs(calcPercentChange('120', '100') - 0.2) < 1e-9)
  })
})

// ============================ formatPercentChange ============================
describe('formatPercentChange', () => {
  it('null → "—"', () => {
    assert.equal(formatPercentChange(null), '—')
    assert.equal(formatPercentChange(undefined), '—')
  })

  it('正数带 + 号', () => {
    assert.equal(formatPercentChange(0.1), '+10.00%')
    assert.equal(formatPercentChange(0.12345), '+12.35%')
  })

  it('负数保留负号', () => {
    assert.equal(formatPercentChange(-0.05), '-5.00%')
  })

  it('0 不带符号', () => {
    assert.equal(formatPercentChange(0), '0.00%')
  })

  it('非有限数 → "—"', () => {
    assert.equal(formatPercentChange(Infinity), '—')
    assert.equal(formatPercentChange(NaN), '—')
  })
})

// ============================ shortBatchId ============================
describe('shortBatchId', () => {
  it('取 UUID 前 8 位', () => {
    assert.equal(shortBatchId('abcd1234-ef56-7890-abcd-ef1234567890'), 'abcd1234')
  })

  it('空/null → 空串', () => {
    assert.equal(shortBatchId(''), '')
    assert.equal(shortBatchId(null), '')
    assert.equal(shortBatchId(undefined), '')
  })

  it('短于 8 位原样返回', () => {
    assert.equal(shortBatchId('abc'), 'abc')
  })
})

// ============================ formatNumber ============================
describe('formatNumber', () => {
  it('数字千分位', () => {
    // 不同 ICU 数据下中文 locale 可能用不同分隔符；只断言包含 "1" 与 "234" 片段
    const s = formatNumber(1234567)
    assert.ok(s.startsWith('1') && s.includes('234'))
  })

  it('null/空 → "—"', () => {
    assert.equal(formatNumber(null), '—')
    assert.equal(formatNumber(''), '—')
    assert.equal(formatNumber(undefined), '—')
  })

  it('非数字字符串原样返回', () => {
    assert.equal(formatNumber('abc'), 'abc')
  })

  it('字符串数字能解析', () => {
    const s = formatNumber('99.5')
    assert.ok(s.startsWith('99'))
  })
})
