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
  const deps = { generation: 1, props: { oaNo: 'OA', busy: false }, canEdit: ref(true), saving: ref(false), refreshing: ref(false), refreshRequired: ref(false), error: ref(''), changes: ref([selection]), incomplete: ref(false),
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

const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function loadingHarness() {
  const read = pending(), discover = pending(), drafts = {}, calls = []
  const deps = { generation: 0, props: { oaNo: 'OA' }, saving: ref(false), refreshing: ref(false),
    loading: ref(false), refreshRequired: ref(false), hasView: ref(false), error: ref(''), drafts,
    view: ref({ rows: [], problems: [], fingerprint: null }), clearDrafts: () => Object.keys(drafts).forEach(k => delete drafts[k]),
    fetchQuoteOrderMaterialShapes: () => { calls.push('read'); return read.promise },
    prepareQuoteOrderMaterialShapes: () => { calls.push('discover'); return discover.promise } }
  const install = declarations.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'installView')
  if (install) deps.installView = actual('installView', deps)
  return { ...deps, read, discover, calls, load: actual('load', deps) }
}
const shapeView = (fingerprint, codes = ['A']) => ({ fingerprint, rows: codes.map(materialCode => ({ materialCode })), problems: [] })
const flush = () => new Promise(resolve => setImmediate(resolve))
test('existing shapes become visible before source discovery finishes, and new sources still appear', async () => {
  const h = loadingHarness(), loading = h.load()
  h.read.resolve(shapeView('existing')); await flush()
  assert.equal(h.loading.value, false)
  assert.equal(h.view.value.rows[0]?.materialCode, 'A')
  assert.equal(h.refreshing.value, true)
  h.discover.resolve(shapeView('discovered', ['A', 'B'])); await loading
  assert.equal(h.view.value.rows.length, 2)
  assert.deepEqual(h.calls, ['read', 'discover'])
  assert.equal(h.refreshing.value, false)
})
test('an empty saved list still discovers previously unlisted materials', async () => {
  const h = loadingHarness(), loading = h.load()
  h.read.resolve(shapeView('empty', [])); await flush()
  h.discover.resolve(shapeView('new', ['B'])); await loading
  assert.deepEqual(h.view.value.rows.map(r => r.materialCode), ['B'])
})
test('drafts survive background refresh; changed fingerprints require reload before save', async () => {
  for (const changed of [false, true]) {
    const h = loadingHarness(), loading = h.load()
    h.read.resolve(shapeView('original')); await flush(); h.drafts.A = 'PURCHASE'
    h.discover.resolve(shapeView(changed ? 'changed' : 'original')); await loading
    assert.equal(h.drafts.A, 'PURCHASE')
    assert.equal(h.view.value.fingerprint, 'original')
    assert.equal(h.refreshRequired.value, changed)
    assert.equal(Boolean(h.error.value), changed)
  }
})
test('failed discovery preserves rows and drafts but blocks saving an unrefreshed view', async () => {
  const h = loadingHarness(), loading = h.load()
  h.read.resolve(shapeView('original')); await flush(); h.drafts.A = 'PURCHASE'
  h.discover.reject(Error('offline')); await loading
  assert.equal(h.view.value.rows.length, 1); assert.equal(h.drafts.A, 'PURCHASE')
  assert.equal(h.refreshRequired.value, true); assert.equal(h.refreshing.value, false)
})
test('discovery recovers from an initial read failure', async () => {
  const h = loadingHarness(), loading = h.load()
  h.read.reject(Error('read failed')); await flush()
  h.discover.resolve(shapeView('discovered')); await loading
  assert.equal(h.view.value.fingerprint, 'discovered'); assert.equal(h.error.value, '')
})
test('concurrent refresh is deduplicated and a response for another order cannot replace the view', async () => {
  const h = loadingHarness(), loading = h.load()
  await h.load(); assert.deepEqual(h.calls, ['read'])
  h.props.oaNo = 'OTHER'; h.read.resolve(shapeView('old')); await loading
  assert.equal(h.view.value.rows.length, 0); assert.deepEqual(h.calls, ['read'])
})
test('save cannot race discovery or bypass a changed-source conflict', async () => {
  for (const blocked of ['refreshing', 'refreshRequired']) {
    const h = harness(); h.deps[blocked].value = true; await h.save()(true)
    assert.deepEqual(h.calls, [])
  }
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
  assert.equal(actualChanges.value.length, 0)
  drafts.A = 'OUTSOURCE'
  assert.equal(actualChanges.value[0].selectedShape, 'OUTSOURCE')
  assert.equal(Object.hasOwn(actualChanges.value[0], 'selectedSourceType'), false)
})

test('a shape save does not require or send a quotation price-source selection', async () => {
  const h = harness(); h.deps.incomplete.value = true
  await h.save()(false)
  assert.equal(h.calls[0][0], 'save')
  assert.equal(Object.hasOwn(h.calls[0][2].selections[0], 'selectedSourceType'), false)
})
test('quotation staff, directors and administrators can edit shapes; read-only and unrelated viewers cannot', () => {
  const declaration = declarations.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === 'canEdit')
  for (const role of ['bu_staff', 'bu_director', 'admin', 'viewer']) {
    for (const readonly of [false, true]) {
      const result = new Function('computed', 'props', 'user', 'permitted', `return ${source.slice(declaration.init.start, declaration.init.end)}`)(
        fn => ({ value: fn() }), { readonly }, { roles: [role] }, () => false)
      assert.equal(result.value, !readonly && role !== 'viewer')
    }
  }
})
