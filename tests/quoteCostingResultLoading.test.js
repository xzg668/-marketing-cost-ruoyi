import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
import { computed } from 'vue'

// Exercise the page's actual loader with delayed reads: an unopened price tab must
// not hold the saved cost result or the calculation spinner hostage.
const source = parse(readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const loader = declarations
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'loadWorkbench')
const body = source.slice(loader.start, loader.end)
const ref = value => ({ value })
const pending = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

function pageComputed(name, deps) {
  const node = declarations.flatMap(node => node.declarations || []).find(node => node.id.name === name).init
  return new Function('computed', ...Object.keys(deps), `return ${source.slice(node.start, node.end)}`)(computed, ...Object.values(deps)).value
}

test('deferred input reads do not turn an already calculated product into a false BOM or price gap', () => {
  assert.equal(pageComputed('showDrawingBomPreview', {
    inputTabsNeedRefresh: ref(true), drawingBomAvailable: ref(true),
    presentedEffectiveBom: ref({ nodes: [] }),
  }), false)
  const deps = { costRun: ref({ canStartTrial: true }), inputTabsNeedRefresh: ref(true),
    pricePrepareReady: ref(false), costRunRepriceLocked: ref(false) }
  assert.equal(pageComputed('canStartCostRun', deps), true)
  deps.costRun.value.canStartTrial = false
  assert.equal(pageComputed('canStartCostRun', deps), false, 'real server blockage still wins')
})

function harness(overrides = {}) {
  const calls = []
  const record = name => async () => { calls.push(name) }
  const deps = {
    oaNo: ref('OA-1'), itemId: ref('1'), loading: ref(false),
    workbench: ref({ item: { id: 1 }, periodMonth: '2026-10' }),
    workbenchLoadError: ref(''), inputTabsNeedRefresh: ref(false),
    historyViewMode: ref(false), activeTab: ref('COST_RUN'),
    effectiveBom: ref({ state: 'READY', nodes: [{ id: 1 }] }),
    fetchQuoteCostingWorkbench: async () => ({ item: { id: 1 }, periodMonth: '2026-10' }),
    loadCostRun: record('cost'), loadActiveRepriceLock: record('lock'),
    clearEffectiveBom: record('clearBom'), loadEffectiveBom: record('bom'),
    refreshAllTabData: record('allTabs'), materials: { refresh: record('materials') },
    isWaitingForBom: () => false, applyInputGapGuide: record('guide'),
    ensurePriceSourceChecked: async () => {},
    ElMessage: { error: record('error') }, ...overrides,
  }
  const load = new Function(...Object.keys(deps), `${body}; return loadWorkbench`)(...Object.values(deps))
  return { deps, calls, load }
}

test('successful costing waits only for the result/header and preserves the visible BOM', async () => {
  const header = pending(), result = pending()
  const h = harness({ fetchQuoteCostingWorkbench: () => header.promise, loadCostRun: () => result.promise })
  let finished = false
  const request = h.load({ costResultOnly: true }).then(() => { finished = true })
  result.resolve()
  await flush()
  assert.equal(finished, false, 'header read is still outstanding')
  header.resolve({ item: { id: 1 }, periodMonth: '2026-10' })
  await request
  assert.deepEqual(h.calls, ['lock'])
  assert.equal(h.deps.loading.value, false)
  assert.equal(h.deps.inputTabsNeedRefresh.value, true)
  assert.equal(h.deps.effectiveBom.value.state, 'READY')
})

test('direct result entry reads the quote month before requesting its cost', async () => {
  const header = pending(), months = []
  const h = harness({ workbench: ref({ item: {} }), fetchQuoteCostingWorkbench: () => header.promise,
    loadCostRun: async (_, month) => { months.push(month) } })
  const request = h.load({ costResultOnly: true })
  await flush()
  assert.deepEqual(months, [])
  header.resolve({ item: { id: 1 }, periodMonth: '2025-12' })
  await request
  assert.deepEqual(months, ['2025-12'])
  assert.deepEqual(h.calls, ['lock'])
})

test('opening inputs after costing refreshes the BOM and price tabs', async () => {
  const h = harness({ inputTabsNeedRefresh: ref(true) })
  await h.load({ resetTab: false, loadChildren: true })
  assert.deepEqual(h.calls, ['clearBom', 'materials', 'bom', 'allTabs', 'guide'])
  assert.equal(h.deps.inputTabsNeedRefresh.value, false)
  assert.equal(h.deps.loading.value, false)
})

test('missing bare-product packaging still loads the existing body BOM and keeps downstream inputs blocked', async () => {
  const bodyBom = { state: 'DRAFT', nodes: Array.from({ length: 6 }, (_, id) => ({ id })) }
  let queried = false
  const h = harness({
    isWaitingForBom: () => true,
    applyStoredBomGap: () => { h.deps.effectiveBom.value = { state: 'BLOCKED', nodes: [] } },
    resetCurrentInputTabs: () => {}, resetCostRunResult: () => {},
    activeRepriceLock: ref({ locked: false }),
    loadEffectiveBom: async () => { queried = true; h.deps.effectiveBom.value = bodyBom },
  })

  await h.load({ resetTab: true })

  assert.equal(queried, true, 'WAIT_BOM must not hide a usable body BOM returned by the real endpoint')
  assert.equal(h.deps.effectiveBom.value.nodes.length, 6)
  assert.equal(h.calls.includes('allTabs'), false, 'displaying the body does not authorize costing')
})

test('a failed result header read releases loading and does not replace valid BOM with a false gap', async () => {
  const h = harness({ fetchQuoteCostingWorkbench: async () => { throw new Error('读取失败') } })
  await h.load({ costResultOnly: true })
  assert.equal(h.deps.loading.value, false)
  assert.equal(h.deps.workbenchLoadError.value, '读取失败')
  assert.equal(h.deps.effectiveBom.value.state, 'READY')
  assert.equal(h.calls.includes('allTabs'), false)
})

test('recalculation keeps the result tab on refresh and opens the new saved sheet directly', async () => {
  const replacements = [], destinations = []
  const deps = {
    oaNo: ref('OA-1'), itemId: ref('6'), historyViewMode: ref(false),
    costRunActionLoading: ref(false), costRunLoading: ref(false), costRunError: ref(''),
    costRunRepriceLocked: ref(false), workbench: ref({ periodMonth: '2026-10' }),
    classificationRevision: ref(0), activeTab: ref('PRODUCT_DETAIL'),
    ensurePriceSourceChecked: async () => {},
    workbenchLoadError: ref(''), localWorkflowGuideText: ref('old gap'),
    materials: { submit: async () => ({ product: { pipelineStatus: 'SUCCESS', costVersionId: 42 } }) },
    drawingContinuation: { remember: async () => {} },
    route: { query: { tab: 'PRODUCT_DETAIL', guide: 'costing-input-gap', returnItemId: '6' } },
    router: { replace: async target => replacements.push(target), push: target => destinations.push(target) },
    costRun: ref({ currentDisplayVersion: { id: 41, costRunNo: 'COST-OLD' } }),
    header: ref({}), item: ref({ productName: '测试产品' }), costingProductCode: ref('P-6'),
    ElMessage: { success: () => {}, warning: () => assert.fail('unexpected warning'), error: error => assert.fail(error) },
  }
  deps.loadWorkbench = async options => {
    assert.deepEqual(options, { costResultOnly: true })
    deps.costRun.value = { currentDisplayVersion: { id: 42, costRunNo: 'COST-NEW', versionNo: 'V2' } }
  }
  const functions = ['submitProductCosting', 'openCostRunDetail'].map(name => {
    const node = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
    return source.slice(node.start, node.end)
  }).join('\n')
  const page = new Function(...Object.keys(deps), `${functions}; return { submitProductCosting, openCostRunDetail }`)(...Object.values(deps))
  await page.submitProductCosting()
  assert.equal(deps.activeTab.value, 'COST_RUN')
  assert.deepEqual(replacements, [{ query: { tab: 'COST_RUN', returnItemId: '6' } }])
  assert.equal(deps.costRunActionLoading.value, false)
  page.openCostRunDetail()
  assert.equal(destinations.length, 1)
  assert.equal(destinations[0].name, 'cost-run-detail')
  assert.deepEqual(destinations[0].params, { oaNo: 'OA-1', itemId: '6' })
  assert.equal(destinations[0].query.versionId, 42)
  assert.equal(destinations[0].query.costRunNo, 'COST-NEW')
})


test('reloading an active gap tab checks details after the summary load ends', async () => {
  let checked = 0
  const h = harness({ activeTab: ref('PRICE_SOURCE_SUPPLEMENT'), ensurePriceSourceChecked: async () => {
    assert.equal(h.deps.loading.value, false)
    checked++
  } })
  await h.load({ loadChildren: true })
  assert.equal(checked, 1)
})
