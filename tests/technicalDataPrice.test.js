import test from 'node:test'
import assert from 'node:assert/strict'
import { priceDraft, pricePayload, priceEntryPreview } from '../src/utils/technicalDataPrice.js'

test('unassigned form view uses actual gap units, excludes supplier review and contains no editable draft', () => {
  const gap = { gapType: 'MISSING_PRICE', gapMaterialCode: '332030278', materialName: '绝缘套', message: '未取得可用价格' }
  const check = { gaps: { records: [gap, gap,
    { gapType: 'MISSING_PRICE', gapMaterialCode: '201350625' },
    { gapType: 'MISSING_STRUCTURE', gapMaterialCode: 'OTHER' }] },
    supplierPriceReviews: [{ status: 'PENDING', scope: { materialCode: '201350625' } }] }
  const view = priceEntryPreview(check, { bomRows: [{ childCode: '332030278', unit: '只', priceOrgCode: '210' }] })
  assert.equal(view.editable, false)
  assert.equal(view.content, null)
  assert.deepEqual(view.requirements.issues, [])
  assert.equal(view.requirements.items.length, 1)
  assert.deepEqual([view.requirements.items[0].materialNo, view.requirements.items[0].unit, view.requirements.items[0].organizationCode], ['332030278', '只', '210'])
  assert.equal(view.requirements.items[0].unitPrice, null)
})

test('form view reports missing or ambiguous metadata instead of guessing a purchase unit or organization', () => {
  const check = { gaps: { records: [{ gapType: 'MISSING_PRICE', gapMaterialCode: 'M' }] } }
  for (const bomRows of [[], [{ childCode: 'M', unit: '只', priceOrgCode: '210' }, { childCode: 'M', unit: '千克', priceOrgCode: '220' }]]) {
    const view = priceEntryPreview(check, { bomRows })
    assert.equal(view.requirements.issues.length, 1)
    assert.equal(view.requirements.items[0].unit, '待核实单位')
    assert.equal(view.requirements.items[0].organizationCode, '待核实组织')
    assert.equal(view.editable, false)
  }
})

const requirements = [{ itemKey: 'x', status: 'MISSING' }, { itemKey: 'public', status: 'AVAILABLE' }]
test('owned source revision sends the edited input while an available public price stays read only', () => {
  const rows = [{ itemKey: 'source', status: 'REVISION' }, { itemKey: 'public', status: 'AVAILABLE' }]
  const draft = priceDraft({ entryMode: 'FIXED', unitPrice: '18.25' })
  assert.deepEqual(pricePayload({ source: draft, public: draft }, rows, 4, 'revision').items,
    [{ itemKey: 'source', entryMode: 'FIXED', notes: null, unitPrice: '18.25' }])
})
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
