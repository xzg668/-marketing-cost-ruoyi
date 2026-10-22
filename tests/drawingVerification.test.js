import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed, effectScope, ref } from 'vue'
import { useDrawingVerification } from '../src/composables/useDrawingVerification.js'
import { drawingText, safeDrawingUrl, drawingTaskLabel, drawingConsumptionLabel, drawingEditUrl, drawingDetailGroups, drawingDateTime } from '../src/utils/drawingVerification.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const waiting = { current: { localTaskId: 42, externalTaskId: 'external-string-task', taskState: 'WAIT_REVIEW', differenceCount: 2 } }

test('明细只展示当前任务图号，附带分组保留为来源且不能替代缺失的当前图号', () => {
  const data = { OTHER: { params: { items: [{ qty: '7.0000' }] } }, PRODUCT: { params: { items: [{ qty: '2.5000' }] } } }
  const groups = drawingDetailGroups(data, 'PRODUCT')
  assert.equal(groups.current, data.PRODUCT)
  assert.deepEqual(groups.additional, [['OTHER', data.OTHER]])
  assert.equal(drawingDetailGroups(data, 'MISSING').current, null)
  assert.equal(drawingDetailGroups(data, '').current, null)
  assert.deepEqual(drawingDetailGroups(null, 'PRODUCT'), { current: null, additional: [] })
  assert.deepEqual(Object.keys(data), ['OTHER', 'PRODUCT'])
})

test('毫秒时间戳与服务端业务时间统一按北京时间展示', () => {
  assert.equal(drawingDateTime(Date.parse('2026-10-22T02:38:05Z')), '2026-10-22 10:38:05')
  assert.equal(drawingDateTime('2026-10-22T10:38:05.621913'), '2026-10-22 10:38:05')
  assert.equal(drawingDateTime(null), '未提供')
})
function harness(api) {
  const effect = effectScope(), product = ref(1), month = ref('2026-10')
  const scope = computed(() => ({ oaNo: 'OA-1', itemId: product.value, month: month.value }))
  return { ...effect.run(() => useDrawingVerification(scope, api, { setTimer: () => 1, clearTimer: () => {} })), effect, product, month }
}

test('进入、返回和刷新只读本地状态；确认后保留大于零的原始差异数', async () => {
  let posts = 0, reads = 0
  const h = harness({ fetch: async () => { reads++; return reads < 3 ? waiting : { current: { ...waiting.current, taskState: 'RECEIVED', consumptionState: 'PENDING' } } }, operate: () => { posts++ } })
  await flush(); await h.refresh(); await h.refresh()
  assert.equal(posts, 0); assert.equal(reads, 3)
  assert.equal(h.state.value.current.differenceCount, 2)
  assert.equal(drawingTaskLabel(h.state.value.current), '已确认')
  assert.equal(drawingConsumptionLabel(h.state.value.current), '等待导入和物料匹配')
  h.effect.stop()
})

test('只有等待人工确认可跳转；接收、历史及零差异均关闭编辑入口', () => {
  const task = { taskState: 'WAIT_REVIEW', differenceCount: 2, editUrl: 'https://drawing.test/edit/task-1' }
  assert.equal(drawingEditUrl(task), task.editUrl)
  for (const taskState of ['RECEIVED', 'SUPERSEDED', 'REQUESTING', 'FAILED']) {
    assert.equal(drawingEditUrl({ ...task, taskState }), '')
  }
  assert.equal(drawingTaskLabel({ ...task, taskState: 'RECEIVED', differenceCount: 0 }), '无差异')
})

test('等待时只轮询已保存状态，确认接收立即关链接，消费完成后停止轮询', async () => {
  const effect = effectScope(), callbacks = new Map(); let timerId = 0, reads = 0
  const responses = [waiting, { current: { ...waiting.current, taskState: 'RECEIVED', consumptionState: 'PENDING' } },
    { current: { ...waiting.current, taskState: 'RECEIVED', consumptionState: 'COMPLETE' } }]
  const h = effect.run(() => useDrawingVerification(ref({ oaNo: 'A', itemId: 1, month: '2026-10' }), {
    fetch: async () => responses[reads++], operate: () => assert.fail('轮询不能写入'),
  }, { setTimer: callback => { callbacks.set(++timerId, callback); return timerId }, clearTimer: id => callbacks.delete(id) }))
  await flush(); assert.equal(callbacks.size, 1)
  await [...callbacks.values()][0](); assert.equal(h.state.value.current.taskState, 'RECEIVED')
  assert.equal(drawingEditUrl(h.state.value.current), '')
  await [...callbacks.values()][0](); assert.equal(callbacks.size, 0)
  assert.equal(reads, 3); effect.stop()
})

test('明确重新获取带本地旧任务条件，双击只提交一次', async () => {
  const response = pending(), requests = []
  const h = harness({ fetch: async () => waiting, operate: (...args) => { requests.push(args); return response.promise } })
  await flush()
  const first = h.operate('RESTART', 'DRAW-01'); await h.operate('RESTART', 'DRAW-01')
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0], ['OA-1', 1, '2026-10', { action: 'RESTART', drawingNo: 'DRAW-01', expectedTaskId: 42 }])
  response.resolve({ current: { localTaskId: 43, externalTaskId: 'next-external-task' } })
  await first; assert.equal(h.state.value.current.localTaskId, 43)
  h.effect.stop()
})

test('切换产品和月份后忽略旧查询及旧操作回执', async () => {
  const oldRead = pending(), oldWrite = pending()
  const h = harness({ fetch: async (_, item, month) => item === 1 ? oldRead.promise : { itemId: item, month }, operate: () => oldWrite.promise })
  const write = h.operate('START')
  h.product.value = 2; h.month.value = '2026-09'; await flush()
  oldRead.resolve(waiting); oldWrite.resolve(waiting); await write; await flush()
  assert.equal(h.state.value.itemId, 2); assert.equal(h.state.value.month, '2026-09')
  assert.equal(h.busy.value, false); h.effect.stop()
})

test('快速切换历史版本，只显示最后选择的完整 PLM 数据', async () => {
  const first = pending()
  const original = [{ plmVersion: 'V002', extension: { department: ['A', 'B'] } }, { plmVersion: 'V001' }]
  const h = harness({ fetch: async () => waiting, detail: async (_, __, ___, id) => id === 1 ? first.promise : { plmData: original } })
  await flush(); const old = h.openResult(1); await h.openResult(2)
  first.resolve({ plmData: [] }); await old
  assert.deepEqual(h.detail.value.plmData, original)
  h.effect.stop()
})

test('未选月份不查询也不发起核验，错误后保留既有任务状态供刷新排查', async () => {
  let reads = 0, posts = 0
  const h = harness({ fetch: async () => { reads++; return waiting }, operate: async () => { posts++; throw new Error('响应保存失败，请核查原任务') } })
  await flush(); h.month.value = ''; await flush(); await h.operate('START')
  assert.equal(reads, 1); assert.equal(posts, 0)
  h.month.value = '2026-10'; await flush(); await h.operate('RESTART')
  assert.equal(h.state.value.current.localTaskId, 42); assert.match(h.error.value, /核查原任务/)
  h.effect.stop()
})

test('外部链接只允许完整 HTTP/HTTPS，九字段文本不改变前导零和精度', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '/relative', '//example.test/edit', null]) assert.equal(safeDrawingUrl(url), '')
  assert.equal(safeDrawingUrl('http://10.10.206.115:8011/edit/task'), 'http://10.10.206.115:8011/edit/task')
  assert.equal(safeDrawingUrl('https://files.example.test/doc?signature=original'), 'https://files.example.test/doc?signature=original')
  assert.equal(drawingText('001'), '001'); assert.equal(drawingText('0.1250'), '0.1250')
  assert.equal(drawingText(null), '未提供'); assert.equal(drawingText(''), '（空）'); assert.equal(drawingText('0'), '0')
})
