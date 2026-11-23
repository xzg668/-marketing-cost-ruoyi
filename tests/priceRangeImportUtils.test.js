import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRangeType, formatRange, formatCurrentStatus } from '../src/pages/priceRangeImportUtils.js'

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
