import assert from 'node:assert/strict'
import { test } from 'node:test'
import { priceText, financeCopperPerTon, originalSummary, originalActionLabel, rangeText, originalFormulaText } from '../src/components/originalPriceDisplay.js'

test('中文公式保留原文，区分原稿未填和旧版本未保存', () => {
  const text = '（铜价×重量＋加工费）/1.13\n备注：按元/公斤'
  assert.equal(originalFormulaText(text), text)
  for (const empty of ['', '  ']) assert.equal(originalFormulaText(empty), '原稿未填写中文公式')
  for (const missing of [null, undefined]) assert.equal(originalFormulaText(missing), '该版本未保存中文公式')
})

test('单价展示区分缺价和零，保留六位精度及负差额', () => {
  for (const value of [null, undefined, '', ' ', 'bad', Infinity]) assert.equal(priceText(value), '—')
  assert.equal(priceText(0), '0')
  assert.equal(priceText('2.0123456'), '2.012346')
  assert.equal(priceText('-0.000012'), '-0.000012')
})
test('财务Cu展示只换算已知单位，不把缺失或未知单位当作零', () => {
  const context = (price, unit) => ({ financial: { factors: { 'AVG|1#CU': { price, unit } } } })
  assert.equal(financeCopperPerTon(context('90', 'CNY_KG')), 90000)
  assert.equal(financeCopperPerTon(context('90000', 'CNY_TON')), 90000)
  assert.equal(financeCopperPerTon(context(0, 'CNY_KG')), 0)
  assert.equal(financeCopperPerTon(context(null, 'CNY_KG')), null)
  assert.equal(financeCopperPerTon(context(90, 'UNKNOWN')), null)
  assert.equal(financeCopperPerTon(null), null)
})
test('导入摘要保留未变及错误，不将未知状态伪装成新增', () => {
  assert.deepEqual(originalSummary([{ action: 'NEW' }, { action: 'REVISION' }, { action: 'UNCHANGED' }, {}], [{ message: '缺价' }]), { newCount: 1, revisedCount: 1, unchangedCount: 1, errorCount: 1 })
  assert.equal(originalActionLabel('UNCHANGED'), '未变')
  assert.equal(originalActionLabel('UNKNOWN'), '待检查')
})
test('区间展示保留上下界是否包含端点', () => {
  assert.equal(rangeText({low: 90000, high: 95000, lowerInclusive: true, upperInclusive: false}), '[90,000, 95,000)')
  assert.equal(rangeText({low: 90000, high: 95000, lowerInclusive: false, upperInclusive: true}), '(90,000, 95,000]')
  assert.equal(rangeText(null), '—')
})
