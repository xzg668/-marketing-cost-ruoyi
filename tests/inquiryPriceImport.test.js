import test from 'node:test'
import assert from 'node:assert/strict'
import { createInquiryImport } from '../src/pages/inquiryPriceImport.js'

const file = { name: '采购件.xls', size: 100 }
const preview = { rows: [{ priceType: '固定价', originalPrice: '0.0442' }], sheets: ['可改名称'] }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('preview and retry use the chosen month and same request identity; success may be a replay', async () => {
  const calls = [], receipts = []; let fails = true
  const session = createInquiryImport({ scope: () => 'COMMERCIAL', month: () => '2026-11', uuid: () => 'same-request', onImported: r => receipts.push(r), api: {
    preview: async (...args) => { calls.push(['preview', ...args]); return preview },
    publish: async (...args) => { calls.push(['publish', ...args]); if (fails) throw new Error('网络中断'); return { batchId: 1, rows: 1, refresh: null } },
  } })
  await session.select(file)
  assert.deepEqual(calls, [['preview', file, '2026-11']])
  await session.publish(); assert.equal(session.state.error, '网络中断')
  fails = false; await session.publish()
  assert.deepEqual(calls.slice(1), [['publish', file, '2026-11', 'same-request'], ['publish', file, '2026-11', 'same-request']])
  assert.equal(receipts.length, 1); assert.equal(session.state.preview, null)
})
test('month change invalidates preview and cannot publish a previous month', async () => {
  let month = '2026-10', publications = 0
  const session = createInquiryImport({ scope: () => 'COMMERCIAL', month: () => month, api: {
    preview: async () => preview, publish: async () => { publications++ },
  } })
  await session.select(file); month = '2026-11'; await session.publish()
  assert.equal(publications, 0); assert.equal(session.state.preview, null); assert.match(session.state.error, /月份已改变/)
})
test('a late preview cannot cross month or tenant boundaries', async () => {
  for (const change of ['month', 'tenant']) {
    let month = '2026-10', tenant = 'COMMERCIAL'; const pending = deferred()
    const session = createInquiryImport({ scope: () => tenant, month: () => month, api: { preview: () => pending.promise } })
    const loading = session.select(file)
    if (change === 'month') month = '2026-11'; else tenant = 'HOUSEHOLD'
    session.reset(); pending.resolve(preview); await loading
    assert.equal(session.state.preview, null); assert.equal(session.state.busy, false)
  }
})
test('double submission sends once and a late result does not update a departed page', async () => {
  const pending = deferred(); let calls = 0, receipts = 0
  const session = createInquiryImport({ scope: () => 'COMMERCIAL', month: () => '2026-10', onImported: () => receipts++, api: {
    preview: async () => preview, publish: () => { calls++; return pending.promise },
  } })
  await session.select(file); const first = session.publish(); await session.publish()
  assert.equal(calls, 1); session.reset(); pending.resolve({ batchId: 1 }); await first; assert.equal(receipts, 0)
})
test('invalid file, invalid month and parse errors never enable publication', async () => {
  let month = '2026-10', calls = 0
  const session = createInquiryImport({ scope: () => 'COMMERCIAL', month: () => month, api: { preview: async () => { calls++; throw new Error('联动价缺少公式') } } })
  for (const size of [0, 10 * 1024 * 1024 + 1]) { await session.select({ ...file, size }); assert.match(session.state.error, /10 MB/) }
  month = '2026-13'; await session.select(file); assert.match(session.state.error, /价格月份/); assert.equal(calls, 0)
  month = '2026-10'; await session.select(file); assert.match(session.state.error, /缺少公式/); assert.equal(session.state.preview, null)
})
