import test from 'node:test'
import assert from 'node:assert/strict'
import { createInvoiceImport } from '../src/pages/invoicePriceImport.js'

const file = { name: '发票.xlsx', size: 100 }
const preview = { rows: [{ materialCode: '001', unitPrice: '80.38555556' }], sourceRows: 1, duplicateCount: 0, sheets: ['任意名称'] }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('preview does not publish and retries retain the same import request identity', async () => {
  const requests = [], receipts = []
  let fails = true
  const session = createInvoiceImport({ scope: () => 'COMMERCIAL/210', uuid: () => 'same-request', onImported: value => receipts.push(value), api: {
    preview: async () => preview,
    publish: async (...args) => { requests.push(args); if (fails) throw new Error('网络暂时不可用'); return { batchId: 12, rows: 1 } },
  } })
  await session.select(file)
  assert.equal(requests.length, 0)
  assert.equal(session.state.preview.rows[0].unitPrice, '80.38555556')
  await session.publish('210')
  assert.equal(session.state.error, '网络暂时不可用')
  fails = false
  await session.publish('210')
  assert.deepEqual(requests, [[file, '210', 'same-request'], [file, '210', 'same-request']])
  assert.deepEqual(receipts, [{ batchId: 12, rows: 1 }])
  assert.equal(session.state.preview, null)
})

test('changing file or business scope cannot display an old preview', async () => {
  const pending = deferred()
  const session = createInvoiceImport({ scope: () => 'COMMERCIAL/210', uuid: () => 'id', api: { preview: () => pending.promise } })
  const loading = session.select(file)
  session.reset()
  pending.resolve(preview)
  await loading
  assert.equal(session.state.preview, null)
  assert.equal(session.state.busy, false)
  assert.equal(session.state.fileName, '')
})

test('double submit sends one request and late publication does not enter a different business scope', async () => {
  const pending = deferred(), receipts = []
  let owner = 'COMMERCIAL/210', calls = 0
  const session = createInvoiceImport({ scope: () => owner, uuid: () => 'id', onImported: r => receipts.push(r), api: {
    preview: async () => preview,
    publish: () => { calls++; return pending.promise },
  } })
  await session.select(file)
  const first = session.publish('210')
  await session.publish('210')
  assert.equal(calls, 1)
  owner = 'HOUSEHOLD/210'; session.reset(); pending.resolve({ batchId: 1 })
  await first
  assert.deepEqual(receipts, [])
})

test('empty and oversized workbooks are rejected before preview', async () => {
  let calls = 0
  const session = createInvoiceImport({ scope: () => 'COMMERCIAL/210', api: { preview: async () => { calls++; return preview } } })
  for (const size of [0, 10 * 1024 * 1024 + 1]) {
    await session.select({ name: file.name, size })
    assert.match(session.state.error, /10 MB/)
  }
  assert.equal(calls, 0)
})
