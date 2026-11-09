import assert from 'node:assert/strict'
import { test } from 'node:test'
import { utils } from 'xlsx'
import { findSupplierRatioSheets } from '../src/utils/supplierSupplyRatioWorkbook.js'

function book(sheets) {
  const workbook = utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), name)
  return workbook
}
const shellHeaders = ['组织', '来源', '供应商名称', '供应商代码', '采购分类', '物料名称', '物料代码', '规格型号', '所属事业部', '供货比例']

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
