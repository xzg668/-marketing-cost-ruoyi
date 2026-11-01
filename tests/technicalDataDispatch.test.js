import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { TECHNICAL_DATA_MODULES, dispatchPreviewModules } from '../src/utils/technicalDataWorkbench.js'

const source = fs.readFileSync(new URL('../src/components/technical-data/TechnicalDataDispatchDialog.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'dispatch-test' }).content
  .replace(/^import .+ from .+$/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})

async function mount(publish) {
  const events = [], sent = [], storage = new Map()
  const row = { id: 6, oaNo: 'FI-SC-006-20261029-002', materialNo: '1145100050625', costingWorkspace: { periodMonth: '2026-10' } }
  const dependencies = {
    ...Vue, TECHNICAL_DATA_MODULES, dispatchPreviewModules, TechnicalDataPersonSelect: {},
    createUuid: () => 'dispatch-test-request', useUserStore: () => ({ userId: 1 }),
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    ElMessage: { success: message => events.push(['message', message]) },
    checkTechnicalDataSources: async () => ({ accountingMonth: '2026-10', fingerprint: 'checked', modules: [
      { moduleType: 'PRICE', required: true, availability: 'MISSING' },
    ] }),
    publishTechnicalDataTasks: async command => { sent.push(command); return publish() },
  }
  const component = new Function(...Object.keys(dependencies), script)(...Object.values(dependencies))
  component.render = () => null
  const app = renderer.createApp(component, { modelValue: false, rows: [row], defaultAssignee: 888,
    'onUpdate:modelValue': value => events.push(['open', value]), onDispatched: () => events.push(['refresh']) })
  const instance = app.mount({}).$
  instance.props.modelValue = true
  await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick()
  return { app, state: instance.setupState, events, sent, storage }
}

test('新单分派成功后关闭窗口并刷新工作台', async () => {
  const screen = await mount(async () => ({ oaResult: { status: 'SUCCESS' } }))
  try {
    await screen.state.publish()
    assert.deepEqual(screen.sent[0].oaFormItemIds, [6])
    assert.equal(screen.sent[0].assigneeUserId, 888)
    assert.deepEqual(screen.events.slice(-2), [['open', false], ['refresh']])
    assert.equal(screen.storage.size, 0)
    assert.equal(screen.state.busy, false)
  } finally { screen.app.unmount() }
})

for (const result of [new Error('分派失败'), { oaResult: { status: 'REJECTED', message: 'OA 拒绝' } }, { oaResult: { status: 'UNKNOWN', message: '结果待确认' } }]) {
  test(`分派未成功时保留窗口及技术员：${result.message || result.oaResult.status}`, async () => {
    const screen = await mount(async () => { if (result instanceof Error) throw result; return result })
    try {
      await screen.state.publish()
      assert.equal(screen.events.some(event => event[0] === 'open'), false)
      assert.equal(screen.state.assignee, 888)
      assert.ok(screen.state.error)
      assert.equal(screen.state.busy, false)
    } finally { screen.app.unmount() }
  })
}
