import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse, compileScript } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { findModule, moduleName, technicalModuleSummary } from '../src/utils/technicalDataWorkbench.js'
import { drawingReceipt } from '../src/utils/drawingPreparation.js'
import { drawingColumns, drawingText } from '../src/utils/drawingVerification.js'

const descriptor = parse(readFileSync(new URL('../src/components/technical-data/TechnicalDataEntryPreview.vue', import.meta.url), 'utf8')).descriptor
const imports = babelParse(descriptor.scriptSetup.content, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ImportDeclaration').flatMap(node => node.specifiers.map(s => s.local.name))
const script = compileScript(descriptor, { id: 'received-bom-preview' }).content
  .replace(/^import .* from .*$/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
const row = (itemId = 188) => ({ oaNo: 'FI-SR-005-20261116-0003', accountingMonth: '2026-11', product: {
  id: null, oaFormItemId: itemId, materialNo: '1008900032106', productName: '热力膨胀阀',
  modules: [{ moduleType: 'DRAWING_BOM', required: true, sourceAvailability: 'MISSING', requirementReasonCode: 'U9_ORIGINAL_NOT_FOUND' }],
} })
const response = state => ({ editable: false, target: { code: '1008900032106' }, source: { state, message: '当前来源结论' } })
function mount(fetchSource, props = {}) {
  const calls = []
  const deps = { ...Object.fromEntries(imports.map(name => [name, {}])), ...Vue,
    findModule, moduleName, drawingReceipt, drawingColumns, drawingText,
    useTechnicalDataIdentity: () => ({ roles: ['admin'], permissions: ['*:*:*'] }),
    fetchQuoteBomPreviewSource: async (...args) => { calls.push(args); return fetchSource(...args) },
  }
  const component = new Function(...Object.keys(deps), script)(...Object.values(deps))
  component.render = () => null
  const input = Vue.reactive({ row: row(), moduleType: 'DRAWING_BOM', ...props })
  let vm
  const app = renderer.createApp({ setup: () => () => Vue.h(component, { ...input, ref: value => { vm = value } }) })
  app.mount({})
  return { app, input, calls, get state() { return vm.$.setupState } }
}
const flush = async () => { await Vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick() }

test('received drawing with failed import checks current source instead of opening the empty complete-BOM form', async () => {
  const h = mount(() => response('UNCONFIRMED'))
  try {
    await flush()
    assert.deepEqual(h.calls, [[188, '2026-11']])
    assert.equal(h.state.bomAllowsEntry, false)
    assert.equal(h.state.bomPreviewState.source.state, 'UNCONFIRMED')
  } finally { h.app.unmount() }
})
test('only confirmed absence enables reference/upload; existing U9 and gallery remain source views', async () => {
  for (const source of ['MISSING', 'U9', 'GALLERY', 'UNCONFIRMED']) {
    const h = mount(() => response(source))
    try { await flush(); assert.equal(h.state.bomAllowsEntry, source === 'MISSING') }
    finally { h.app.unmount() }
  }
})
test('source request failure or malformed response never enables upload/reference', async () => {
  for (const fetch of [() => { throw Error('来源读取超时') }, () => ({})]) {
    const h = mount(fetch)
    try { await flush(); assert.equal(h.state.bomAllowsEntry, false); assert.ok(h.state.error) }
    finally { h.app.unmount() }
  }
})
test('a previous product response cannot overwrite the newly opened product or clear its loading state', async () => {
  const pending = []
  const h = mount(() => new Promise(resolve => pending.push(resolve)))
  try {
    h.input.row = row(189); await flush()
    pending[0](response('MISSING')); await flush()
    assert.equal(h.state.bomAllowsEntry, false); assert.equal(h.state.loading, true)
    pending[1](response('GALLERY')); await flush()
    assert.equal(h.state.bomPreviewState.source.state, 'GALLERY')
    assert.equal(h.state.loading, false)
  } finally { h.app.unmount() }
})
test('received rows are shown only for the current quote item and month, without changing stored task status', async () => {
  const h = mount(() => response('UNCONFIRMED'))
  try {
    await flush()
    const rows = [{ no: '1', code: 'RFK-A04-005224', name: '感温部件', qty: '1' }]
    const state = { oaNo: row().oaNo, itemId: 188, accountingMonth: '2026-11', current: { taskState: 'RECEIVED',
      localTaskId: 49, currentResultId: 45, consumedResultId: null, consumptionState: 'FAILED', drawingNo: 'DRAWING' },
      sourceReceipt: { rows, receivedDetailCount: 1, productGroupResolved: true, drawingNo: 'DRAWING' } }
    const original = JSON.stringify(state)
    h.state.drawingChanged(state)
    assert.deepEqual(h.state.receivedRows, rows)
    assert.equal(JSON.stringify(state), original)
    h.state.drawingChanged({ ...state, itemId: 189 })
    assert.deepEqual(h.state.receivedRows, [])
    h.state.drawingChanged({ ...state, accountingMonth: '2026-10' })
    assert.deepEqual(h.state.receivedRows, [])
  } finally { h.app.unmount() }
})
test('saved missing-BOM status does not falsely claim that the drawing library has no details', () => {
  assert.doesNotMatch(technicalModuleSummary(row().product, 'DRAWING_BOM'), /尚无电子图库|没有电子图库/)
})
