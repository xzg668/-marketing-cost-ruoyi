import { request } from './http'

export const fetchRangeItems = (params) =>
  request('/api/v1/price-range/items', { params })

export const createRangeItem = (body) =>
  request('/api/v1/price-range/items', { method: 'POST', body })

export const updateRangeItem = (id, body) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'PATCH', body })

export const deleteRangeItem = (id) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'DELETE' })

export const fetchRangeOriginal = (id) =>
  request(`/api/v1/price-range/items/original-rules/${id}`)

export const importRangeItems = (body) =>
  request('/api/v1/price-range/items/import', { method: 'POST', body })

const originalForm = (file, pricingMonth, businessUnitType, preview) => {
  const body = new FormData()
  body.append('file', file)
  body.append('pricingMonth', pricingMonth)
  if (businessUnitType) body.append('businessUnitType', businessUnitType)
  if (preview) {
    body.append('expectedSha256', preview.fileSha256)
    body.append('previewFingerprint', preview.previewFingerprint)
  }
  return body
}

export const previewRangeOriginal = (file, month, businessUnit) =>
  request('/api/v1/price-range/items/original-preview', {
    method: 'POST', body: originalForm(file, month, businessUnit), timeout: 120000,
  })

export const publishRangeOriginal = (file, month, businessUnit, preview) =>
  request('/api/v1/price-range/items/original-import', {
    method: 'POST', body: originalForm(file, month, businessUnit, preview), timeout: 120000,
  })
