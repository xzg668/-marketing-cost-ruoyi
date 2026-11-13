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
test('saved tree lookup uses displayed version rather than current BOM', async () => {
  const calls = [], deps = { costRun: ref({ sheet: { identity: { versionId: 9 } } }), oaNo: ref('OA'), itemId: ref(4),
    fetchSavedPricingBom: async (...args) => { calls.push(args); return { nodes: [{ nodeKey: 'old' }] } },
    savedPricingBomTree: ref([]), savedPricingBomVisible: ref(false), buildQuoteEffectiveBomTree: rows => rows,
    ElMessage: { info: () => {}, error: message => { throw new Error(message) } } }
  await actual('openSavedPricingBom', deps)(); assert.deepEqual(calls, [['OA', 4, 9]])
  assert.equal(deps.savedPricingBomTree.value[0].nodeKey, 'old'); assert.equal(deps.savedPricingBomVisible.value, true)
})

test('BOM and cost sheet edits navigate to the OA-wide material choice, without product writes', async () => {
  const calls = [], deps = { historyViewMode: ref(false), oaNo: ref('OA-50'), router: { push: next => calls.push(next) } }
  const open = actual('openOrderMaterialShapes', deps)
  open('A'); assert.deepEqual(calls, [{ name: 'ingest-quote-request-detail', params: { oaNo: 'OA-50' }, query: { tab: 'material-shapes', materialCode: 'A' } }])
  deps.historyViewMode.value = true; open('A'); assert.equal(calls.length, 1)
})
