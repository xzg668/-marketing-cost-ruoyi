import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inquiryDecimal, inquiryPercent, inquiryMetadata, inquiryPublishIdentity, inquiryScope, inquiryPreviewForm } from '../src/pages/householdInquiryUtils.js'

test('P按字符串原精度显示，H精确转换为百分数，不经浮点数', () => {
  assert.equal(inquiryDecimal('999999999999.999999999999'), '999999999999.999999999999')
  for (const [rate, expected] of [['0.085', '8.5%'], ['0.085123456789', '8.5123456789%'], ['0.00085', '0.085%'], ['0', '0%'], ['1.000', '100%'], ['999999.999999999999', '99999999.9999999999%']]) assert.equal(inquiryPercent(rate), expected)
  assert.equal(inquiryDecimal(null), '')
  for (const invalid of [0.085, '1e3', '-1', 'NaN']) assert.throws(() => inquiryPercent(invalid))
})
test('来源年月及价格口径必须显式提供，不从文件名或日期推断', () => {
  const input = { sourceMonth: '2026-10', unit: ' 件 ', currency: 'cny', taxBasis: 'EXCLUDED', businessUnitType: 'forged', unitPrice: '0' }
  assert.deepEqual(inquiryMetadata(input), { sourceMonth: '2026-10', priceContext: { unit: '件', currency: 'CNY', taxBasis: 'EXCLUDED' } })
  for (const change of [{ sourceMonth: '' }, { sourceMonth: '0000-10' }, { sourceMonth: '2026-13' }, { unit: '' }, { currency: '' }, { taxBasis: '' }]) assert.throws(() => inquiryMetadata({ ...input, ...change }))
})
test('发布仅取服务端预留三项身份，不重传价格、行集合或客户端组织', () => {
  const preview = { previewId: 'preview', publishRequestId: 'request', previewFingerprint: 'a'.repeat(64), rows: [{ price: '999' }], businessUnitType: 'forged' }
  const identity = inquiryPublishIdentity(preview)
  assert.deepEqual(identity, { previewId: 'preview', publishRequestId: 'request', previewFingerprint: 'a'.repeat(64) })
  assert.equal(Object.isFrozen(identity), true)
  assert.throws(() => inquiryPublishIdentity({ ...preview, publishRequestId: '' }))
})
test('待核验请求按真实用户及业务单元隔离，不保存财务内容', () => {
  const user = { userId: 7, username: 'finance', businessUnitType: 'COMMERCIAL' }
  assert.notEqual(inquiryScope(user), inquiryScope({ ...user, userId: 8 }))
  assert.notEqual(inquiryScope(user), inquiryScope({ ...user, businessUnitType: 'HOUSEHOLD' }))
  assert.throws(() => inquiryScope({ ...user, businessUnitType: '' }))
  assert.throws(() => inquiryScope({ ...user, userId: Number.MAX_SAFE_INTEGER + 1 }))
})
test('上传保留真实File与显式元数据，价格口径用JSON part', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'source.xls')
  const form = inquiryPreviewForm(file, { sourceMonth: '2026-10', unit: '件', currency: 'CNY', taxBasis: 'INCLUDED' })
  assert.equal(form.get('file').name, 'source.xls')
  assert.equal(form.get('sourceMonth'), '2026-10')
  assert.deepEqual(JSON.parse(await form.get('priceContext').text()), { unit: '件', currency: 'CNY', taxBasis: 'INCLUDED' })
  assert.equal(form.has('businessUnitType'), false)
  for (const bad of [null, new File([], 'source.xls'), new File(['x'], 'source.csv')]) assert.throws(() => inquiryPreviewForm(bad, {}))
})
