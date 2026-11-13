import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
const source = parse(readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const ref = value => ({ value })
function actual(name, deps) {
  const node = declarations.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  return new Function(...Object.keys(deps), `${source.slice(node.start, node.end)}; return ${name}`)(...Object.values(deps))
}
function harness(overrides = {}) {
  const calls = [], node = { materialCode: 'A', priceOrgCode: '210', multiPriceSource: true, shapeSelectionVersion: 3 }
  const deps = { shapeSaving: ref(false), historyViewMode: ref(false), canSelectAlternative: ref(true),
    oaNo: ref('OA'), itemId: ref(4), presentedEffectiveBom: ref({ costPeriodMonth: '2026-10', effectiveVariantHash: 'HASH' }),
    workbench: ref({ periodMonth: '2026-11' }), effectiveBomPreview: ref({}), effectiveBom: ref(null),
    selectQuoteMaterialShape: async (...args) => { calls.push(['save', ...args]); return { nodes: [] } },
    normalizeQuoteEffectiveBom: x => x, loadWorkbench: async () => calls.push(['reload']),
    submitProductCosting: async reason => calls.push(['cost', reason]),
    loadEffectiveBom: async () => calls.push(['bom']),
    ElMessage: { success: () => {}, error: message => calls.push(['error', message]) }, ...overrides }
  return { calls, deps, node, save: actual('saveMaterialShape', deps) }
}
test('shape selection saves quote/month/org/version and recalculates only after saving', async () => {
  const h = harness(); await h.save(h.node, 'OUTSOURCE')
  assert.deepEqual(h.calls, [['save', 'OA', 4, { periodMonth: '2026-10', materialCode: 'A', organization: '210',
    selectedShape: 'OUTSOURCE', expectedVersion: 3, expectedVariantHash: 'HASH' }], ['reload'], ['cost', 'MATERIAL_SHAPE_CHANGED']])
  assert.equal(h.deps.shapeSaving.value, false)
  assert.equal(h.deps.effectiveBomPreview.value, null)
})
test('history, permission denial and noncatalog materials cannot switch or calculate', async () => {
  for (const key of ['history', 'permission', 'catalog', 'busy']) {
    const h = harness()
    if (key === 'history') h.deps.historyViewMode.value = true
    if (key === 'permission') h.deps.canSelectAlternative.value = false
    if (key === 'catalog') h.node.multiPriceSource = false
    if (key === 'busy') h.deps.shapeSaving.value = true
    await h.save(h.node, 'PURCHASE'); assert.deepEqual(h.calls, [])
  }
})
test('conflicting selection refreshes BOM and never starts costing', async () => {
  const h = harness({ selectQuoteMaterialShape: async () => { throw new Error('版本已变化') } })
  await h.save(h.node, 'PURCHASE')
  assert.deepEqual(h.calls, [['error', '版本已变化'], ['bom']]); assert.equal(h.deps.shapeSaving.value, false)
})
test('sheet material click expands ancestors and selects the matching tree node', async () => {
  const calls = [], nodes = [{ nodeKey: 'root', materialCode: 'P' }, { nodeKey: 'a', parentNodeKey: 'root', materialCode: 'A' }]
  const deps = { historyViewMode: ref(false), canSelectAlternative: ref(true), activeTab: ref('COST_RUN'),
    presentedEffectiveBom: ref({ nodes }), loadEffectiveBom: async () => {}, nextTick: async () => {},
    bomTreeRef: ref({ getNode: key => ({ expand: () => calls.push(['expand', key]) }), setCurrentKey: key => calls.push(['select', key]) }),
    document: { querySelector: () => ({ scrollIntoView: () => calls.push(['scroll']) }) }, ElMessage: { warning: () => {} } }
  await actual('editShapeFromSheet', deps)({ code: 'A', multiPriceSource: true })
  assert.equal(deps.activeTab.value, 'PRODUCT_DETAIL'); assert.deepEqual(calls, [['expand', 'root'], ['select', 'a'], ['scroll']])
  deps.bomTreeRef.value = [null, deps.bomTreeRef.value];calls.length = 0
  await actual('editShapeFromSheet', deps)({ code: 'A', multiPriceSource: true })
  assert.deepEqual(calls, [['expand', 'root'], ['select', 'a'], ['scroll']])
})
test('saved tree lookup uses displayed version rather than current BOM', async () => {
  const calls = [], deps = { costRun: ref({ sheet: { identity: { versionId: 9 } } }), oaNo: ref('OA'), itemId: ref(4),
    fetchSavedPricingBom: async (...args) => { calls.push(args); return { nodes: [{ nodeKey: 'old' }] } },
    savedPricingBomTree: ref([]), savedPricingBomVisible: ref(false), buildQuoteEffectiveBomTree: rows => rows,
    ElMessage: { info: () => {}, error: message => { throw new Error(message) } } }
  await actual('openSavedPricingBom', deps)(); assert.deepEqual(calls, [['OA', 4, 9]])
  assert.equal(deps.savedPricingBomTree.value[0].nodeKey, 'old'); assert.equal(deps.savedPricingBomVisible.value, true)
})
