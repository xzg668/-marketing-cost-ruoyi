import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed, effectScope, ref } from 'vue'
import { useQuoteCostingPreparation } from '../src/composables/useQuoteCostingPreparation.js'
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const ready = { status: 'AVAILABLE', canCost: true }
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness(api) {
  const scope = effectScope(), oaNo = ref('A')
  const state = scope.run(() => useQuoteCostingPreparation(oaNo, api))
  return { ...state, scope, oaNo }
}
test('加载、刷新只读取状态；双击共享一次提交，流程不允许核算时禁用操作', async () => {
  const sent = pending(); let calls = 0
  const h = harness({ fetch: async () => ready, submit: () => { calls++; return sent.promise } })
  await flush(); await h.refresh(); assert.equal(calls, 0)
  const first = h.submit(); await h.submit(); assert.equal(calls, 1)
  sent.resolve({ preparation: { status: 'WAITING', canCost: false }, checks: [] })
  await first; assert.equal(h.disabled.value, true); h.scope.stop()
})
test('切换报价单后忽略原单迟到的提交回执', async () => {
  const sent = pending()
  const h = harness({ fetch: async () => ready, submit: () => sent.promise })
  await flush(); const first = h.submit(); h.oaNo.value = 'B'; await flush()
  sent.resolve({ preparation: { status: 'AVAILABLE', canCost: true }, checks: [{ productCode: 'OLD' }] })
  assert.equal(await first, null); assert.equal(h.state.value.status, 'AVAILABLE')
  assert.deepEqual(h.checks.value, []); h.scope.stop()
})
test('本地检查可重试，缺口提示不附带 OA 发送参数', async () => {
  const requests = []
  const h = harness({ fetch: async () => ready, submit: async (_, body) => {
    requests.push(body)
    return { preparation: { status: 'WAITING_INPUT', canCost: true }, checks: [{ productCode: 'P1', pipelineStatus: 'BLOCKED' }] }
  } })
  await flush(); await h.submit({ itemId: 1, periodMonth: '2026-09' })
  assert.deepEqual(requests[0], { itemId: 1, periodMonth: '2026-09' })
  assert.equal(h.wholeLabel, '整单核算'); assert.equal(h.disabled.value, false)
  await h.submit(); assert.deepEqual(requests[1], {})
  assert.equal(h.checks.value[0].productCode, 'P1'); h.scope.stop()
})
test('同一报价单切换产品时读取当前产品状态并丢弃旧请求', async () => {
  const first = pending()
  const scope = effectScope(), oaNo = ref('A'), itemId = ref(1)
  const calls = []
  const state = scope.run(() => useQuoteCostingPreparation(oaNo, {
    fetch: async () => {
      calls.push(itemId.value)
      return itemId.value === 1 ? first.promise : { status: 'AVAILABLE', canCost: true, totalProducts: 1 }
    },
    submit: async () => null,
  }, computed(() => `${oaNo.value}:${itemId.value}`)))
  itemId.value = 2
  await flush()
  first.resolve({ status: 'WAITING', canCost: false })
  await flush()
  assert.deepEqual(calls, [1, 2])
  assert.equal(state.state.value.totalProducts, 1)
  assert.equal(state.disabled.value, false)
  scope.stop()
})
