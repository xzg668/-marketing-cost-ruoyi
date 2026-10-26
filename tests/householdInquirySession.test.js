import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInquiryImportSession } from '../src/pages/householdInquirySession.js'

const deadline = Date.parse('2026-10-23T10:30:00Z')
const preview = (errors = []) => ({ batchId: 1, previewId: 'preview', publishRequestId: 'request', previewFingerprint: 'a'.repeat(64), expiresAt: new Date(deadline).toISOString(), status: 'PREVIEW', content: { sourceMonth: '2026-10', priceContext: { unit: '件', currency: 'CNY', taxBasis: 'EXCLUDED' }, workbook: { errors, duplicates: [], rows: [{}] }, rows: [{ source: { unitPrice: '20.9853', householdRate: '0.085' } }] } })
const result = { batchId: 1, publishRequestId: 'request', status: 'PUBLISHED', rows: [{ versionId: 9, revisionNo: 1 }], newVersions: 1 }
function storage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values } }
function fixture(overrides = {}) {
  const saved = storage(), calls = { publish: [], cancel: [], preview: 0, read: 0 }
  const api = { preview: async () => { calls.preview++; return preview() }, publish: async body => { calls.publish.push({ ...body }); return result }, cancel: async id => { calls.cancel.push(id) }, readPreview: async () => { calls.read++; return preview() }, ...overrides }
  let clock = deadline - 60_000
  const session = createInquiryImportSession({ api, storage: saved, scope: 'finance/COMMERCIAL', now: () => clock })
  return { session, api, saved, calls, advance: () => { clock = deadline + 1 } }
}

test('确认仅发送原预留身份，结果作为回执保存，不修改预览价格', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  assert.equal(f.session.canPublish(), true)
  f.session.state.preview.content.rows[0].source.unitPrice = '999'
  await f.session.publish()
  assert.deepEqual(f.calls.publish, [{ previewId: 'preview', publishRequestId: 'request', previewFingerprint: 'a'.repeat(64) }])
  assert.deepEqual(f.session.state.result, result); assert.equal(f.session.state.phase, 'DONE'); assert.equal(f.saved.values.size, 0)
})
test('错误行不允许部分发布，修正前取消原预览', async () => {
  const f = fixture({ preview: async () => preview([{ excelRow: 4, column: 'E', message: '负数' }]) })
  await f.session.inspect({}, {}); assert.equal(f.session.state.phase, 'ERRORS'); assert.equal(f.session.canPublish(), false)
  await f.session.publish(); assert.equal(f.calls.publish.length, 0)
  await f.session.reset(); assert.deepEqual(f.calls.cancel, ['preview']); assert.equal(f.session.state.preview, null)
})
test('网络结果未知时保留原请求，超过期限仍允许核验，不能清掉后改造新请求', async () => {
  const f = fixture(); let first = true
  f.api.publish = async body => { f.calls.publish.push({ ...body }); if (first) { first = false; throw new Error('Network Error') } return result }
  await f.session.inspect({}, {}); await f.session.publish()
  assert.equal(f.session.state.phase, 'UNCERTAIN'); assert.equal(f.saved.values.size, 1)
  const stored = [...f.saved.values.values()][0]; assert.ok(!stored.includes('unitPrice') && !stored.includes('20.9853'))
  f.advance(); assert.equal(f.session.canPublish(), true)
  await assert.rejects(f.session.reset()); assert.equal(f.calls.cancel.length, 0)
  await f.session.publish(); assert.deepEqual(f.calls.publish[0], f.calls.publish[1]); assert.equal(f.session.state.phase, 'DONE')
})
test('刷新可从同一账号业务单元恢复原预览，其他账号范围不会读取', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  const other = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/HOUSEHOLD', now: () => deadline - 1 })
  assert.equal(await other.resume(), false); assert.equal(f.calls.read, 0)
  const same = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/COMMERCIAL', now: () => deadline - 1 })
  assert.equal(await same.resume(), true); assert.equal(same.state.preview.previewId, 'preview'); assert.equal(f.calls.read, 1)
})
test('未知请求刷新读到服务端EXPIRED视图，仍沿用原身份核验实际结果', async () => {
  const f = fixture({ publish: async () => { throw Object.assign(new Error('未知'), { domainCode: 'PUBLICATION_UNCERTAIN', resultCode: 503 }) } })
  await f.session.inspect({}, {}); await f.session.publish(); f.session.dispose()
  f.api.readPreview = async () => ({ ...preview(), status: 'EXPIRED' })
  const same = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/COMMERCIAL', now: () => deadline + 1 })
  await same.resume(); assert.equal(same.state.phase, 'UNCERTAIN'); assert.equal(same.canPublish(), true)
})
test('陈旧和确定过期的预览必须重新预览，不能直接换新请求身份', async () => {
  for (const [domainCode, phase] of [['STALE_PREVIEW', 'STALE'], ['PREVIEW_EXPIRED', 'EXPIRED']]) {
    const f = fixture({ publish: async () => { throw Object.assign(new Error(domainCode), { domainCode, resultCode: 409 }) } })
    await f.session.inspect({}, {}); await f.session.publish(); assert.equal(f.session.state.phase, phase); assert.equal(f.session.canPublish(), false)
    assert.equal(f.session.state.identity.publishRequestId, 'request')
  }
})
test('忙碌期间不发出第二个预览请求', async () => {
  let resolve; const wait = new Promise(done => { resolve = done }); const f = fixture({ preview: async () => { f.calls.preview++; return wait } })
  const pending = f.session.inspect({}, {}); await f.session.inspect({}, {}); assert.equal(f.calls.preview, 1)
  resolve(preview()); await pending; assert.equal(f.session.state.phase, 'READY')
})
test('组件退出后发布响应不泄漏到新视图，原身份仍可重新核验', async () => {
  let resolve; const wait = new Promise(done => { resolve = done }); const f = fixture({ publish: async () => wait })
  await f.session.inspect({}, {}); const pending = f.session.publish(); f.session.dispose(); resolve(result); await pending
  assert.equal(f.saved.values.size, 1); assert.equal(f.session.state.result, null)
})
test('恢复时服务端身份与本地记录不同则拒绝，不自动替换后发布', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  f.api.readPreview = async () => ({ ...preview(), publishRequestId: 'different' })
  const same = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/COMMERCIAL', now: () => deadline - 1 })
  await same.resume(); assert.equal(same.canPublish(), false); assert.equal(f.calls.publish.length, 0); assert.ok(same.state.error)
})

test('未知请求刷新时读取预览再次断网，仍保留身份且不能重新上传覆盖', async () => {
  const f = fixture({ publish: async () => { throw new Error('Network Error') } })
  await f.session.inspect({}, {}); await f.session.publish()
  f.api.readPreview = async () => { throw new Error('Network Error') }
  const same = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/COMMERCIAL', now: () => deadline + 1 })
  await same.resume(); assert.equal(same.state.phase, 'UNCERTAIN'); assert.equal(same.canPublish(), true)
  await assert.rejects(same.inspect({}, {})); assert.equal(same.state.identity.publishRequestId, 'request')
})
test('已取消状态优先于客户端过期提示，不能变为可核验发布', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  f.api.readPreview = async () => ({ ...preview(), status: 'CANCELLED' })
  const same = createInquiryImportSession({ api: f.api, storage: f.saved, scope: 'finance/COMMERCIAL', now: () => deadline + 1 })
  await same.resume(); assert.equal(same.state.phase, 'CANCELLED'); assert.equal(same.canPublish(), false)
})
test('原请求无法保存时不发出发布请求，并保留可理解错误', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  f.saved.setItem = () => { throw new Error('storage unavailable') }
  await f.session.publish(); assert.equal(f.calls.publish.length, 0); assert.equal(f.session.state.phase, 'ERROR'); assert.ok(f.session.state.error)
})
test('服务端已确认成功，不因浏览器缓存清理失败改称结果未知', async () => {
  const f = fixture(); await f.session.inspect({}, {})
  f.saved.removeItem = () => { throw new Error('storage unavailable') }
  await f.session.publish(); assert.equal(f.session.state.phase, 'DONE'); assert.deepEqual(f.session.state.result, result)
})

test('浏览器时钟快于服务端，不提前禁用仍为PREVIEW的原预览', async () => {
  const f = fixture(); f.advance(); await f.session.inspect({}, {})
  assert.equal(f.session.state.preview.status, 'PREVIEW'); assert.equal(f.session.state.phase, 'READY'); assert.equal(f.session.canPublish(), true)
})
test('已未知请求收到当前核验冲突，保持未知粘性并沿用原身份', async () => {
  const f = fixture(); let attempt = 0
  f.api.publish = async body => { f.calls.publish.push({ ...body }); if (++attempt === 1) throw new Error('Network Error'); if (attempt === 2) throw Object.assign(new Error('并发冲突'), { domainCode: 'PUBLICATION_CONFLICT', resultCode: 409 }); return result }
  await f.session.inspect({}, {}); await f.session.publish(); await f.session.publish()
  assert.equal(f.session.state.phase, 'UNCERTAIN'); await assert.rejects(f.session.reset()); assert.equal(f.calls.cancel.length, 0)
  await f.session.publish(); assert.deepEqual(f.calls.publish, Array(3).fill(f.calls.publish[0])); assert.equal(f.session.state.phase, 'DONE')
})
