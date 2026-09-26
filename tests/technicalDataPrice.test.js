import test from 'node:test'
import assert from 'node:assert/strict'
import { priceDraft, pricePayload } from '../src/utils/technicalDataPrice.js'

const requirements = [{ itemKey: 'x', status: 'MISSING' }, { itemKey: 'public', status: 'AVAILABLE' }]
test('fixed payload excludes stale formula and reference and retains decimal text', () => {
  const draft = priceDraft({ entryMode: 'FIXED', unitPrice: '12.123456789', formula: 'old', reference: { id: 1 } })
  const payload = pricePayload({ x: draft }, requirements, 3, 'basis')
  assert.deepEqual(payload, { expectedVersion: 3, requirementsFingerprint: 'basis', items: [{ itemKey: 'x', entryMode: 'FIXED', notes: null, unitPrice: '12.123456789' }] })
})
test('reference sends source identity and current parameters without public supplier or formula edits', () => {
  const draft = priceDraft({ entryMode: 'REFERENCE', reference: { id: 9, fingerprint: 'ref', supplierName: 'original' }, formula: 'source', unitPrice: '12' })
  const item = pricePayload({ x: draft }, requirements, 0, 'basis').items[0]
  assert.equal(item.referenceId, 9); assert.equal(item.referenceFingerprint, 'ref')
  for (const field of ['supplierName', 'formula', 'unitPrice']) assert.equal(field in item, false)
})
test('manual formula stays text and zero differs from missing input', () => {
  const draft = priceDraft({ entryMode: 'MANUAL', formula: '铜价 + 加工费', parameters: { processFee: '0' } })
  const item = pricePayload({ x: draft }, requirements, 0, 'basis').items[0]
  assert.equal(item.formula, '铜价 + 加工费'); assert.equal(item.parameters.processFee, '0'); assert.equal(item.parameters.blankWeight, null)
  draft.parameters.processFee = 'NaN'
  assert.throws(() => pricePayload({ x: draft }, requirements, 0, 'basis'), /十进制/)
})

test('switching price entry methods retains each unfinished amount, formula and reference', async () => {
  const { priceDraft, switchPriceDraft } = await import('../src/utils/technicalDataPrice.js')
  const buffers = {}
  let draft = priceDraft({ entryMode: 'FIXED', unitPrice: '12.50', notes: '待确认' })
  draft = switchPriceDraft(draft, 'MANUAL', buffers)
  draft.formula = 'A + B'
  draft.parameters.netWeight = '0.12'
  draft = switchPriceDraft(draft, 'FIXED', buffers)
  assert.equal(draft.unitPrice, '12.50')
  assert.equal(draft.notes, '待确认')
  draft = switchPriceDraft(draft, 'MANUAL', buffers)
  assert.equal(draft.formula, 'A + B')
  assert.equal(draft.parameters.netWeight, '0.12')
})
