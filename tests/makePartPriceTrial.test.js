import test from 'node:test'
import assert from 'node:assert/strict'
import { copperTrialPayload, amount, signedAmount, differenceSentence } from '../src/components/makePartPriceTrial.js'
test('Cu trial preserves decimal text, units, and exact selected basis', () => {
  assert.deepEqual(copperTrialPayload({ basis: 'saved' }, '100000.123456789'), { expectedBasis: 'saved', copperPerTon: '100000.123456789' })
  for (const value of ['', '0', '-1', 'NaN', '1e5', '1000000001']) assert.throws(() => copperTrialPayload({ basis: 'x' }, value))
})
test('financial comparison keeps zero, signs and missing values distinct', () => {
  assert.equal(amount(null), '—'); assert.equal(amount('0'), '0')
  assert.equal(signedAmount('0.59201053'), '+0.59201053')
  assert.equal(differenceSentence('-0.1'), '减少 0.1 元')
  assert.equal(differenceSentence('0'), '价格不变')
})
