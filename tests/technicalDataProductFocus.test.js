import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
const ref = value => ({ value })
function functions(path, names) {
  const source = parse(readFileSync(new URL(path, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const body = babelParse(source, { sourceType: 'module' }).program.body
  return names.map(name => { const node = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name); return source.slice(node.start, node.end) }).join('\n')
}
test('single-product supplement navigation carries exact item and accounting month', () => {
  const calls = [], router = { push: value => calls.push(value) }
  new Function('router', 'oaNo', 'itemId', 'displayedPeriodMonth', `${functions('../src/pages/QuoteProductCostingWorkbenchPage.vue', ['openProductSupplement'])};openProductSupplement()`)(router, ref('OA-1'), ref(19), ref('2026-11'))
  assert.deepEqual(calls, [{ path: '/collaboration/tasks', query: { oaNo: 'OA-1', oaFormItemId: '19', accountingMonth: '2026-11' } }])
})
function harness(focus) {
  const calls = [], deps = { generation: 0, loading: ref(false), accessDenied: ref(false), documentError: ref(''), persistState() {},
    route: { params: {} }, fixedSubmission: ref(''), isEntry: ref(false), scopedOaNo: ref(focus ? 'OA-1' : ''),
    scopedItemId: ref(focus ? '19' : ''), scopedMonth: ref(focus ? '2026-11' : ''),
    filters: { taskStatus: '', accountingMonth: '2026-10', keyword: '', current: 1 },
    records: ref([]), total: ref(0), summary: ref({}), canViewSupplementOverview: ref(false), selected: ref([]), personalDocuments: ref([]),
    fetchTechnicalDataProducts: async params => { calls.push(params); return { records: [{ product: { oaFormItemId: 19 } }], total: 1, summary: { total: 1 }, canViewSupplementOverview: true } },
    showErrorOnce: failure => { throw failure }, emptySummary: () => ({}) }
  const load = new Function(...Object.keys(deps), `${functions('../src/views/technical-data/tasks/index.vue', ['load'])};return load`)(...Object.values(deps))
  return { calls, deps, load }
}
test('focused view requests only the current product and ignores old global month filters', async () => {
  const h = harness(true); await h.load()
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].oaFormItemId, '19'); assert.equal(h.calls[0].accountingMonth, '2026-11'); assert.equal(h.calls[0].oaNo, 'OA-1')
  assert.equal(h.deps.records.value.length, 1); assert.equal(h.deps.loading.value, false)
})
test('ordinary workbench keeps all-products behavior and its selected month', async () => {
  const h = harness(false); await h.load()
  assert.equal(h.calls[0].oaFormItemId, undefined); assert.equal(h.calls[0].oaNo, undefined); assert.equal(h.calls[0].accountingMonth, '2026-10')
})
