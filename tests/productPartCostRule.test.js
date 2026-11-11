import test from 'node:test'
import assert from 'node:assert/strict'
import { productPartCostPayload, manufacturePercent, canMaintainPartCosts } from '../src/utils/productPartCostRule.js'
import { rowBasis, sheetGroups } from '../src/utils/jjbSheet.js'

test('percentage input preserves zero, leading-zero codes and decimal precision', () => {
  const form = { productCode: ' 001 ', partCode: ' 002 ', shape: '制造件', manufacturePercent: '10.1234567890' }
  const payload = productPartCostPayload(form)
  assert.equal(payload.productCode, '001'); assert.equal(payload.partCode, '002')
  assert.equal(payload.manufactureRate, '0.10123456789')
  assert.equal(manufacturePercent(payload.manufactureRate), '10.123456789')
  assert.equal(manufacturePercent(1e-12), '0.0000000001')
  assert.equal(manufacturePercent(0), '0')
  assert.equal(productPartCostPayload({ ...form, manufacturePercent: '0' }).manufactureRate, '0')
  for (const bad of ['', '-1', '100', '100.1', '1e2']) assert.throws(() => productPartCostPayload({ ...form, manufacturePercent: bad }))
})
test('model-only rules work and both empty identifiers are rejected', () => {
  const form = { productCode: 'P', partModel: 'M', shape: '采购件', manufacturePercent: '20' }
  assert.equal(productPartCostPayload(form).partCode, null)
  assert.throws(() => productPartCostPayload({ ...form, partModel: '' }), /至少/)
})
test('wildcard permission and ordinary staff do not grant maintenance access', () => {
  assert.equal(canMaintainPartCosts(['admin']), true)
  assert.equal(canMaintainPartCosts(['BU_DIRECTOR']), true)
  assert.equal(canMaintainPartCosts(['bu_staff', '*:*:*']), false)
})
test('saved special formula and ordering are presented without recalculating amounts', () => {
  const part = { section: 'SEPARATE_PARTS', kind: 'PART', amount: '33.150000', separateCalculation: {
    baseAmount: '20.000000', lossRate: '.02', manufactureRate: '0.2', threeExpenseRate: '0.3',
  } }
  part.separateCalculation.lossRate = '0.02'
  assert.match(rowBasis(part), /净损失率 2%.*制造费用率 20%.*三项费用率 30%/)
  assert.deepEqual(sheetGroups({ rows: [{ section: 'THREE_EXPENSES' }, part] }).map(g => g.code), ['THREE_EXPENSES', 'SEPARATE_PARTS'])
  assert.equal(part.amount, '33.150000')
})
