import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, ref } from 'vue'
import { useQuoteMaterialConfirmation } from '../src/composables/useQuoteMaterialConfirmation.js'
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const ready = { status: 'REQUIRES_CONFIRMATION', canConfirm: true, needsConfirmation: true }
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness(api) {
  const scope = effectScope(), oaNo = ref('A')
  const state = scope.run(() => useQuoteMaterialConfirmation(oaNo, api))
  return { ...state, scope, oaNo }
}
test('加载、刷新只读取状态；双击共享一次提交，结果未确认时禁用核算', async () => {
  const sent = pending(); let calls = 0
  const h = harness({ fetch: async () => ready, submit: () => { calls++; return sent.promise } })
  await flush(); await h.refresh(); assert.equal(calls, 0)
  const first = h.submit(); await h.submit(); assert.equal(calls, 1)
  sent.resolve({ confirmation: { status: 'UNKNOWN', canConfirm: false, needsConfirmation: true }, checks: [] })
  await first; assert.equal(h.disabled.value, true); h.scope.stop()
})
test('切换报价单后忽略原单迟到的提交回执', async () => {
  const sent = pending()
  const h = harness({ fetch: async () => ready, submit: () => sent.promise })
  await flush(); const first = h.submit(); h.oaNo.value = 'B'; await flush()
  sent.resolve({ confirmation: { status: 'SUCCESS', canConfirm: true }, checks: [{ productCode: 'OLD' }] })
  assert.equal(await first, null); assert.equal(h.state.value.status, 'REQUIRES_CONFIRMATION')
  assert.deepEqual(h.checks.value, []); h.scope.stop()
})
test('明确拒绝后才显示重试操作；普通缺口不传重试标识', async () => {
  const requests = []
  const h = harness({ fetch: async () => ready, submit: async (_, body) => {
    requests.push(body)
    return { confirmation: { status: 'REJECTED', needsConfirmation: true, canConfirm: true }, checks: [] }
  } })
  await flush(); await h.submit(); assert.equal(requests[0].retryRejected, false)
  assert.equal(h.wholeLabel.value, '重试资料确认并整单核算')
  await h.submit(); assert.equal(requests[1].retryRejected, true)
  assert.notEqual(requests[0].requestKey, requests[1].requestKey); h.scope.stop()
})
