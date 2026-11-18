import assert from 'node:assert/strict'
import { test } from 'node:test'
import { utils, read, write } from 'xlsx'
import { findSupplierRatioSheets } from '../src/utils/supplierSupplyRatioWorkbook.js'
import { workbookDefinitions } from '../src/utils/workbookCatalog.js'
import { createWorkbook } from '../src/utils/workbookTransfer.js'

function book(sheets) {
  const workbook = utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), name)
  return workbook
}
const shellHeaders = ['组织', '来源', '供应商名称', '供应商代码', '采购分类', '物料名称', '物料代码', '规格型号', '所属事业部', '供货比例']

test('统一填写模板与列表导出使用相同表头，说明页不会误识别为数据页', () => {
  const definition = workbookDefinitions.supplier
  const row = { materialCode:'000123',materialName:'物料',specification:'规格',specModel:'型号',supplierCode:'S001',supplierName:'供应商',supplyRatio:0 }
  for (const template of [true, false]) {
    const workbook = read(write(createWorkbook({ utils }, definition, [row], template), { type:'buffer',bookType:'xlsx' }), { type:'buffer' })
    assert.deepEqual(findSupplierRatioSheets(workbook), ['供货比率'])
    const sheet = workbook.Sheets.供货比率
    assert.deepEqual(utils.sheet_to_json(sheet,{header:1})[0], ['物料代码','物料名称','规格','型号','单位','物料形态属性','供应商代码','供应商名称','供货比例','说明','取价规则'])
    if (!template) {
      assert.equal(sheet.A2.v,'000123');assert.equal(sheet.C2.v,'规格');assert.equal(sheet.D2.v,'型号')
      assert.equal(sheet.G2.v,'S001');assert.equal(sheet.H2.v,'供应商');assert.equal(sheet.I2.v,0)
    }
  }
})

test('外壳格式按表头识别，工作表名不限，额外列不影响', () => {
  assert.deepEqual(findSupplierRatioSheets(book({ 外壳: [shellHeaders, [210, '供管处', '甲', 'S1', '部品联动', '外壳', 721300148, '规格', '四通阀', .2]] })), ['外壳'])
})
test('多张符合表头的任意命名表均供用户选择，名称相似的说明表不入选', () => {
  assert.deepEqual(findSupplierRatioSheets(book({ 供货比例说明: [['备注']], 外壳: [shellHeaders], Sheet1: [shellHeaders] })), ['外壳', 'Sheet1'])
})
test('必需表头缺失不得作为候选，支持既有别名、星号和前置标题', () => {
  assert.deepEqual(findSupplierRatioSheets(book({ 供货比例: [['物料代码', '物料名称', '供应商']], 数据: [['采购记录'], [], [' 料号* ', '品名', '供应商名称', '供货比率']] })), ['数据'])
})
test('只识别前21行内的完整表头，与后端范围一致', () => {
  assert.deepEqual(findSupplierRatioSheets(book({ 第21行: [...Array.from({ length: 20 }, () => ['说明']), shellHeaders], 第22行: [...Array.from({ length: 21 }, () => ['说明']), shellHeaders] })), ['第21行'])
})
