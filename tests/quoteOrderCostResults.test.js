import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
import { hasQuoteItemCostingGap } from '../src/utils/quoteItemWorkflow.js'
const source = parse(readFileSync(new URL('../src/components/quotation/QuoteOrderCostResults.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const declarations = babelParse(source, { sourceType: 'module' }).program.body
const ref = value => ({ value })
function actual(name, deps) {
  const node = declarations.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  return new Function(...Object.keys(deps), `${source.slice(node.start, node.end)}; return ${name}`)(...Object.values(deps))
}
const currentVersion = actual('currentVersion', { hasQuoteItemCostingGap })
const item = version => ({ id: 174, costingWorkspace: { workspaceStatus: 'SUCCESS', currentCostVersionId: version, inputChanged: false } })
function harness(fetch) {
  const deps = { generation: 0, props: { oaNo: 'OA', active: true }, current: ref(item(185)), currentVersion,
    sheet: ref(null), error: ref(''), loading: ref(false), traceVisible: ref(false), fetchQuoteCostRun: fetch }
  return { ...deps, load: actual('load', deps) }
}
test('reads the precise current version inline, without navigating or choosing from history', async () => {
  const calls = [], sheet = { identity: { versionId: 185 }, totals: { totalCost: '25.79' } }
  const h = harness(async (...args) => { calls.push(args); return { sheet } })
  await h.load()
  assert.deepEqual(calls, [['OA', 174, { versionId: 185 }]])
  assert.equal(h.sheet.value, sheet)
})
test('shows the new saved salary cost while the order still has the previous version', async () => {
  const calls = [], sheet = { identity: { versionId: 186 } }
  const h = harness(async (...args) => { calls.push(args); return { sheet } })
  await h.load(186)
  assert.deepEqual(calls, [['OA', 174, { versionId: 186 }]])
  assert.equal(h.sheet.value, sheet)
})
test('uses the sheet returned by saving a CMS period without requesting it again', async () => {
  const sheet = { identity: { versionId: 186 } }
  const h = harness(() => assert.fail('a sheet from the same saved version should not be fetched again'))
  await h.load(186, sheet)
  assert.equal(h.sheet.value, sheet)
  assert.equal(h.loading.value, false)
})
test('an older result cannot replace a completed newer version, and new loads clear the old sheet', async () => {
  const pending = []; const h = harness(() => new Promise(resolve => pending.push(resolve)))
  const old = h.load(); h.current.value = item(186); const next = h.load()
  assert.equal(h.sheet.value, null)
  pending[1]({ sheet: { identity: { versionId: 186 } } }); await next
  pending[0]({ sheet: { identity: { versionId: 185 } } }); await old
  assert.equal(h.sheet.value.identity.versionId, 186)
})
test('changed inputs, active work and current gaps cannot display a historical successful result', async () => {
  for (const state of ['STALE', 'RUNNING', 'WAIT_PRICE', 'SYSTEM_FAILED', 'SUCCESS']) {
    let reads = 0; const h = harness(async () => { reads++ })
    h.current.value.costingWorkspace.workspaceStatus = state
    if (state === 'SUCCESS') h.current.value.costingWorkspace.inputChanged = true
    await h.load(); assert.equal(reads, 0); assert.equal(h.sheet.value, null)
  }
})
test('a mismatched API version is rejected and a previous order response is ignored', async () => {
  const h = harness(async () => ({ sheet: { identity: { versionId: 121 } } }))
  await h.load(); assert.equal(h.sheet.value, null); assert.match(h.error.value, /当前版本/)
  let resolve; const switched = harness(() => new Promise(yes => { resolve = yes }))
  const read = switched.load(); switched.props.oaNo = 'B'; resolve({ sheet: { identity: { versionId: 185 } } }); await read
  assert.equal(switched.sheet.value, null)
})
