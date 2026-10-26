import test from 'node:test'
import assert from 'node:assert/strict'
import { businessPricingMonth, financePriceOrder, priceTypeOptions, priceTypeLabel } from '../src/pages/materialPricePriorityUtils.js'

const defaultOrder = ['LINKED', 'SETTLE_LINKED', 'RANGE', 'SETTLE_FIXED', 'FIXED']

test('财务单选指定类型，持久化首项始终是该类型，其余默认顺序保持稳定', () => {
  for (const type of defaultOrder) {
    const stored = financePriceOrder(type)
    assert.equal(stored[0], type)
    assert.equal(stored.length, 5)
    assert.equal(new Set(stored).size, 5)
    assert.deepEqual(stored.slice(1), defaultOrder.filter(value => value !== type))
  }
  assert.deepEqual(priceTypeOptions.map(option => option.value), defaultOrder)
})

test('指定类型不接受未知类型或自动来源，订单和阶梯只作自动后备', () => {
  for (const type of [null, '', 'MAKE', 'ODS_ORDER', 'ODS_TIER', []])
    assert.throws(() => financePriceOrder(type), /请选择有效的价格类型/)
})

test('月份使用业务时区，跨月跨年不受浏览器时区影响', () => {
  assert.equal(businessPricingMonth(new Date('2026-09-30T15:59:59Z')), '2026-09')
  assert.equal(businessPricingMonth(new Date('2026-09-30T16:00:00Z')), '2026-10')
  assert.equal(businessPricingMonth(new Date('2026-12-31T16:00:00Z')), '2027-01')
})

test('结算来源与普通来源分别显示，其他真实来源保持原名', () => {
  assert.equal(priceTypeLabel('SETTLE_LINKED'), '结算联动价')
  assert.equal(priceTypeLabel('SETTLE_FIXED'), '结算固定价')
  assert.equal(priceTypeLabel('FIXED'), '固定价')
  assert.equal(priceTypeLabel('ODS_ORDER'), '订单价')
  assert.equal(priceTypeLabel('ODS_TIER'), '阶梯价')
  assert.equal(priceTypeLabel('技术补录'), '技术补录')
})
