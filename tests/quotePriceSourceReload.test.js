import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'

const file = process.env.GAP_PAGE_SOURCE || new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url)
const source = parse(readFileSync(file, 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const ref = value => ({ value })
function methods(names, deps) {
  const functions = names.map(name => {
    const node = declarations.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
    return source.slice(node.start, node.end)
  }).join('\n')
  return new Function(...Object.keys(deps), `${functions}; return { ${names.join(',')} }`)(...Object.values(deps))
}

test('a summary reload invalidates the memo for the unsaved gap details', async () => {
  const summary = { readiness: { status: 'PARTIAL', gapCount: 5 }, gaps: { records: [] } }
  const deps = {
    oaNo: ref('OA'), itemId: ref('162'), workbench: ref({ periodMonth: '2026-11' }),
    pricePrepare: ref({ gaps: { records: [{ gapMaterialCode: '301260158' }] } }),
    pricePrepareLoading: ref(false), autoPriceSourceCheckedKey: ref('OA|162|2026-11'),
    fetchQuotePricePrepare: async () => summary, emptyPricePrepareResponse: () => ({}),
    ElMessage: { error: e => assert.fail(e) },
  }
  await methods(['loadPricePrepare'], deps).loadPricePrepare()
  assert.equal(deps.pricePrepare.value, summary)
  assert.equal(deps.autoPriceSourceCheckedKey.value, '')
  assert.equal(deps.pricePrepareLoading.value, false)
})

for (const history of [false, true]) {
  test(`blocked recheck ${history ? 'history stays read only' : 'restores details after the busy flag ends'}`, async () => {
    const preview = { gaps: { records: [{ gapMaterialCode: '301260158' }] } }
    let displayed = preview, checks = 0
    const deps = {
      oaNo: ref('OA'), itemId: ref('162'), historyViewMode: ref(history),
      workbench: ref({ periodMonth: '2026-11' }), costRunActionLoading: ref(false), costRunError: ref(''),
      costRunRepriceLocked: ref(false), classificationRevision: ref(0), activeTab: ref('PRICE_SOURCE_SUPPLEMENT'),
      localWorkflowGuideText: ref(''),
      materials: { submit: async () => ({ checks: [{ oaFormItemId: 162, pipelineStatus: 'BLOCKED', currentStep: 'PRICE_PREPARE' }] }) },
      drawingContinuation: { remember: async () => {} },
      loadWorkbench: async () => { displayed = { readiness: { gapCount: 5 }, gaps: { records: [] } } },
      productCostingResultTab: () => 'PRICE_SOURCE_SUPPLEMENT',
      ElMessage: { warning: () => {}, error: e => assert.fail(e) },
      ensurePriceSourceChecked: async () => {
        assert.equal(deps.costRunActionLoading.value, false, 'the busy guard must be released first')
        checks++
        displayed = preview
      },
    }
    await methods(['submitProductCosting'], deps).submitProductCosting()
    assert.equal(checks, history ? 0 : 1)
    assert.equal(displayed, preview, 'a count-only response cannot leave the active gap panel empty')
  })
}
