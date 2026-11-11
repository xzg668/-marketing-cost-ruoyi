import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { compositionPaths, compositionSummary, compositionWorkbook, visibleCompositionColumns } from '../src/utils/costAmountComposition.js'

function view() {
  return { versionId: 101, versionNo: 'V4', costRunNo: 'SAVED-101', productCode: '1145900000611', pricingMonth: '2026-11',
    costCode: 'AUX_0212', costName: '工量夹切工具', amount: '0.232151', baseAmount: '0.221096', rate: '1.05', referenceAmount: '0.232151', difference: '0.000000',
    composition: { origin: 'SAVED', formula: '采用基数×上浮系数；路径已含用量', sourceAmount: '0.221096', excludedAmount: '0',
      sources: [{ table: 'cms_product_subject_cost_raw', rowIds: '[57853080]', parentCode: '1145900000611', period: '2026-02', subjectCode: '0212', amountYuan: '0.221096' }],
      rows: [{ sourceId: '57853080', period: '2026-02', parentCode: '1145900000611', subjectCode: '0212', originalCent: '22.109600', amountYuan: '0.221096',
        path: '1145900000611(×1)→TOOL(×1)→0212(自身)(1.773);1145900000611(×1)→BASE(×1)→0212(自身)(20.3366)' }] } }
}
test('download is built from the displayed version, including raw rows, formula and exact codes', () => {
  const data = view(), book = compositionWorkbook(data)
  const roundtrip = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  assert.deepEqual(roundtrip.SheetNames, ['金额及计算方法', '来源明细', '采用来源', '路径分项'])
  const summary = XLSX.utils.sheet_to_json(roundtrip.Sheets['金额及计算方法'], { header: 1 })
  assert.ok(summary.some(row => row[0] === '保存金额（元）' && row[1] === '0.232151'))
  assert.ok(summary.some(row => row[0] === '计算方法' && row[1].includes('上浮系数')))
  const rows = XLSX.utils.sheet_to_json(roundtrip.Sheets['来源明细'])
  assert.equal(rows[0]['科目代码'], '0212'); assert.equal(rows[0]['明细金额（元）'], 0.221096)
  assert.equal(rows[0]['来源记录ID'], '57853080')
  assert.equal(XLSX.utils.sheet_to_json(roundtrip.Sheets['路径分项']).length, 2)
})
test('path conversion keeps all decimal digits and never repeats the path quantity', () => {
  const data = view()
  data.composition.rows[0].path = 'P(×2)→0210(自身)(2.45990815);P(×1)→0210(自身)(-0.00000001);P(×0)→0210(自身)(0)'
  assert.deepEqual(compositionPaths(data).map(row => row.amountYuan), ['0.0245990815', '-0.0000000001', '0.00'])
})
test('surface exclusion paths are labelled and the original amount stays visible', () => {
  const data = view(), path = 'P(×1)→BASE(×1)→0202(自身)(151.7485)'
  data.composition.note = `已剔除烧结基座；CMS #57853080：${path}`
  data.composition.rows[0].path = path
  assert.equal(compositionPaths(data)[0].treatment, '已剔除：烧结基座表面处理')
})
test('old versions export the current-reference label, saved value and reconciliation difference', () => {
  const data = view(); data.composition.origin = 'CURRENT_REFERENCE'; data.referenceAmount = '0.315000'; data.difference = '0.082849'
  const summary = new Map(compositionSummary(data))
  assert.match(summary.get('资料口径'), /旧版本未保存/)
  assert.equal(summary.get('保存金额（元）'), '0.232151'); assert.equal(summary.get('核对金额减保存金额（元）'), '0.082849')
})
test('zero values, long identifiers and formula-like CMS text retain literal values in Excel', () => {
  const data = view(); Object.assign(data.composition.rows[0], { sourceId: '9007199254740993123', amountYuan: '0.000000', parentName: '=1+1' })
  const book = compositionWorkbook(data), sheet = book.Sheets['来源明细']
  const rows = XLSX.utils.sheet_to_json(sheet)
  assert.equal(rows[0]['来源记录ID'], '9007199254740993123'); assert.equal(rows[0]['明细金额（元）'], 0)
  assert.equal(rows[0]['父件名称'], '=1+1')
  assert.ok(visibleCompositionColumns(data).some(column => column.key === 'amountYuan'))
  assert.ok(Object.values(sheet).every(cell => !cell?.f))
})
