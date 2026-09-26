import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, ref } from 'vue'
import { useQuoteBatchCosting } from '../src/composables/useQuoteBatchCosting.js'

const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(overrides = {}) {
  const oaNo = ref('OA-A')
  const scope = effectScope()
  const timers = new Map()
  const events = []
  let nextId = 0
  const api = scope.run(() => useQuoteBatchCosting(oaNo, {
    fetchProgress: async () => ({ active: true, status: 'RUNNING' }),
    submitBatch: async () => ({ active: true, status: 'PENDING' }),
    refreshDetail: async () => events.push('refresh'),
    onSubmitted: () => events.push('submitted'),
    onFinished: () => events.push('finished'),
    onError: () => events.push('error'),
    setTimer: (fn) => { timers.set(++nextId, fn); return nextId },
    clearTimer: (id) => timers.delete(id),
    ...overrides,
  }))
  const tick = async () => {
    const [id, fn] = timers.entries().next().value
    timers.delete(id)
    await fn()
  }
  return { ...api, oaNo, scope, timers, events, tick }
}

test('离开页面后迟到的轮询不能重启定时器', async () => {
  const response = pending()
  let calls = 0
  const h = harness({ fetchProgress: () => ++calls === 1 ? { active: true } : response.promise })
  await h.loadBatchProgress()
  const polling = h.tick()
  h.scope.stop()
  response.resolve({ active: true, status: 'RUNNING' })
  await polling
  assert.equal(h.timers.size, 0)
  assert.equal(h.batchRun.value.status, undefined)
})

test('A 到 B 再回 A 时忽略第一次 A 的响应', async () => {
  const old = pending()
  let calls = 0
  const h = harness({ fetchProgress: () => ++calls === 1 ? old.promise : { active: false, marker: 'new' } })
  const read = h.loadBatchProgress()
  h.oaNo.value = 'OA-B'
  h.oaNo.value = 'OA-A'
  await h.loadBatchProgress()
  old.resolve({ active: true, marker: 'old' })
  await read
  assert.equal(h.batchRun.value.marker, 'new')
  assert.equal(h.timers.size, 0)
  h.scope.stop()
})

test('连续点击只提交一次，较早的进度响应不能覆盖提交结果', async () => {
  const oldRead = pending(), submitted = pending()
  let calls = 0
  const h = harness({ fetchProgress: () => oldRead.promise, submitBatch: () => { calls++; return submitted.promise } })
  const reading = h.loadBatchProgress()
  const first = h.submitWholeQuoteCosting()
  await h.submitWholeQuoteCosting()
  oldRead.resolve(null)
  await reading
  assert.equal(h.batchSubmitting.value, true)
  submitted.resolve({ active: true, batchNo: 'new' })
  await first
  assert.equal(calls, 1)
  assert.equal(h.batchRun.value.batchNo, 'new')
  assert.equal(h.timers.size, 1)
  h.scope.stop()
})

test('提交过程中切换报价单，旧请求不弹消息也不覆盖新页面', async () => {
  const response = pending()
  const h = harness({ submitBatch: () => response.promise })
  const submission = h.submitWholeQuoteCosting()
  h.oaNo.value = 'OA-B'
  response.resolve({ active: true })
  await submission
  assert.equal(h.batchRun.value, null)
  assert.equal(h.batchSubmitting.value, false)
  assert.deepEqual(h.events, [])
  assert.equal(h.timers.size, 0)
  h.scope.stop()
})

test('全部复用时提交即结束，仍立即刷新产品结果', async () => {
  const h = harness({ submitBatch: async () => ({ active: false, status: 'SUCCESS', skippedCurrentCount: 3 }) })
  await h.submitWholeQuoteCosting()
  assert.deepEqual(h.events, ['submitted', 'finished', 'refresh'])
  assert.equal(h.timers.size, 0)
  h.scope.stop()
})

test('轮询暂时失败保留进度，恢复后等待资料结论也刷新详情', async () => {
  let reads = 0
  const h = harness({ fetchProgress: async () => {
    if (++reads === 1) return { active: true }
    if (reads === 2) throw new Error('temporary')
    return { active: false, businessOutcome: 'WAITING_INPUT' }
  } })
  await h.loadBatchProgress()
  await h.tick()
  assert.equal(h.batchRun.value.active, true)
  assert.equal(h.timers.size, 1)
  await h.tick()
  assert.equal(h.batchRun.value.businessOutcome, 'WAITING_INPUT')
  assert.deepEqual(h.events, ['finished', 'refresh'])
  assert.equal(h.timers.size, 0)
  h.scope.stop()
})

test('任务已完成但详情暂时失败时继续读取，不误报提交失败', async () => {
  let refreshes = 0
  const h = harness({
    submitBatch: async () => ({ active: false, status: 'SUCCESS' }),
    fetchProgress: async () => ({ active: false, status: 'SUCCESS' }),
    refreshDetail: async () => { if (++refreshes === 1) throw new Error('read failed') },
  })
  await h.submitWholeQuoteCosting()
  assert.deepEqual(h.events, ['submitted', 'finished'])
  assert.equal(h.timers.size, 1)
  await h.tick()
  assert.equal(refreshes, 2)
  assert.equal(h.timers.size, 0)
  h.scope.stop()
})
