import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectQuantityRangeWorkbookRoute, formatRangeType, formatRange, findQuantityColumn, formatCurrentStatus } from '../src/pages/priceRangeImportUtils.js'

const quantity = { name: '数量价格', rows: [['物料代码', '区间下限', '区间上限', '单价'], ['M01', 1, 10, 2.5]] }
test('数量区间仍识别独立上下界，不把数据行当成副表头', () => {
  const result = detectQuantityRangeWorkbookRoute([quantity, { name: '空表', rows: [] }])
  assert.equal(result.ok, true)
  assert.equal(result.standardSheet.headerRowIndex, 0)
  assert.equal(result.standardSheet.subHeaderRowIndex, null)
})
test('数量矩阵保留税价副表头', () => {
  const result = detectQuantityRangeWorkbookRoute([{ name: '数量区间', rows: [['物料代码', '1-10', '', '11-20'], ['', '不含税', '含税', '不含税'], ['M', 1, 1.13, 2]] }])
  assert.equal(result.ok, true)
  assert.equal(result.standardSheet.subHeaderRowIndex, 1)
})
test('多个数量表不按顺序静默选择', () => {
  assert.equal(detectQuantityRangeWorkbookRoute([quantity, { ...quantity, name: '第二张' }]).ok, false)
})
test('空文件明确不支持', () => assert.equal(detectQuantityRangeWorkbookRoute([]).ok, false))
for (const title of ['铜价区间', '黄金AU9999平均价', 'CU：90000-94999', '60元/KG≤铜价<70元/KG']) {
  test(`行情文件不能从数量入口导入：${title}`, () => {
    const result = detectQuantityRangeWorkbookRoute([{ ...quantity, name: title }])
    assert.equal(result.ok, false)
    assert.match(result.message, /完整文件/)
  })
}
test('原稿与旧行情身份均可显示，旧数量行保持数量含义', () => {
  assert.equal(formatRangeType({ rangeBasis: 'FACTOR', factorCode: 'AVG|1#CU' }), '铜价区间')
  assert.equal(formatRangeType({ rangeBasis: 'FACTOR', factorCode: 'CU' }), '铜价区间')
  assert.equal(formatRangeType({ rangeBasis: 'FACTOR', factorCode: 'AVG|黄金AU9999' }), '黄金区间')
  assert.equal(formatRangeType({}), '数量区间')
  assert.equal(formatCurrentStatus({ currentFlag: 0 }), '历史')
  assert.equal(formatCurrentStatus({}), '当前')
})


test('range labels preserve quantity, gold/ton/kg units and half-open endpoints', () => {
  assert.equal(formatRange({ rangeBasis: 'FACTOR', rangeLow: 90, rangeHigh: 100, factorUnit: 'CNY_KG', upperInclusive: 0 }), '[90, 100) 元/公斤')
  assert.equal(formatRange({ rangeBasis: 'FACTOR', rangeLow: 900, rangeHigh: 950, factorUnit: 'CNY_G' }), '[900, 950] 元/克')
  assert.equal(formatRange({ rangeBasis: 'FACTOR', rangeLow: 90000, rangeHigh: 94999, factorUnit: 'CNY_TON' }), '[90000, 94999] 元/吨')
  assert.equal(formatRange({ rangeBasis: 'QTY', rangeLow: 1, rangeHigh: 100 }), '[1, 100]（采购数量）')
  assert.equal(formatCurrentStatus({rangeBasis:'FACTOR', sourceCellRef:'D4', currentFlag:1}), '已发布')
})

test('quantity import keeps supplier/material names and two tax columns distinct', () => {
  const header = ['供应商名称', '物料名称', '不含税价', '含税价']
  assert.equal(findQuantityColumn(header, ['物料名称', '名称']), 1)
  assert.equal(findQuantityColumn(header, ['含税价']), 3)
  assert.equal(findQuantityColumn(['不含税价（元）'], ['含税价']), -1)
  assert.equal(findQuantityColumn(['含税价（元）'], ['含税价']), 0)
})
