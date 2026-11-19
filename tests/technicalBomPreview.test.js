import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse, compileScript } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { findModule, isTechnicalModuleStatusOnly } from '../src/utils/technicalDataWorkbench.js'
import { bomEntryModule } from '../src/utils/technicalBomWorkbench.js'
import { technicalBomQuantity } from '../src/utils/technicalBomQuantity.js'

const entry = parse(readFileSync(new URL('../src/views/technical-data/tasks/index.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(entry, { sourceType: 'module' }).program.body
const actions = ['isUnassigned', 'moduleAction', 'open', 'openBom'].map(name => {
  const node = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  return entry.slice(node.start, node.end)
}).join('\n')
function workbench(overview = true) {
  const calls = [], preview = Vue.ref(null), inspection = Vue.ref(null)
  const deps = { canViewSupplementOverview: Vue.ref(overview), canManage: Vue.ref(overview), submissionBusy: Vue.ref(false),
    findModule, isTechnicalModuleStatusOnly, bomEntryModule, entryPreview: preview, inspectRow: inspection,
    inspectModule: Vue.ref(''), router: { push: value => calls.push(value) }, persistState() {},
    openPanel: (taskId, module) => calls.push({ taskId, module }) }
  return { ...new Function(...Object.keys(deps), `${actions}; return { openBom }`)(...Object.values(deps)), calls, preview, inspection }
}
function row() {
  return { taskId: null, taskStatus: 'UNASSIGNED', oaNo: 'BOM-PREVIEW', accountingMonth: '2026-11',
    assignedModules: [], editableModules: [], product: { id: null, oaFormItemId: 12, modules: [
      { moduleType: 'DRAWING_BOM', required: true, moduleStatus: 'PENDING', requirementReasonCode: 'DRAWING_SOURCE_MISSING' },
    ] } }
}
test('unassigned BOM opens the same read-only entry preview as other missing modules without creating a task', async () => {
  const h = workbench(), value = row()
  await h.openBom(value)
  assert.deepEqual(h.preview.value, { row: value, module: 'DRAWING_BOM' })
  assert.equal(h.inspection.value, null)
  assert.deepEqual(h.calls, [])
})
test('existing BOM tasks and shared submitted sources retain their original task identity', async () => {
  const h = workbench(), value = row()
  value.taskId = 34; value.taskStatus = 'SUBMITTED'; value.product.modules[0].currentVersionId = 56
  await h.openBom(value)
  assert.deepEqual(h.calls, [{ taskId: 34, module: 'DRAWING_BOM' }])
  assert.equal(value.product.modules[0].currentVersionId, 56)
  assert.equal(h.preview.value, null)
  value.product.modules[0].sourceReference = 'TECH_SHARED:78::'
  await h.openBom(value)
  assert.deepEqual(h.calls[1], { taskId: '78', module: 'DRAWING_BOM' })
})
test('available drawing still opens its existing source and unrelated assignees gain no BOM entry', async () => {
  const h = workbench(), value = row()
  Object.assign(value.product.modules[0], { required: false, requirementReasonCode: 'DRAWING_SOURCE_AVAILABLE' })
  await h.openBom(value)
  assert.equal(h.calls[0].query.drawingBom, '1')
  assert.equal(h.preview.value, null)
  const other = workbench(false)
  await other.openBom(value)
  assert.deepEqual(other.calls, [])
  assert.equal(other.preview.value, null)
})

const { descriptor } = parse(readFileSync(new URL('../src/components/technical-data/TechnicalCompleteBomForm.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'complete-bom-preview' }).content
  .replace(/^import .+ from .+$/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
function mount(props, responses = {}) {
  const calls = []
  const deps = { ...Vue, technicalBomQuantity, ElMessage: { success() {} }, ElMessageBox: { confirm: async () => {} } }
  for (const name of ['searchTechnicalBomReferences', 'fetchTechnicalBomReference', 'checkTechnicalBomReference', 'searchTechnicalBomReplacements', 'searchQuoteBomPreviewReplacements', 'searchQuoteBomPreviewReferences', 'fetchQuoteBomPreviewReference', 'checkQuoteBomPreviewReference', 'uploadQuoteBomPreview', 'downloadQuoteBomPreviewTemplate', 'previewTechnicalBomUpload', 'saveTechnicalBom', 'downloadTechnicalBom']) {
    deps[name] = async (...args) => { calls.push({ name, args }); return responses[name] ?? { ...props.state, rowVersion: 2 } }
  }
  const component = new Function(...Object.keys(deps), script)(...Object.values(deps))
  component.render = () => null
  const app = renderer.createApp(component, props)
  return { app, state: app.mount({}).$.setupState, calls }
}
const target = { code: '001', name: '待补产品', model: 'MODEL-1', specification: 'SPEC-1' }
test('read-only BOM preview switches both modes, shows the actual target and cannot save', async () => {
  const h = mount({ state: { editable: true, target }, allowed: true, preview: true })
  try {
    assert.deepEqual(h.state.product, target)
    assert.equal(h.state.mode, 'REFERENCE')
    assert.equal(h.state.editable, false)
    await h.state.choose('UPLOAD')
    assert.equal(h.state.mode, 'UPLOAD')
    await h.state.choose('REFERENCE')
    assert.equal(h.state.mode, 'REFERENCE')
    assert.equal(h.state.columns.length, 11)
    assert.equal(await h.state.save(), false)
    assert.deepEqual(h.calls, [])
  } finally { h.app.unmount() }
})
test('submitted BOM keeps the saved input quantities, target and selected source without preview mode', async () => {
  const saved = { editable: false, historical: true, target, versionId: 56, bom: {
    entryMode: 'UPLOAD', product: target, upload: { fileName: '原BOM.xlsx', sha256: 'saved-file' },
    nodes: [{ input: { hierarchy: '1', materialCode: '0000123', quantity: '0.000000010000', unit: 'kg' } }],
  } }
  const original = JSON.stringify(saved), h = mount({ productId: 34, state: saved, allowed: false })
  try {
    assert.equal(h.state.mode, 'UPLOAD')
    assert.equal(h.state.file.fileName, '原BOM.xlsx')
    assert.equal(h.state.rows[0].materialCode, '0000123')
    assert.equal(h.state.rows[0].quantity, '0.000000010000')
    assert.equal(h.state.saved, true)
    assert.equal(await h.state.save(), false)
    assert.deepEqual(h.calls, [])
    assert.equal(JSON.stringify(saved), original)
  } finally { h.app.unmount() }
})
test('admin preview queries the selected quote item and month with the same reference rows but cannot save', async () => {
  const candidate = { code: 'REF-001', name: '参考成品', model: 'REF-MODEL' }
  const response = { product: target, reference: { productCode: 'REF-001', fingerprint: 'source' },
    rows: [{ hierarchy: '1', materialCode: '000123', quantity: '0.000001' }], issues: [] }
  const h = mount({ state: { editable: false, target }, preview: true, previewContext: { itemId: 12, accountingMonth: '2026-10' } },
    { searchQuoteBomPreviewReferences: [candidate], fetchQuoteBomPreviewReference: response, checkQuoteBomPreviewReference: { ...response, issues: [] } })
  try {
    h.state.keyword = 'REF-001'
    await h.state.search()
    assert.deepEqual(h.state.matches, [candidate])
    await h.state.selectReference(candidate)
    assert.deepEqual(h.state.rows, response.rows)
    assert.equal(h.state.reference.productCode, 'REF-001')
    assert.equal(h.state.saved, false)
    h.state.rows[0].quantity = '6'; h.state.changed()
    await h.state.checkInputs()
    assert.equal(h.state.previewChecked, true)
    assert.equal(await h.state.save(), false)
    assert.deepEqual(h.calls, [
      { name: 'searchQuoteBomPreviewReferences', args: [12, '2026-10', 'REF-001'] },
      { name: 'fetchQuoteBomPreviewReference', args: [12, '2026-10', 'REF-001'] },
      { name: 'checkQuoteBomPreviewReference', args: [12, '2026-10', { entryMode: 'REFERENCE', referenceCode: 'REF-001',
        referenceFingerprint: 'source', quantities: { 1: '6' } }] },
    ])
    await h.state.choose('UPLOAD')
    assert.deepEqual(h.state.rows, [])
  } finally { h.app.unmount() }
})
test('ordinary read-only preview cannot call either reference API even through component methods', async () => {
  const h = mount({ state: { editable: false, target }, preview: true })
  try {
    await h.state.search()
    await h.state.selectReference({ code: 'REF-001' })
    await h.state.upload({ raw: 'file' })
    await h.state.searchExamples()
    await h.state.downloadTemplate({ code: 'REF-001' })
    assert.deepEqual(h.calls, [])
  } finally { h.app.unmount() }
})
test('admin upload checks use the preview endpoint and never retain or save a technical draft', async () => {
  const response = { product: target, rows: [{ hierarchy: '1', quantity: '4' }], upload: { fileName: 'BOM.xlsx' }, issues: [] }
  const h = mount({ state: { editable: false, target }, preview: true, previewContext: { itemId: 12, accountingMonth: '2026-10' } },
    { uploadQuoteBomPreview: response, searchQuoteBomPreviewReferences: [{ code: 'REF' }] })
  try {
    await h.state.choose('UPLOAD')
    h.state.exampleKeyword = 'REF'
    await h.state.searchExamples(); await h.state.downloadTemplate({ code: 'REF' })
    await h.state.upload({ raw: 'test-file' })
    assert.deepEqual(h.state.rows, response.rows)
    assert.equal(h.state.previewChecked, true)
    assert.equal(h.state.saved, false)
    assert.equal(await h.state.save(), false)
    assert.deepEqual(h.calls.map(call => call.name), ['searchQuoteBomPreviewReferences', 'downloadQuoteBomPreviewTemplate', 'uploadQuoteBomPreview'])
  } finally { h.app.unmount() }
})
test('invalid trial quantities fail visibly before a check and never show a successful check', async () => {
  const h = mount({ state: { editable: false, target }, preview: true, previewContext: { itemId: 12, accountingMonth: '2026-10' } })
  try {
    h.state.reference = { productCode: 'REF', fingerprint: 'f' }
    h.state.rows = [{ hierarchy: '1', quantity: '-1' }]
    await h.state.checkInputs()
    assert.match(h.state.error, /非负数字/)
    assert.equal(h.state.previewChecked, false)
    assert.deepEqual(h.calls, [])
  } finally { h.app.unmount() }
})
test('editable reference BOM still saves quantities with its original identity and optimistic version', async () => {
  const h = mount({ productId: 34, allowed: true, state: { editable: true, rowVersion: 1, target, bom: {
    entryMode: 'REFERENCE', product: target, reference: { productCode: 'REF-1', fingerprint: 'original-source' },
    nodes: [{ input: { hierarchy: '1', quantity: '2' } }],
  } } })
  try {
    h.state.rows[0].quantity = '3'; h.state.changed()
    assert.equal(await h.state.save(), true)
    assert.deepEqual(h.calls, [{ name: 'saveTechnicalBom', args: [34, { expectedVersion: 1, entryMode: 'REFERENCE',
      referenceCode: 'REF-1', referenceFingerprint: 'original-source', quantities: { 1: '3' } }] }])
  } finally { h.app.unmount() }
})


test('exact model replacement refreshes the affected branch and saves its edited child quantity', async () => {
  const reference = { productCode: 'REF', fingerprint: 'original-source' }
  const newRoot = { hierarchy: '1', materialCode: 'NEW', model: 'NEW-MODEL', quantity: '2' }
  const newChild = { hierarchy: '1.1', materialCode: 'NEW-CHILD', quantity: '3' }
  const h = mount({ productId: 34, state: { editable: true, rowVersion: 1, target, bom: {
    entryMode: 'REFERENCE', reference, product: target,
    nodes: [{ input: { hierarchy: '1', materialCode: 'OLD', quantity: '2' } },
      { input: { hierarchy: '1.1', materialCode: 'OLD-CHILD', quantity: '9' } }],
  } }, allowed: true }, {
    searchTechnicalBomReplacements: [{ code: 'NEW', model: 'NEW-MODEL' }],
    checkTechnicalBomReference: { product: target, reference, rows: [newRoot, newChild], issues: [] },
  })
  try {
    h.state.openReplacement(h.state.rows[0])
    h.state.replacementKeyword = 'NEW-MODEL'
    await h.state.searchReplacement()
    assert.deepEqual(h.state.rows.map(row => row.materialCode), ['NEW', 'NEW-CHILD'])
    assert.deepEqual(h.calls[1].args[1].quantities, { 1: '2' })
    h.state.rows[1].quantity = '5'
    assert.equal(await h.state.save(), true)
    assert.deepEqual(h.calls[2].args[1].quantities, { 1: '2', '1.1': '5' })
    assert.deepEqual(h.calls[2].args[1].replacements, { 1: 'NEW' })
  } finally { h.app.unmount() }
})
