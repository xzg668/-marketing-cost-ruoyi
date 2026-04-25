import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T23：PriceLinkedFormulaPage.vue 三栏改造的静态契约断言。
 * node --test 不带 JSDOM，因此只做源码文本检查 —— 覆盖 DoD 列的关键点。
 */
const FILE = path.resolve(
  import.meta.dirname,
  '../src/pages/PriceLinkedFormulaPage.vue'
)
const content = fs.readFileSync(FILE, 'utf-8')

describe('PriceLinkedFormulaPage.vue T23 三栏契约', () => {
  it('导入 FormulaEditor 组件', () => {
    assert.match(
      content,
      /import\s+FormulaEditor\s+from\s*['"]\.\.\/components\/FormulaEditor\.vue['"]/
    )
  })

  it('模板使用 <FormulaEditor/> 替代 textarea', () => {
    assert.match(content, /<FormulaEditor\b/)
    // 原来的 type="textarea" 编辑 expr 的入口应移除
    assert.ok(
      !/v-model="formModel\.expr"[\s\S]{0,80}type="textarea"/.test(content),
      '表达式输入必须由 FormulaEditor 承担，不再用 textarea'
    )
  })

  it('FormulaEditor 绑定 modelValue / materialCode / pricingMonth', () => {
    assert.match(content, /v-model="formModel\.expr"/)
    assert.match(content, /:material-code="formModel\.materialCode"/)
    assert.match(content, /:pricing-month="filters\.pricingMonth"/)
  })

  it('采用 CSS Grid 三栏布局 class', () => {
    assert.match(content, /\.formula-layout\s*\{[\s\S]{0,160}grid-template-columns/)
    assert.match(content, /col-left/)
    assert.match(content, /col-mid/)
    assert.match(content, /col-right/)
  })

  it('已移除 el-dialog 编辑弹窗（改为中栏内联编辑）', () => {
    assert.ok(
      !/<el-dialog\b/.test(content),
      '三栏布局应取消 el-dialog，把编辑搬到中栏'
    )
  })

  it('保存后调用 fetchList 刷新列表（DoD：编辑 → 保存后列表刷新）', () => {
    // submitForm 函数体里应出现 fetchList()；用 multiline 允许任意长度
    assert.match(
      content,
      /const\s+submitForm\s*=\s*async[\s\S]*?fetchList\(\)/m
    )
  })

  it('右栏挂载变量目录：导入 fetchCatalog + filterCatalog', () => {
    assert.match(
      content,
      /import\s*\{\s*fetchCatalog\s*\}\s*from\s*['"]\.\.\/api\/priceVariables['"]/
    )
    assert.match(
      content,
      /import\s*\{[^}]*filterCatalog[^}]*\}\s*from\s*['"]\.\.\/components\/formulaEditorUtils['"]/
    )
  })

  it('右栏点击变量可回填到表达式末尾', () => {
    assert.match(content, /insertVariable\(/)
    assert.match(content, /\[\$\{item\.code\}\]/)
  })

  it('左栏点击行可切换到中栏编辑（openEdit + list-item--active 高亮）', () => {
    assert.match(content, /list-item--active/)
    assert.match(content, /@click="openEdit\(row\)"/)
  })
})
