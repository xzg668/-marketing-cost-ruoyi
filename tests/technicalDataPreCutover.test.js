import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const detail = readFileSync(new URL('../src/pages/QuoteRequestDetailPage.vue', import.meta.url), 'utf8')
const router = readFileSync(new URL('../src/router/index.js', import.meta.url), 'utf8')

test('technical-data task route opens the workbench without the retired review route', () => {
  assert.match(router, /path:\s*'\/collaboration\/technical-data'/)
  assert.match(router, /path:\s*'tasks\/:taskId'/)
  assert.match(router, /views\/technical-data\/tasks\/index\.vue/)
  assert.doesNotMatch(router, /path:\s*'\/collaboration\/technical-data\/reviews\/:taskId'/)
  assert.doesNotMatch(router, /technical-data\/reviews\/index\.vue/)
})

test('T14 quote detail has no legacy collaboration route or operation', () => {
  assert.doesNotMatch(detail, /startQuoteItemCollaboration/)
  assert.doesNotMatch(detail, /batchStartQuoteCollaboration/)
  assert.doesNotMatch(detail, /createCollaborationPortalAccessLink/)
  assert.doesNotMatch(detail, /refreshQuoteCollaborationSummary/)
  assert.doesNotMatch(router, /\/collaborate|collaboration\/product-tasks/)
})
