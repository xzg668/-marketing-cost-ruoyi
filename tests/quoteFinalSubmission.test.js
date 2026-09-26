import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, ref } from 'vue'
import { useQuoteFinalSubmission } from '../src/composables/useQuoteFinalSubmission.js'
const flush = () => new Promise(resolve => setImmediate(resolve))
const pending = () => { let resolve, reject; const promise = new Promise((ok, no) => { resolve = ok; reject = no }); return { promise, resolve, reject } }
const ready = { status: 'READY', canConfirm: true, periodMonth: '2026-09', fingerprint: 'a'.repeat(64), costs: [{ itemId: 1, totalCost: '152.503400', status: 'READY' }] }
function harness(api) { const scope = effectScope(), oaNo = ref('A'); return { scope, oaNo, ...scope.run(() => useQuoteFinalSubmission(oaNo, api)) } }
test('金额保持字符串精度，读取和刷新不发送 OA，双击仅提交一次', async () => {
  const sent = pending(), requests = []
  const h = harness({ fetch: async () => ready, submit: async (oaNo, body) => { requests.push({ oaNo, body }); return sent.promise } })
  await flush(); await h.refresh(); assert.equal(requests.length, 0)
  assert.equal(h.costsByItem.value.get('1').totalCost, '152.503400')
  const first = h.submit(); assert.equal(h.canSubmit.value, false); await h.submit(); assert.equal(requests.length, 1)
  assert.equal(requests[0].body.fingerprint, ready.fingerprint)
  sent.resolve({ ...ready, status: 'SUBMITTED', canConfirm: false }); await first
  await h.submit(); assert.equal(requests.length, 1); h.scope.stop()
})
test('部分核算保留已有成本，整单按钮禁用', async () => {
  let calls = 0
  const h = harness({ fetch: async () => ({ ...ready, canConfirm: false, status: 'NOT_READY', readyProducts: 1, totalProducts: 2 }), submit: async () => { calls++ } })
  await flush(); assert.equal(h.costsByItem.value.size, 1); await h.submit(); assert.equal(calls, 0); h.scope.stop()
})
test('响应丢失后状态未知，刷新和重复点击不能重发', async () => {
  let calls = 0, lost = false
  const h = harness({ fetch: async () => lost ? { ...ready, status: 'UNKNOWN', canConfirm: false } : ready, submit: async () => { calls++; lost = true; throw Error('连接中断') } })
  await flush(); await assert.rejects(h.submit()); await h.refresh(); await h.submit(); assert.equal(calls, 1); assert.equal(h.state.value.status, 'UNKNOWN'); h.scope.stop()
})
test('明确拒绝后新点击有新请求编号', async () => {
  const keys = []
  const h = harness({ fetch: async () => ready, submit: async (_, body) => { keys.push(body.requestKey); return { ...ready, status: 'REJECTED' } } })
  await flush(); await h.submit(); await h.submit(); assert.equal(keys.length, 2); assert.notEqual(keys[0], keys[1]); h.scope.stop()
})
test('切换单据忽略迟到的原单回执', async () => {
  const sent = pending()
  const h = harness({ fetch: async () => ready, submit: () => sent.promise })
  await flush(); const first = h.submit(); h.oaNo.value = 'B'; await flush()
  sent.resolve({ ...ready, status: 'SUBMITTED', canConfirm: false }); assert.equal(await first, null)
  assert.equal(h.state.value.status, 'READY'); assert.equal(h.sending.value, false); h.scope.stop()
})
test('读取失败清空旧成本并禁用提交，不继续显示过期金额', async () => {
  let fail = false
  const h = harness({ fetch: async () => { if (fail) throw Error('读取失败'); return ready }, submit: async () => {} })
  await flush(); fail = true; await h.refresh(); assert.equal(h.costsByItem.value.size, 0); assert.equal(h.canSubmit.value, false); h.scope.stop()
})
