import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decimalInput, settlementMonth, settlementReturnTo, weightChange, baseChange } from '../src/pages/settlementPriceUtils.js'
import { priceSourceGapKind, summarizePriceSourceGaps } from '../src/utils/priceSourceGaps.js'

test('结算联动缺口与普通联动分开', () => {
  for (const priceType of ['SETTLE_LINKED', '结算联动价']) assert.equal(priceSourceGapKind({ priceType }), 'SETTLE_LINKED')
  assert.equal(summarizePriceSourceGaps([{ priceType: '结算联动价' }]).settleLinked, 1)
})
test('默认月份与报价返回范围保留，拒绝外部跳转', () => {
  assert.equal(settlementMonth({}), '2026-10')
  assert.equal(settlementMonth({ pricingMonth: '2026-11' }), '2026-11')
  assert.equal(settlementMonth({ priceMonth: '2026-13' }), '2026-10')
  assert.equal(settlementReturnTo('/quote/a/costing?itemId=1'), '/quote/a/costing?itemId=1')
  assert.equal(settlementReturnTo('/ingest/quote-requests/STP/items/1/costing?tab=PRICE_SOURCE_SUPPLEMENT&refreshPriceSource=1'), '/ingest/quote-requests/STP/items/1/costing?tab=PRICE_SOURCE_SUPPLEMENT&refreshPriceSource=1')
  for (const path of ['//evil.test', 'https://evil.test', '/\\evil.test', '/price/settlement', null]) assert.equal(settlementReturnTo(path), '')
})
test('金额和重量保留十进制字符串，空值与零不同', () => {
  assert.equal(decimalInput('0'), '0')
  assert.equal(decimalInput('0.000000000001'), '0.000000000001')
  for (const value of ['', null, '-1', '1e2', 'abc', '0.0000000000001']) assert.throws(() => decimalInput(value))
  assert.deepEqual(weightChange({ copper: '0', zinc: '1.48', reason: '财务确认' }, 2),
    { copperWeightG: '0', zincWeightG: '1.48', reason: '财务确认', expectedRevision: 2 })
  assert.throws(() => weightChange({ copper: '0', zinc: '', reason: '确认' }, 2))
  assert.throws(() => weightChange({ copper: '0', zinc: '0', reason: '' }, 2))
})
test('沿用十月基价时十一月建立首版，不把十月修订号用于十一月', () => {
  const input = { copper: '110000', zinc: '26000', reason: '十一月', unit: 'CNY/T' }
  assert.equal(baseChange(input, '2026-11', { priceMonth: '2026-10', revisionNo: 3 }).expectedRevision, 0)
  assert.equal(baseChange(input, '2026-10', { priceMonth: '2026-10', revisionNo: 3 }).expectedRevision, 3)
})
