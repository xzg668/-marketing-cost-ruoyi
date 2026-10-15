import test from 'node:test'
import assert from 'node:assert/strict'
import { businessPricingMonth, movePricePriority, priceTypeLabel, validatePricePriority } from '../src/pages/materialPricePriorityUtils.js'

const defaultOrder = ['LINKED', 'SETTLE_LINKED', 'RANGE', 'SETTLE_FIXED', 'FIXED']

test('财务可将固定价逐步移到首位，保持完整顺序且不改写当前配置', () => {
  let order = defaultOrder
  for (let index = 4; index > 0; index--) order = movePricePriority(order, index, -1)
  assert.deepEqual(order, ['FIXED', 'LINKED', 'SETTLE_LINKED', 'RANGE', 'SETTLE_FIXED'])
  assert.equal(defaultOrder[0], 'LINKED')
  assert.equal(validatePricePriority(order), '')
  assert.equal(validatePricePriority(defaultOrder), '')
  assert.deepEqual(movePricePriority(order, 0, -1), order)
  assert.deepEqual(movePricePriority(order, 4, 1), order)
  assert.deepEqual(movePricePriority(order, 0, 1), ['LINKED', 'FIXED', 'SETTLE_LINKED', 'RANGE', 'SETTLE_FIXED'])
})

test('拒绝遗漏、重复、未知类型和旧单类型配置', () => {
  for (const order of [null, 'LINKED', [], defaultOrder.slice(1), [...defaultOrder, 'FIXED'],
    ['LINKED', 'LINKED', 'RANGE', 'SETTLE_FIXED', 'FIXED'],
    ['LINKED', 'MAKE', 'RANGE', 'SETTLE_FIXED', 'FIXED']]) {
    assert.ok(validatePricePriority(order))
  }
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
  assert.equal(priceTypeLabel('技术补录'), '技术补录')
})
