import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { effectScope, ref } from 'vue'
import { solderRow } from '../src/utils/technicalDataSolder.js'
import { useQuoteFinalSubmission } from '../src/composables/useQuoteFinalSubmission.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const flush = () => new Promise(resolve => setImmediate(resolve))

test('HTTP 环境没有 randomUUID 时，焊料行和提交请求仍能生成安全编号，重试沿用原编号', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } })
  const scope = effectScope()
  try {
    const first = solderRow(), second = solderRow()
    assert.match(first.uiId, uuid)
    assert.notEqual(first.uiId, second.uiId)
    const sent = []
    const ready = { canConfirm: true, fingerprint: 'same-input', periodMonth: '2026-10' }
    const submission = scope.run(() => useQuoteFinalSubmission(ref('HTTP-QUOTE'), {
      fetch: async () => ready,
      submit: async (_, body) => { sent.push(body); if (sent.length === 1) throw Error('网络中断'); return { canConfirm: false } },
    }))
    await flush()
    await assert.rejects(submission.submit(), /网络中断/)
    assert.equal(submission.sending.value, false)
    await submission.submit()
    assert.match(sent[0].requestKey, uuid)
    assert.equal(sent[0].requestKey, sent[1].requestKey)
    assert.equal(submission.sending.value, false)
  } finally {
    scope.stop()
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor)
    else delete globalThis.crypto
  }
})
