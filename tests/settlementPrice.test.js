import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayDecimal, settlementMonth, settlementReturnTo, importWeightStatus, settlementFinanceScheme } from '../src/pages/settlementPriceUtils.js'
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
test('金额和重量显示保留精度，空值与零不同', () => {
  assert.equal(displayDecimal('0'), '0')
  assert.equal(displayDecimal('0.000000000001'), '0.000000000001')
  assert.equal(displayDecimal('21.6362912421045'), '21.6362912421045')
  assert.equal(displayDecimal('1.480000000000'), '1.48')
  assert.equal(displayDecimal(null), '未填写')
})
test('新版原稿空白锌重按零计算，原始空白保留，铜重缺失和旧样例仍待补齐', () => {
  const rule = { priceType: 'SETTLE_LINKED', formula: { version: 'SETTLEMENT_CU_ZN_ROUND4_V2' }, weights: { originalCopperG: '1.3', originalZincG: null } }
  assert.equal(importWeightStatus(rule), '原稿锌重空白，按0计算')
  assert.equal(rule.weights.originalZincG, null)
  rule.weights.originalZincG = '0'
  assert.equal(importWeightStatus(rule), '采用本次原稿重量')
  rule.weights.originalCopperG = null
  assert.equal(importWeightStatus(rule), '原稿重量待补齐')
  rule.weights.originalCopperG = '1.3'
  rule.formula.version = 'SETTLEMENT_CU_ZN_V1'
  assert.equal(importWeightStatus(rule), '原稿重量待补齐')
  rule.priceType = 'SETTLE_FIXED'
  assert.equal(importWeightStatus(rule), '固定价无需重量')
})
test('结算详情展示实际财务方案，方案金额保持字符串精度', () => {
  assert.equal(settlementFinanceScheme(null), '未使用')
  assert.equal(settlementFinanceScheme({ financial: { scope: { schemeCode: 'CU_90000' } } }), 'Cu 90000 元/吨方案')
  assert.equal(settlementFinanceScheme({ financial: { scope: { schemeCode: 'CU_90000_0000001' } } }), 'Cu 90000.0000001 元/吨方案')
})
