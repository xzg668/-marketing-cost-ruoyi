const scalar = (value) => Array.isArray(value) ? '' : String(value || '')

export function technicalPriceContext(query = {}) {
  if (!query.technicalVersionId) return null
  const context = Object.fromEntries(['oaNo', 'oaFormItemId', 'technicalVersionId', 'pricingMonth', 'businessUnitType'].map(key => [key, scalar(query[key])]))
  if (!context.oaNo || !/^\d+$/.test(context.oaFormItemId) || !/^\d+$/.test(context.technicalVersionId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(context.pricingMonth) || !['COMMERCIAL', 'PLATE'].includes(context.businessUnitType)) return null
  return context
}

export function priceWorkbenchReturn(query = {}) {
  const target = scalar(query.returnTo)
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return ''
  const url = new URL(target, 'http://local')
  const expected = `/ingest/quote-requests/${encodeURIComponent(scalar(query.oaNo))}/items/${scalar(query.oaFormItemId)}/costing`
  if (url.origin !== 'http://local' || url.pathname !== expected) return ''
  const context = technicalPriceContext(query)
  if (query.technicalVersionId && !context) return ''
  if (context && url.searchParams.has('periodMonth') && url.searchParams.get('periodMonth') !== context.pricingMonth) return ''
  url.searchParams.set('tab', 'PRICE_SOURCE_SUPPLEMENT')
  url.searchParams.set('refreshPriceSource', '1')
  return url.pathname + url.search
}
