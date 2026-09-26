import test from 'node:test'
import assert from 'node:assert/strict'
import { netLossPercent, netLossPayload } from '../src/utils/technicalDataNetLoss.js'

test('净损失率百分数展示保留来源精度，零与未填分开', () => {
  for (const [value, expected] of [[null, ''], ['', ''], [0, '0'], ['0.00475', '0.475'],
    ['0.00475001', '0.475001'], [1e-8, '0.000001'], ['0.99999', '99.999']]) {
    assert.equal(netLossPercent(value), expected)
  }
})
test('参考只传所选成品及指纹，不能带前端费率，公共零值不可参考', () => {
  const reference = { source: { status: 'AVAILABLE', rate: 0.003, materialNo: 'A' }, fingerprint: 'hash' }
  assert.deepEqual(netLossPayload('REFERENCE', reference, '9.9', 3), {
    expectedVersion: 3, entryMode: 'REFERENCE', referenceMaterialNo: 'A', referenceFingerprint: 'hash' })
  for (const value of [null, { ...reference, source: { ...reference.source, status: 'MISSING' } },
    ...[null, 0, -1, 1, 'NaN'].map(rate => ({ ...reference, source: { ...reference.source, rate } }))]) assert.throws(() => netLossPayload('REFERENCE', value, '', 1), /参考成品/)
})
test('手填保留百分数文本，仅当前方式字段提交，非法范围精度拒绝', () => {
  for (const value of ['0', '0.475', '99.999']) assert.deepEqual(netLossPayload('MANUAL', { fingerprint: 'old' }, value, 5),
    { expectedVersion: 5, entryMode: 'MANUAL', percent: value })
  assert.equal(netLossPayload('MANUAL', null, '', 5).percent, null)
  for (const value of ['-1', '100', '0.0001', 'NaN', '1e1', '0.1%']) assert.throws(() => netLossPayload('MANUAL', null, value, 5), /百分数/)
})
