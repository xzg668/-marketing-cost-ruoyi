import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Execute the production API and download helper with only HTTP/browser boundaries supplied.
const api = readFileSync(new URL('../src/api/quoteRequests.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replaceAll('export ', '').replaceAll('import.meta.env', 'viteEnv')
const helper = readFileSync(new URL('../src/utils/auxiliaryClassification.js', import.meta.url), 'utf8')
  .replaceAll('export ', '').replaceAll('import.meta.env', 'viteEnv')
function fixture(fetch) {
  const events = { urls: [], clicks: 0, revoked: 0, filename: null, token: 'test-token' }
  const storage = { getItem: () => events.token }
  const download = new Function('fetch', 'localStorage', 'URL', 'document', 'viteEnv', `${helper};return downloadAuthenticatedBlob`)(
    async (...args) => { events.urls.push(args); return fetch(...args) }, storage,
    { createObjectURL: () => 'blob:test', revokeObjectURL: () => { events.revoked++ } },
    { createElement: () => ({ set href(v) {}, set download(v) { events.filename = v }, click() { events.clicks++ } }) }, {},
  )
  const run = new Function('request', 'downloadAuthenticatedBlob', 'localStorage', 'viteEnv', `${api};return exportQuoteCostRunVersion`)(() => { throw new Error('JSON API should not run') }, download, storage, {})
  return { events, run }
}
const response = () => ({ ok: true, headers: { get: () => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, blob: async () => new Blob(['xlsx']) })
test('download pins and encodes the displayed OA, item and version and sends authentication', async () => {
  const f = fixture(async () => response())
  await f.run('OA /甲', 12, 113)
  assert.equal(f.events.urls[0][0], '/api/v1/quote-requests/OA%20%2F%E7%94%B2/items/12/cost-run/versions/113/export')
  assert.equal(f.events.urls[0][1].headers.Authorization, 'Bearer test-token')
  assert.equal(f.events.filename, 'cost-run_OA _甲_12_113.xlsx')
  assert.equal(f.events.clicks, 1); assert.equal(f.events.revoked, 1)
})
test('missing version never falls back to current product data', async () => {
  const f = fixture(async () => response())
  for (const args of [['OA', 12, null], ['OA', null, 113], ['', 12, 113]]) await assert.rejects(f.run(...args), /明确/)
  assert.equal(f.events.urls.length, 0)
})
test('JSON permission errors are not downloaded under an xlsx filename', async () => {
  const f = fixture(async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ code: 403, msg: '版本无权访问' }) }))
  await assert.rejects(f.run('OA', 12, 113), /版本无权访问/); assert.equal(f.events.clicks, 0)
})
test('account change while request is pending discards the old download', async () => {
  let resolve; const f = fixture(() => new Promise(r => { resolve = r }))
  const task = f.run('OA', 12, 113); f.events.token = 'another-account'; resolve(response()); await task
  assert.equal(f.events.clicks, 0)
})
test('leaving the selected version while request is pending discards the old download', async () => {
  let resolve, current = true; const f = fixture(() => new Promise(r => { resolve = r }))
  const task = f.run('OA', 12, 113, { isCurrent: () => current }); current = false; resolve(response()); await task
  assert.equal(f.events.clicks, 0)
})
