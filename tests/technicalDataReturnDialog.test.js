import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as returnUtils from '../src/utils/technicalDataReturn.js'

const { descriptor } = parse(readFileSync(new URL('../src/components/technical-data/TechnicalDataReturnDialog.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'return-restart-test' }).content
  .replace(/import\s*\{([^}]+)\}\s*from 'vue'/, 'const {$1} = Vue')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')
  .replace('export default', 'return')
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
function fixture(status = 'RETURN_FAILED', actorId = 7) {
  const submitted = [], retries = [], errors = [], stored = new Map()
  const bindings = { Vue, ...returnUtils, createUuid: () => 'new-return-key',
    ElMessage: { success() {}, warning: message => errors.push(message) }, ElMessageBox: {},
    useUserStore: () => ({ userId: 7, businessUnitType: 'COMMERCIAL' }),
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    previewTechnicalDataReturn: async () => [
      { formId: 1, taskId: 2, taskVersion: 3, productNo: 'OLD', returnReason: '原退回原因', modules: [{ moduleType: 'PROFILE' }],
        lastReturn: { batchId: 'original', status, canRetry: status === 'RETURN_FAILED', actorId, step: 'REJECT', attempt: 2,
          oaResult: { errorCode: '1200504', message: '成本核算员已经操作' } } },
      { formId: 1, taskId: 3, taskVersion: 4, productNo: 'NEXT', modules: [{ moduleType: 'PROFILE' }] },
    ],
    submitTechnicalDataReturn: async request => { submitted.push(request); return { status: 'SUCCESS', batchId: 'next' } },
    retryTechnicalDataReturn: async (...args) => retries.push(args),
    fetchTechnicalDataReturn() {}, confirmTechnicalDataReturnPeople() {}, showErrorOnce: error => errors.push(error.message),
  }
  const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings)); component.render = () => null
  const app = renderer.createApp(component, { modelValue: true, taskIds: [2, 3] })
  const state = app.mount({}).$.setupState
  return { app, state, ready: state.load(), submitted, retries, errors }
}
test('明确失败后可以重新选择产品，创建新退回请求并保留原失败提示', async () => {
  const f = fixture()
  try {
    await f.ready; await settle(); assert.equal(f.state.locked, true); assert.equal(f.state.canRestart, true)
    assert.match(returnUtils.returnMessage(f.state.result), /1200504.*重新发起退回/)
    f.state.restart(); assert.equal(f.state.locked, false); assert.equal(f.state.result, null)
    assert.equal(f.submitted.length, 0)
    f.state.candidates[0].selected = false; f.state.candidates[1].reason = '核对第二个产品'
    await f.state.submit()
    assert.deepEqual(f.submitted, [{ requestKey: 'new-return-key', targets: [{ taskId: 3, expectedTaskVersion: 4, modules: ['PROFILE'], reason: '核对第二个产品' }] }])
    assert.deepEqual(f.retries, []); assert.deepEqual(f.errors, [])
  } finally { f.app.unmount() }
})
for (const status of ['UNKNOWN', 'SENDING', 'OA_ACCEPTED']) {
  test(`${status} 状态保持原请求，不能重新选择并发送`, async () => {
    const f = fixture(status)
    try {
      await f.ready; await settle(); assert.equal(f.state.canRestart, false); f.state.restart(); await f.state.submit()
      assert.equal(f.state.result.status, status); assert.deepEqual(f.submitted, [])
    } finally { f.app.unmount() }
  })
}
test('OA更换办理人后可重新选择产品，新请求由服务端核验当前办理身份', async () => {
  const f = fixture('RETURN_FAILED', 8)
  try {
    await f.ready; await settle(); assert.equal(f.state.canRestart, true)
    assert.equal(returnUtils.canReviseReturnReason(f.state.result, 7), false)
    f.state.restart(); assert.equal(f.state.result, null); assert.equal(f.state.locked, false)
  }
  finally { f.app.unmount() }
})
