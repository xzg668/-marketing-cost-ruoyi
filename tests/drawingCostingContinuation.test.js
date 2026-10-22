import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, ref } from 'vue'
import { useDrawingCostingContinuation } from '../src/composables/useDrawingCostingContinuation.js'

const month = '2026-10'
const task = id => ({ localTaskId: id, taskState: 'WAIT_REVIEW', consumptionState: 'NOT_READY' })
const outcome = ids => ({ checks: ids.map(id => ({ oaFormItemId: id, periodMonth: month, pipelineStatus: 'BLOCKED', currentStep: 'QUOTE_BOM' })) })
function harness() {
  const scope = effectScope(), number = ref('OA-1'), resumed = []
  const state = scope.run(() => useDrawingCostingContinuation(number, {
    fetchDrawing: async (_, id) => ({ current: task(id) }), resume: async options => resumed.push(options),
  }))
  const received = (id, overrides = {}) => state.accept({ itemId: id, accountingMonth: month, current: { ...task(id), taskState: 'RECEIVED', consumptionState: 'COMPLETE', ...overrides } })
  return { ...state, scope, number, resumed, received }
}

test('单行只接续已发起产品；收到确认即使原差异仍为正数也只接续一次', async () => {
  const h = harness()
  await h.remember(outcome([2]), { itemId: 2 })
  await h.received(1); assert.equal(h.resumed.length, 0)
  await h.received(2, { consumptionState: 'PENDING', differenceCount: 2 }); assert.equal(h.resumed.length, 0)
  await h.received(2, { differenceCount: 2 }); await h.received(2)
  assert.deepEqual(h.resumed, [{ itemId: 2, periodMonth: month }]); h.scope.stop()
})

test('整单等本次所有待确认产品接收并导入后才继续，普通查询不发起核算', async () => {
  const h = harness()
  await h.received(7); assert.equal(h.resumed.length, 0)
  await h.remember(outcome([1, 2])); await h.received(1)
  assert.equal(h.resumed.length, 0)
  await h.received(2); assert.deepEqual(h.resumed, [{ periodMonth: month }]); h.scope.stop()
})

test('逐行核算两个产品时保留各自等待，另一行零差异不会清掉待确认产品', async () => {
  const h = harness()
  await h.remember(outcome([1]), { itemId: 1 })
  await h.remember({ product: { pipelineStatus: 'SUCCESS' } }, { itemId: 2 })
  await h.remember(outcome([3]), { itemId: 3 })
  await h.received(1); await h.received(3)
  assert.deepEqual(h.resumed, [{ itemId: 1, periodMonth: month }, { itemId: 3, periodMonth: month }])
  h.scope.stop()
})

test('更换任务或切换报价单使旧续接失效，查询失败不猜测', async () => {
  const h = harness()
  await h.remember(outcome([1])); await h.received(1, { localTaskId: 99 })
  assert.equal(h.waiting.value, false); assert.equal(h.resumed.length, 0)
  await h.remember(outcome([2])); h.number.value = 'OA-2'; await h.received(2)
  assert.equal(h.resumed.length, 0); h.scope.stop()
})

test('零差异已经进入正常核算及价格缺口不注册额外续接', async () => {
  const h = harness()
  await h.remember({ ...outcome([1]), product: { pipelineStatus: 'SUCCESS' } }, { itemId: 1 })
  await h.received(1); assert.equal(h.resumed.length, 0)
  await h.remember({ checks: [{ ...outcome([2]).checks[0], currentStep: 'PRICE_PREPARE' }] })
  await h.received(2); assert.equal(h.resumed.length, 0); h.scope.stop()
})

test('同一会话返回页面可恢复本次核算意图，接续前清除记录避免刷新重复提交', async () => {
  const values = new Map(), resumed = []
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  function mount() {
    const effect = effectScope()
    const state = effect.run(() => useDrawingCostingContinuation(ref('OA-1'), {
      storage, sessionKey: () => 'finance-1:COMMERCIAL:OA-1',
      fetchDrawing: async (_, id) => ({ current: task(id) }), resume: async options => resumed.push(options),
    }))
    return { effect, state }
  }
  const first = mount(); await first.state.remember(outcome([3]), { itemId: 3 }); first.effect.stop()
  assert.equal(values.size, 1)
  const second = mount()
  await second.state.accept({ itemId: 3, accountingMonth: month, current: { ...task(3), taskState: 'RECEIVED', consumptionState: 'COMPLETE' } })
  assert.deepEqual(resumed, [{ itemId: 3, periodMonth: month }]); assert.equal(values.size, 0)
  second.effect.stop()
})
