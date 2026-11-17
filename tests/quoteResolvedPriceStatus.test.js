import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
import { computed, ref } from 'vue'
import { currentCostingBlockLabel } from '../src/utils/quoteRequestWorkbench.js'

const page = parse(readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')).descriptor
const source = page.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const initializers = declarations.flatMap(node => node.declarations || [])
function pageComputed(name, deps, fallback) {
  const node = initializers.find(node => node.id.name === name)?.init
  return node ? new Function('computed', ...Object.keys(deps), `return ${source.slice(node.start, node.end)}`)(computed, ...Object.values(deps)) : ref(fallback)
}
function harness() {
  const deps = {
    historyViewMode: ref(false), priceSourceReady: ref(true), pricingBomReadyForNextStep: ref(true),
    autoPriceSourceCheckedKey: ref('OA|12|2026-11'), priceSourceAutoCheckKey: () => 'OA|12|2026-11',
    priceSourceCheckError: ref(''), pricePrepareLoading: ref(false), autoPriceSourceChecking: ref(false),
    pricePrepareActionLoading: ref(false), inputTabsNeedRefresh: ref(false), refreshingTabs: ref(false), loading: ref(false),
    workbenchLoadError: ref(''), materialError: ref(''), materialState: ref({ canCost: true }), costRunError: ref(''),
    costingWorkspace: ref({ workspaceStatus: 'WAIT_PRICE', lastErrorMessage: '原料价格待核对：301110039' }),
    workbench: ref({ workflowStatus: { overallStatus: 'BLOCKED' } }), submittedGapResolved: ref(false),
    currentCostingBlockLabel, costRunActionLoading: ref(false), hasRunningCostVersion: ref(false),
    currentSuccessVersion: ref({ id: 44, displayVersionNo: 'V1' }), displayedCostVersion: ref({ id: 44 }),
    displayedPeriodMonth: ref('2026-11'), hasStaleCostVersion: ref(false), header: ref({}),
    showDrawingBomPreview: ref(false), hasPriceGaps: ref(false), currentPriceSourceGapCount: () => 0,
    historyResultLabel: ref('原报价结果'), localWorkflowGuideText: ref(''),
    materialChecks: ref([]), workflowGuideText: ref('发起核算未完成'),
    drawingPreparation: ref({ applies: false, pendingImport: false, issues: [] }),
  }
  deps.previousPriceIssueResolved = pageComputed('previousPriceIssueResolved', deps, false)
  deps.currentCostingBlockText = pageComputed('currentCostingBlockText', deps)
  deps.costRunWorkbenchStatusText = pageComputed('costRunWorkbenchStatusText', deps)
  deps.costingPreviousIssueDetail = pageComputed('costingPreviousIssueDetail', deps, '')
  deps.costingIssueDetail = pageComputed('costingIssueDetail', deps)
  deps.costingStatusSummary = pageComputed('costingStatusSummary', deps)
  return deps
}

test('the actual page distinguishes current zero-gap prices from its saved WAIT_PRICE error and historical successful cost', () => {
  const h = harness()
  assert.equal(h.costingStatusSummary.value, '当前价格源已齐全，可重新核算')
  assert.match(h.costingIssueDetail.value, /当前价格源已齐全/)
  assert.match(h.costingIssueDetail.value, /历史成功结果/)
  assert.doesNotMatch(h.costingIssueDetail.value, /301110039/)
  assert.equal(h.costingPreviousIssueDetail.value, '原料价格待核对：301110039')
  assert.equal(h.costingWorkspace.value.workspaceStatus, 'WAIT_PRICE', 'display never rewrites the saved outcome')
  assert.equal(h.currentSuccessVersion.value.id, 44)
})

test('no previous successful cost is described as ready to calculate, not already calculated', () => {
  const h = harness()
  h.currentSuccessVersion.value = null
  assert.equal(h.costingStatusSummary.value, '当前价格源已齐全，可继续核算')
  assert.doesNotMatch(h.costingIssueDetail.value, /已有历史成功结果/)
})

test('uncertain, failed, stale or out-of-scope source checks never clear the displayed price blockage', () => {
  for (const [name, value] of [
    ['priceSourceReady', false], ['pricingBomReadyForNextStep', false], ['autoPriceSourceCheckedKey', ''], ['autoPriceSourceCheckedKey', 'OTHER|12|2026-11'],
    ['priceSourceCheckError', '检查失败'], ['pricePrepareLoading', true], ['autoPriceSourceChecking', true],
    ['pricePrepareActionLoading', true], ['inputTabsNeedRefresh', true], ['refreshingTabs', true], ['loading', true],
    ['materialError', '资料读取失败'], ['workbenchLoadError', '工作台读取失败'], ['costRunError', '核算失败'],
    ['costRunActionLoading', true], ['hasRunningCostVersion', true],
  ]) {
    const h = harness()
    h[name].value = value
    assert.equal(h.previousPriceIssueResolved.value, false, name)
    assert.doesNotMatch(h.costingStatusSummary.value, /价格源已齐全/, name)
  }
})

test('price readiness cannot conceal BOM, technical, system, running or read-only states', () => {
  for (const status of ['WAIT_BOM', 'WAIT_TECH_DATA', 'SYSTEM_FAILED', 'RUNNING', 'QUEUED', 'SUCCESS', 'STALE']) {
    const h = harness()
    h.costingWorkspace.value.workspaceStatus = status
    assert.equal(h.previousPriceIssueResolved.value, false, status)
  }
  const readonly = harness(); readonly.historyViewMode.value = true
  assert.equal(readonly.previousPriceIssueResolved.value, false)
  const blocked = harness(); blocked.materialState.value.canCost = false
  assert.equal(blocked.previousPriceIssueResolved.value, false)
})

test('a new real gap immediately restores the current blockage without changing the saved historical version', () => {
  const h = harness()
  assert.match(h.costingStatusSummary.value, /价格源已齐全/)
  h.priceSourceReady.value = false
  h.costingWorkspace.value.lastErrorMessage = '原料价格待核对：NEW-RAW'
  assert.equal(h.costingStatusSummary.value, '缺少价格，待重新核算')
  assert.equal(h.costingIssueDetail.value, '原料价格待核对：NEW-RAW')
  assert.equal(h.currentSuccessVersion.value.id, 44)
})
