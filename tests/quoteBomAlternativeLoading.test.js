import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'

const page = fs.readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')
const loader = page.slice(page.indexOf('async function loadAlternativeFeatureStatus('), page.indexOf('async function loadAlternativeGroups('))

function context(alternativeSelections) {
  const calls = []
  const state = {
    oaNo: { value: 'FI-SC-006-20261027-001' },
    itemId: { value: 5 },
    workbench: { value: { bomStatus: { bomStatus: 'READY' } } },
    effectiveBom: { value: { state: 'DRAFT', alternativeSelections } },
    alternativeFeatureEnabled: { value: true },
    alternativeDrawerVisible: { value: true },
    alternativeSummary: { value: { groups: [{ alternativeGroupKey: 'previous-product' }] } },
    emptyAlternativeSummary: () => ({ groups: [] }),
    clearAlternativePreview: () => calls.push('clear-preview'),
    fetchQuoteBomAlternativeFeatureStatus: async () => { calls.push('feature-status'); return { enabled: true } },
    ElMessage: { error: (message) => calls.push(message) },
  }
  vm.createContext(state)
  vm.runInContext(loader, state)
  return { state, calls }
}

test('图库计价BOM无替代组时不启动正式U9替代检查，并清理上个产品的选择状态', async () => {
  const { state, calls } = context([])
  await state.loadAlternativeFeatureStatus(false)
  assert.equal(state.alternativeFeatureEnabled.value, false,
    '当前BOM没有替代组，不应继续调用会报ALT_SOURCE_STALE的正式BOM替代接口')
  assert.equal(state.alternativeDrawerVisible.value, false)
  assert.equal(state.alternativeSummary.value.groups.length, 0)
  assert.deepEqual(calls, ['clear-preview'])
})

test('有真实替代组的BOM仍读取运行开关，保留标准/替代选择', async () => {
  const { state, calls } = context([{ alternativeGroupKey: 'U9-GROUP' }])
  await state.loadAlternativeFeatureStatus(false)
  assert.equal(state.alternativeFeatureEnabled.value, true)
  assert.deepEqual(calls, ['feature-status'])
})

test('BOM尚未加载时不拿上个产品的替代组继续查询', async () => {
  const { state, calls } = context(undefined)
  await state.loadAlternativeFeatureStatus(false)
  assert.equal(state.alternativeFeatureEnabled.value, false)
  assert.equal(calls.includes('feature-status'), false)
})
