import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
// Execute the production browser helper; only Vite env and external browser/HTTP boundaries are supplied.
const source = readFileSync(new URL('../src/utils/auxiliaryClassification.js', import.meta.url), 'utf8').replaceAll('export ', '').replaceAll('import.meta.env', 'viteEnv')
function fixture(fetch) {
  const activity = { clicks: 0, urls: 0, revoked: 0, headers: null, filename: null }
  const helper = new Function('fetch', 'localStorage', 'URL', 'document', 'viteEnv', `${source}\nreturn downloadAuthenticatedBlob`)(
    async (...args) => { activity.headers = args[1].headers; return fetch(...args) },
    { getItem: () => 'unit-test-token' }, { createObjectURL: () => { activity.urls++; return 'blob:test' }, revokeObjectURL: () => { activity.revoked++ } },
    { createElement: () => ({ set href(value) {}, set download(value) { activity.filename = value }, click() { activity.clicks++ } }) }, {},
  )
  return { activity, helper }
}
const response = () => ({ ok: true, headers: { get: () => 'application/octet-stream' }, blob: async () => new Blob(['original']) })
test('下载开始前已无作用域权限，不发请求也不创建文件', async () => {
  let requests = 0; const f = fixture(async () => { requests++; return response() })
  await f.helper('/original', 'original.xls', { isCurrent: () => false }); assert.equal(requests, 0); assert.equal(f.activity.clicks, 0)
})
test('等待HTTP响应期间切换账号或业务单元，不触发旧文件', async () => {
  let done, current = true; const pending = new Promise(resolve => { done = resolve }); const f = fixture(async () => pending)
  const operation = f.helper('/original', 'original.xls', { isCurrent: () => current }); current = false; done(response()); await operation
  assert.equal(f.activity.clicks, 0); assert.equal(f.activity.urls, 0)
})
test('读取文件体期间撤权或离开组件，最终click前仍须检查', async () => {
  let done, current = true; const pending = new Promise(resolve => { done = resolve }); const f = fixture(async () => ({ ...response(), blob: async () => pending }))
  const operation = f.helper('/original', 'original.xls', { isCurrent: () => current }); await Promise.resolve(); await Promise.resolve(); current = false; done(new Blob(['original'])); await operation
  assert.equal(f.activity.clicks, 0); assert.equal(f.activity.urls, 0)
})
test('有效范围内使用认证和正确文件名，点击后释放URL', async () => {
  const f = fixture(async () => response()); await f.helper('/original', 'source.xlsx', { isCurrent: () => true })
  assert.equal(f.activity.headers.Authorization, 'Bearer unit-test-token'); assert.equal(f.activity.filename, 'source.xlsx'); assert.equal(f.activity.clicks, 1); assert.equal(f.activity.revoked, 1)
})
