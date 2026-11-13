import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
const source = parse(readFileSync(new URL('../src/components/quotation/QuoteOrderMaterialShapes.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const ref = value => ({ value })
function actual(name, deps) {
  const node = declarations.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  return new Function(...Object.keys(deps), `${source.slice(node.start, node.end)}; return ${name}`)(...Object.values(deps))
}
function harness() {
  const calls = [], selection = { periodMonth: '2026-11', organization: '210', materialCode: 'A', selectedShape: 'PURCHASE', expectedVersion: 1 }
  const deps = { generation: 1, props: { oaNo: 'OA', busy: false }, canEdit: ref(true), saving: ref(false), error: ref(''), changes: ref([selection]), incomplete: ref(false),
    view: ref({ fingerprint: 'current', problems: [] }), clearDrafts: () => calls.push(['clear']),
    saveQuoteOrderMaterialShapes: async (...args) => { calls.push(['save', ...args]); return { changedMaterials: 1, affectedItemIds: [1, 2, 3] } },
    ElMessage: { success: () => {} }, emit: (...args) => calls.push(['emit', ...args]), load: async () => calls.push(['reload']) }
  return { calls, deps, save: () => actual('save', deps) }
}
test('one batch save uses OA identity and starts only one whole-order calculation after success', async () => {
  const h = harness(); h.deps.changes.value.push({ ...h.deps.changes.value[0], materialCode: 'B' })
  await h.save()(true)
  assert.equal(h.calls[0][0], 'save'); assert.equal(h.calls[0][1], 'OA')
  assert.equal(h.calls[0][2].selections.length, 2); assert.equal(h.calls[0][2].expectedFingerprint, 'current')
  assert.equal(h.calls.filter(c => c[0] === 'emit' && c[1] === 'cost').length, 1)
  assert.deepEqual(h.calls.at(-1), ['reload']); assert.equal(h.deps.saving.value, false)
})
test('save-only does not start costing, and stale conflicts preserve drafts and do not calculate', async () => {
  const h = harness(); await h.save()(false); assert.equal(h.calls.some(c => c[1] === 'cost'), false)
  h.calls.length = 0; h.deps.saveQuoteOrderMaterialShapes = async () => { throw Error('本单物料已变化') }
  await h.save()(true); assert.deepEqual(h.calls, []); assert.equal(h.deps.error.value, '本单物料已变化')
})
test('read-only and busy scopes cannot save', async () => {
  for (const mode of ['readonly', 'busy']) {
    const h = harness(); if (mode === 'readonly') h.deps.canEdit.value = false
    if (mode === 'busy') h.deps.props.busy = true
    await h.save()(true); assert.deepEqual(h.calls, [])
  }
})
test('original outsource cannot stage manufacture; restoring default is an explicit choice for legacy rows', () => {
  const drafts = {}, deps = { canEdit: ref(true), saving: ref(false), props: {}, drafts, view: ref({}), rowKey: r => r.materialCode }
  const set = actual('setShape', deps), row = { materialCode: 'A', allowedShapes: ['PURCHASE', 'OUTSOURCE'], selectedShape: null, legacySelection: true }
  set(row, 'MANUFACTURE'); assert.deepEqual(drafts, {})
  set(row, 'PURCHASE'); assert.equal(drafts.A, 'PURCHASE')
  set(row, 'DEFAULT'); assert.equal(drafts.A, 'DEFAULT')
  row.legacySelection = false; set(row, 'DEFAULT'); assert.deepEqual(drafts, {})
})

test('a shared material constrained by a purchased consumer cannot stage outsource or manufacture', () => {
  const drafts = {}, deps = { canEdit: ref(true), saving: ref(false), props: {}, drafts, view: ref({}), rowKey: r => r.materialCode }
  const set = actual('setShape', deps), row = { materialCode: 'A', allowedShapes: ['PURCHASE'], selectedShape: null }
  set(row, 'OUTSOURCE'); set(row, 'MANUFACTURE'); assert.deepEqual(drafts, {})
  set(row, 'PURCHASE'); assert.equal(drafts.A, 'PURCHASE')
})

test('another product missing its BOM does not block known materials in this order', async () => {
  const h = harness(); h.deps.view.value.problems.push({ itemId: 9 }); await h.save()(false)
  assert.equal(h.calls[0][0], 'save')
})

test('Vue tracks added and removed draft keys so batch choices enable the save buttons', async () => {
  const { computed, reactive } = await import('vue')
  const rows = [{ periodMonth: '2026-11', organization: '210', materialCode: 'A', version: 0 },
    { periodMonth: '2026-11', organization: '210', materialCode: 'B', version: 1 }]
  const declaration = declarations.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === 'changes')
  const drafts = reactive({}), sourceDrafts = reactive({}), rowKey = row => row.materialCode
  const actualChanges = new Function('computed', 'view', 'drafts', 'sourceDrafts', 'rowKey', `return ${source.slice(declaration.init.start, declaration.init.end)}`)(computed, ref({ rows }), drafts, sourceDrafts, rowKey)
  assert.equal(actualChanges.value.length, 0)
  drafts.A = 'PURCHASE'; drafts.B = 'DEFAULT'
  assert.deepEqual(actualChanges.value.map(row => row.selectedShape), ['PURCHASE', null])
  delete drafts.A; delete drafts.B; assert.equal(actualChanges.value.length, 0)
  rows[0].selectedShape = 'PURCHASE'; sourceDrafts.A = 'FIXED'
  assert.equal(actualChanges.value[0].selectedShape, 'PURCHASE'); assert.equal(actualChanges.value[0].selectedSourceType, 'FIXED')
})

function sourceHarness() {
  const deps = { canEdit: ref(true), saving: ref(false), props: {}, drafts: {}, sourceDrafts: {}, view: ref({ sourceSelectionSupported: true }), rowKey: row => row.materialCode }
  for (const name of ['currentShape', 'currentSource', 'sourceOptions', 'stageSource', 'setSource', 'setShape']) deps[name] = actual(name, deps)
  return deps
}
test('changing shape chooses a sole price source and resets the source when restoring BOM defaults', () => {
  const h = sourceHarness(), row = { materialCode: 'A', selectedShape: null, allowedShapes: ['PURCHASE', 'MANUFACTURE'], sources: [{ sourceType: 'MAKE' }, { sourceType: 'LINKED' }] }
  h.setShape(row, 'PURCHASE'); assert.equal(h.sourceDrafts.A, 'LINKED')
  h.setShape(row, 'MANUFACTURE'); assert.equal(h.sourceDrafts.A, 'MAKE')
  h.setShape(row, 'DEFAULT'); assert.equal(h.currentSource(row), null)
})
test('multiple external sources require an explicit choice and a source-only edit is staged', () => {
  const h = sourceHarness(), row = { materialCode: 'A', selectedShape: 'PURCHASE', selectedSourceType: 'FIXED', allowedShapes: ['PURCHASE'], sources: [{ sourceType: 'FIXED' }, { sourceType: 'LINKED' }] }
  h.setSource(row, 'LINKED'); assert.equal(h.sourceDrafts.A, 'LINKED'); assert.deepEqual(h.drafts, {})
  h.setSource(row, 'MAKE'); assert.equal(h.sourceDrafts.A, 'LINKED')
})
test('an incomplete price-source choice cannot save or enqueue costing', async () => {
  const h = harness(); h.deps.incomplete.value = true; await h.save()(true)
  assert.deepEqual(h.calls, []); assert.match(h.deps.error.value, /价格源/)
})
