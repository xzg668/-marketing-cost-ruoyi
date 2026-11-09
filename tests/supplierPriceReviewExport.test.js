import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('../src/api/quoteRequests.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replaceAll('export ', '').replaceAll('import.meta.env', 'viteEnv')
const helper = readFileSync(new URL('../src/utils/auxiliaryClassification.js', import.meta.url), 'utf8')
  .replaceAll('export ', '').replaceAll('import.meta.env', 'viteEnv')
const component = readFileSync(new URL('../src/components/SupplierPriceReviewPanel.vue', import.meta.url), 'utf8')
function downloadFixture(fetch) {
  const events = { calls: [], clicks: 0, token: 'test-token' }
  const storage = { getItem: () => events.token }
  const download = new Function('fetch', 'localStorage', 'URL', 'document', 'viteEnv', `${helper};return downloadAuthenticatedBlob`)(
    async (...args) => { events.calls.push(args); return fetch(...args) }, storage,
    { createObjectURL: () => 'blob:xlsx', revokeObjectURL() {} },
    { createElement: () => ({ set href(v) {}, set download(v) { events.filename = v }, click() { events.clicks++ } }) }, {},
  )
  const run = new Function('request', 'downloadAuthenticatedBlob', 'localStorage', 'viteEnv', `${api};return exportQuoteSupplierRatios`)(
    () => { throw new Error('Export must not send a business write') }, download, storage, {})
  return { events, run }
}
const response = () => ({ ok: true, headers: { get: () => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, blob: async () => new Blob(['xlsx']) })

test('supplier ratio export pins OA, product and month, sends auth and downloads xlsx', async () => {
  const f = downloadFixture(async () => response())
  await f.run('OA /甲', 12, '2026-11')
  assert.equal(f.events.calls[0][0], '/api/v1/quote-requests/OA%20%2F%E7%94%B2/items/12/supplier-price-reviews/export?periodMonth=2026-11')
  assert.equal(f.events.calls[0][1].headers.Authorization, 'Bearer test-token')
  assert.equal(f.events.filename, '供货比率补齐_OA _甲_12_2026-11.xlsx')
  assert.equal(f.events.clicks, 1)
})
test('permission and business errors are shown instead of being downloaded as Excel', async () => {
  const f = downloadFixture(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ code: 400, msg: '没有待补齐供货比率' }) }))
  await assert.rejects(f.run('OA', 1, '2026-11'), /没有待补齐/)
  assert.equal(f.events.clicks, 0)
})
test('account or product/month navigation discards an old download', async () => {
  for (const changeAccount of [true, false]) {
    let resolve, current = true
    const f = downloadFixture(() => new Promise(r => { resolve = r }))
    const task = f.run('OA', 1, '2026-11', { isCurrent: () => current })
    if (changeAccount) f.events.token = 'new-account'
    else current = false
    resolve(response()); await task
    assert.equal(f.events.clicks, 0)
  }
})
test('missing scope cannot fall back to a different product or month', async () => {
  const f = downloadFixture(async () => response())
  for (const args of [['', 1, '2026-11'], ['OA', null, '2026-11'], ['OA', 1, '']]) await assert.rejects(f.run(...args), /明确/)
  assert.equal(f.events.calls.length, 0)
})
test('material display is joined by review scope, keeps blank model and includes highest-price reviews', () => {
  const props = { reviews: [{ scopeKey: 'commercial', status: 'PENDING' }, { scopeKey: 'plate', status: 'FALLBACK_HIGH' }], materials: [
    { scopeKey: 'commercial', materialName: '商用料', specification: '商用规格', model: null },
    { scopeKey: 'plate', materialName: '板换料', specification: '板换规格', model: '板换型号' },
  ] }
  const script = component.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const panel = new Function('computed', 'ref', 'watch', 'onUnmounted', 'defineProps', 'defineEmits', `${script};return {tableRows}`)(
    fn => ({ get value() { return fn() } }), value => ({ value }), () => {}, () => {}, () => props, () => () => {})
  assert.equal(panel.tableRows.value[0].model, null)
  assert.equal(panel.tableRows.value[0].specification, '商用规格')
  assert.equal(panel.tableRows.value[1].materialName, '板换料')
  assert.equal(panel.tableRows.value[1].status, 'FALLBACK_HIGH')
  assert.match(component, /导出供货比率补齐表/)
  assert.match(component, /prop="specification" label="规格"/)
  assert.match(component, /prop="model" label="型号"/)
})
