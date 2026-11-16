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

test('packaging export retains child price, usage, both denominators and the actual coefficient', () => {
  const data = view(); data.costCode = 'OTHER_EXP_PACKAGE';data.costName = '包装费用'
  data.composition.rows = [
    { kind: 'PACKAGE_COMPONENT', parentCode: 'PACK', materialCode: '0001', unitPrice: '12', quantity: '2', parentBaseQty: '100', childBaseQty: '10', packageQuantity: '3', amountYuan: '0.72000000', path: '/TOP/PACK/0001/', calculation: '12 × 2 ÷ 100 × 3 = 0.72' },
    { kind: 'PACKAGE_TOTAL', baseAmount: '0.84', coefficient: '1.07', amountYuan: '0.898800', coefficientBasis: '本次保存的包装系数' },
  ]
  assert.deepEqual(compositionPaths(data), [])
  const book = compositionWorkbook(data), rows = XLSX.utils.sheet_to_json(book.Sheets['来源明细'])
  assert.equal(rows[0]['部品料号'], '0001');assert.equal(rows[0]['采用单价'], 12)
  assert.equal(rows[0]['包装母件底数'], 100);assert.equal(rows[0]['本次包装组件BOM用量'], 3)
  assert.equal(rows.length, 1)
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets['包装汇总及系数'])[0]['包装系数'], 1.07)
  assert.ok(visibleCompositionColumns(data).some(column => column.key === 'path' && column.label === '保存的包装BOM路径'))
})

test('saved labor download reconciles full and partial exclusions, retaining gold-plating source identity', () => {
  const data = view(); data.costCode = 'DIRECT_LABOR'
  const identity = { sourceTable: 'cms_workshop_labor_raw', sourceId: '104173834', period: '2026-01', parentCode: '1145900000611' }
  const path = '1145900000611(×1)→201850113(×1)→520101-027(自身)(64)'
  data.composition.rows = [
    { ...identity, originalAmountYuan: '0.469222', excludedAmountYuan: '0.469222', path, note: '本单形态剔除' },
    { ...identity, sourceId: '104133208', originalAmountYuan: '0.060165', excludedAmountYuan: '0.022562', path: 'P→721850092(×1)→W(自身)(3.4)' },
    { ...identity, amountYuan: '0.469222', originalCent: '46.922222', workshopName: '商用电子装配一车间-梅渚烧结基座镀金', path },
    { ...identity, sourceId: '104133208', amountYuan: '0.060165', path: 'P→721850092(×1)→W(自身)(3.4);P→KEEP(×1)→W(自身)(5)' },
    { ...identity, sourceId: 'KEEP', amountYuan: '-0.000001' },
    { ...identity, period: '2025-01', amountYuan: '0.010000' },
  ]
  const original = JSON.stringify(data)
  const book = XLSX.read(XLSX.write(compositionWorkbook(data), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(book.Sheets['来源明细'])
  assert.equal(rows.length, 4)
  assert.equal(rows[0]['来源原金额（元）'], 0.469222)
  assert.equal(rows[0]['本单剔除金额（元）'], 0.469222)
  assert.equal(rows[0]['实际计入金额（元）'], 0)
  assert.equal(rows[1]['实际计入金额（元）'], 0.037603)
  assert.equal(rows[2]['实际计入金额（元）'], -0.000001)
  assert.equal(rows[3]['实际计入金额（元）'], 0.01)
  const exclusions = XLSX.utils.sheet_to_json(book.Sheets['剔除明细'])
  assert.equal(exclusions.length, 2)
  assert.equal(exclusions[0]['车间名称'], '商用电子装配一车间-梅渚烧结基座镀金')
  assert.equal(exclusions[0]['本单剔除金额（元）'], 0.469222)
  const paths = compositionPaths(data)
  assert.equal(paths.length, 3)
  assert.match(paths[0].treatment, /已剔除.*形态/)
  assert.equal(paths[0].amountYuan, '') // CMS wage path weight 64 is not 0.64 yuan.
  assert.equal(paths[0].pathBasis, '64')
  assert.doesNotMatch(paths[2].treatment, /已剔除/)
  assert.equal(JSON.stringify(data), original)
})
