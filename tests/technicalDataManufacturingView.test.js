import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
import { computed, reactive, ref as vueRef } from 'vue'
import { findModule, isTechnicalModuleStatusOnly } from '../src/utils/technicalDataWorkbench.js'

const source = parse(readFileSync(new URL('../src/views/technical-data/tasks/index.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const functions = ['isUnassigned', 'moduleAction', 'open'].map(name => {
  const node = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  return source.slice(node.start, node.end)
}).join('\n')
const ref = value => ({ value })
function harness(overview = true) {
  const calls = [], entryPreview = ref(null), inspectRow = ref(null)
  const deps = { canViewSupplementOverview: ref(overview), canManage: ref(overview), submissionBusy: ref(false),
    findModule, isTechnicalModuleStatusOnly, entryPreview, inspectRow, inspectModule: ref(''),
    router: { push: route => calls.push(route) }, persistState: () => {},
    openPanel: (taskId, module) => calls.push({ taskId, module }) }
  const actions = new Function(...Object.keys(deps), `${functions}; return { moduleAction, open }`)(...Object.values(deps))
  return { ...actions, entryPreview, inspectRow, calls }
}
const row = () => ({ taskId: null, taskStatus: 'UNASSIGNED', oaNo: 'OA-1', accountingMonth: '2026-10',
  assignedModules: [], editableModules: [], product: { id: null, oaFormItemId: 991397, modules: [
    { moduleType: 'MANUFACTURING', required: true, moduleStatus: 'PENDING', sourceAvailability: 'MISSING' },
  ] } })

test('unassigned manufacturing opens the read-only detail form instead of a gap explanation', async () => {
  const h = harness(), product = row()
  assert.equal(h.moduleAction(product, 'MANUFACTURING'), '查看明细')
  await h.open(product, 'MANUFACTURING')
  assert.deepEqual(h.entryPreview.value, { row: product, module: 'MANUFACTURING' })
  assert.equal(h.inspectRow.value, null)
  assert.deepEqual(h.calls, [])
})

test('submitted manufacturing opens its existing task and version view', async () => {
  const h = harness(), product = row()
  Object.assign(product, { taskId: 123, taskStatus: 'SUBMITTED' })
  Object.assign(product.product.modules[0], { moduleStatus: 'SUBMITTED', currentVersionId: 456 })
  await h.open(product, 'MANUFACTURING')
  assert.deepEqual(h.calls, [{ taskId: 123, module: 'MANUFACTURING' }])
  assert.equal(h.entryPreview.value, null)
})

test('assigned technician retains editing access and unassigned modules remain hidden', async () => {
  const h = harness(false), product = row()
  assert.equal(h.moduleAction(product, 'MANUFACTURING'), '')
  Object.assign(product, { taskId: 123, taskStatus: 'PENDING', assignedModules: ['MANUFACTURING'], editableModules: ['MANUFACTURING'] })
  assert.equal(h.moduleAction(product, 'MANUFACTURING'), '填写原材料')
  await h.open(product, 'MANUFACTURING')
  assert.deepEqual(h.calls, [{ taskId: 123, module: 'MANUFACTURING' }])
})

const formSource = parse(readFileSync(new URL('../src/components/technical-data/TechnicalDataManufacturingForm.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const formDeclarations = babelParse(formSource, { sourceType: 'module' }).program.body
function formHarness(props, response) {
  const calls = [], state = vueRef(null), draft = reactive({})
  const deps = { props, state, draft, computed, loading: vueRef(false), saving: vueRef(false), error: vueRef(''),
    options: reactive({}), lookupErrors: reactive({}), emit: () => {}, ElMessage: { success: () => {} },
    fetchQuoteTechnicalDataManufacturing: async (...args) => { calls.push(['quote', ...args]); return response },
    fetchTechnicalDataManufacturing: async (...args) => { calls.push(['product', ...args]); return response },
    saveTechnicalDataManufacturing: async (...args) => { calls.push(['save', ...args]); return { ...response, issues: [] } } }
  const body = formDeclarations.filter(node =>
    node.type === 'FunctionDeclaration' && ['install', 'load', 'save', 'displayValue', 'netWeightGrams'].includes(node.id.name)
    || node.type === 'VariableDeclaration' && ['canEdit', 'editableRows'].includes(node.declarations[0].id.name)
  ).map(node => formSource.slice(node.start, node.end)).join('\n')
  const methods = new Function(...Object.keys(deps), `${body}; return { load, save, canEdit, editableRows, displayValue, netWeightGrams }`)(...Object.values(deps))
  return { ...methods, calls, state, draft }
}

test('quote manufacturing details use the quote item and month, with no write even if edit is requested', async () => {
  const h = formHarness({ quoteItemId: 991397, accountingMonth: '2026-10', editable: true }, {
    editable: true, historical: false, source: { sourceVersionId: 911011, nodes: [
      { sourceNodeId: 12, state: 'MISSING_RAW', name: '接管', parentMaterialNo: '9990000051108' },
    ] }, saved: null,
  })
  await h.load()
  assert.equal(h.editableRows.value[0].name, '接管')
  assert.equal(h.displayValue(h.draft[12].netLengthMm), '尚未填写')
  assert.equal(h.displayValue(h.draft[12].grossWeightKg), '尚未填写')
  assert.equal(h.displayValue(0), 0)
  assert.equal(h.canEdit.value, false)
  await h.save(false)
  assert.deepEqual(h.calls, [['quote', 991397, '2026-10']])
})

test('submitted details render the saved material, length and weight from the selected version', async () => {
  const h = formHarness({ productId: 234, versionId: 456, editable: false }, {
    editable: false, historical: true, saved: { items: [{ parentSourceNodeId: '12', parentMaterialNo: '9990000051108',
      rawMaterialNo: '301050747', netLengthMm: 73, grossWeightKg: 0.0106172,
      evidence: { parentName: '接管', parentDrawingNo: 'T-JG-0478', parentQuantity: 1 } }] },
  })
  await h.load()
  assert.deepEqual(h.calls, [['product', 234, 456]])
  assert.equal(h.editableRows.value[0].drawingNo, 'T-JG-0478')
  assert.deepEqual(h.draft[12], { rawMaterialNo: '301050747', netLengthMm: 73, grossWeightKg: 0.0106172 })
  assert.equal(h.canEdit.value, false)
  await h.save(false)
  assert.equal(h.calls.length, 1)
})

test('single part net weight displays in grams for live and saved kilogram values', () => {
  const h = formHarness({}, {})
  assert.equal(h.netWeightGrams({ sourceNetWeight: 10.5, sourceNetWeightUnit: 'g' }), '10.5')
  assert.equal(h.netWeightGrams({ sourceNetWeight: '0.0105', sourceNetWeightUnit: 'kg' }), '10.5')
  assert.equal(h.netWeightGrams({ sourceNetWeight: '0.0093', sourceNetWeightUnit: '千克' }), '9.3')
  assert.equal(h.netWeightGrams({ sourceNetWeight: null }), '未提供')
  assert.equal(h.netWeightGrams({ sourceNetWeight: 10.5, sourceNetWeightUnit: null }), '单位未明确')
})


test('a matching manufactured component is filled from its saved sibling and saved with provenance', async () => {
  const h = formHarness({ productId: 15, editable: true }, {
    expectedVersion: 3, editable: true, historical: false, source: { sourceVersionId: 14, fingerprint: 'source-hash', nodes: [
      { sourceNodeId: 366, state: 'MISSING_RAW', name: '接管', parentMaterialNo: '9990000051108' },
      { sourceNodeId: 367, state: 'MISSING_RAW', name: '膜片', parentMaterialNo: '1064000300093' },
    ] }, saved: null, reusedItems: [{ parentSourceNodeId: 366, sourceProductId: 14, sourceProductCode: '1064100050088',
      rawMaterialNo: '301050747', netLengthMm: 1, grossWeightKg: 0.01067, sourceReference: 'TECH_MANUFACTURING:0088:7:348:hash' }],
  })
  await h.load()
  assert.equal(h.draft[366].rawMaterialNo, '301050747')
  assert.equal(h.draft[366].grossWeightKg, 0.01067)
  assert.equal(h.draft[367].rawMaterialNo, '')
  assert.deepEqual(h.calls, [['product', 15, undefined]]) // Opening is read-only.
  await h.save(false)
  const body = h.calls.find(call => call[0] === 'save')[2]
  assert.equal(body.expectedVersion, 3)
  assert.equal(body.sourceVersionId, 14)
  assert.deepEqual(body.items, [{ parentSourceNodeId: 366, rawMaterialNo: '301050747', netLengthMm: 1,
    grossWeightKg: 0.01067, reuseReference: 'TECH_MANUFACTURING:0088:7:348:hash' }])
})
