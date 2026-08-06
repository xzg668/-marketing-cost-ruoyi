import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/pages/PriceLinkedResultPage.vue'),
  'utf-8',
)
const API = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/api/priceLinkedItems.js'),
  'utf-8',
)
const ROUTER = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/router/index.js'),
  'utf-8',
)

describe('PLI2-11 原联动价页面兼容', () => {
  it('标准模板继续使用原确认导入端点', () => {
    assert.match(API, /request\(['"]\/api\/v1\/price-linked\/items\/import-excel['"]/)
    assert.match(PAGE, /\bimportLinkedItemsExcel\b/)
    assert.match(PAGE, /标准模板/)
  })

  it('原增删改、公式、Trace 和变量绑定操作继续保留', () => {
    for (const text of ['编辑', '公式', '查看 Trace', '变量绑定', '删除']) {
      assert.match(PAGE, new RegExp(text))
    }
    for (const api of [
      'createLinkedItem',
      'updateLinkedItem',
      'deleteLinkedItem',
      'fetchTrace',
    ]) {
      assert.match(PAGE, new RegExp(`\\b${api}\\b`))
    }
  })

  it('PLI2-11 没有新增菜单或独立路由', () => {
    assert.doesNotMatch(ROUTER, /type2-import|import-basis/)
    assert.match(PAGE, /<PriceLinkedImportBasisDrawer/)
  })

  it('旧标准导入参数继续保留，新哈希参数仅在存在时追加', () => {
    for (const field of [
      'file',
      'pricingMonth',
      'businessUnitType',
      'overwriteManual',
      'formulaEffectiveDate',
      'factorPriceConflictStrategy',
    ]) {
      assert.match(API, new RegExp(`append\\(['"]${field}['"]`))
    }
    assert.match(API, /if\s*\(options\.previewFileSha256\)/)
  })
})
