import test from 'node:test'
import assert from 'node:assert/strict'
import { technicalPriceContext, priceWorkbenchReturn } from '../src/utils/technicalPriceCorrection.js'

const query = { oaNo: 'OA-1', oaFormItemId: '12', technicalVersionId: '34', pricingMonth: '2026-09', businessUnitType: 'COMMERCIAL', returnTo: '/ingest/quote-requests/OA-1/items/12/costing?periodMonth=2026-09' }
test('修正返回必须保留同产品月份，不接受外部地址和串产品', () => {
  assert.equal(technicalPriceContext(query).technicalVersionId, '34')
  assert.match(priceWorkbenchReturn(query), /refreshPriceSource=1/)
  for (const returnTo of ['https://example.com', '//example.com', '/ingest/quote-requests/OA-1/items/13/costing', '/ingest/quote-requests/OA-1/items/12/costing?periodMonth=2026-10']) assert.equal(priceWorkbenchReturn({ ...query, returnTo }), '')
})
test('上下文缺失不得按普通公共价导入，板换业务单元可用', () => {
  for (const field of ['oaNo', 'oaFormItemId', 'technicalVersionId', 'pricingMonth', 'businessUnitType']) assert.equal(technicalPriceContext({ ...query, [field]: '' }), null)
  assert.equal(technicalPriceContext({ ...query, businessUnitType: 'PLATE' }).businessUnitType, 'PLATE')
  assert.equal(technicalPriceContext({ ...query, oaFormItemId: ['12', '13'] }), null)
})
