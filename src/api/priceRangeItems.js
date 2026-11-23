import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

export const fetchRangeItems = (params) =>
  request('/api/v1/price-range/items', { params })

export const updateRangeItem = (id, body) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'PATCH', body })

export const deleteRangeItem = (id) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'DELETE' })

export const fetchRangeOriginal = (id) =>
  request(`/api/v1/price-range/items/original-rules/${id}`)

export const fetchRangeRuleOptions = (pricingMonth, materialCode) =>
  request('/api/v1/price-range/items/original-rules/options', { params: { pricingMonth, materialCode } })

export const addRangeBand = (id, body) =>
  request(`/api/v1/price-range/items/original-rules/${id}/bands`, { method: 'POST', body, timeout: 120000 })

export const downloadRangeTemplate = (id, filename, options) =>
  downloadAuthenticatedBlob(`/api/v1/price-range/items/original-rules/${id}/template`, filename, options)

const originalForm = (file, pricingMonth, businessUnitType, supplementRuleId, preview) => {
  const body = new FormData()
  body.append('file', file)
  body.append('pricingMonth', pricingMonth)
  if (businessUnitType) body.append('businessUnitType', businessUnitType)
  if (supplementRuleId != null) body.append('supplementRuleId', supplementRuleId)
  if (preview) {
    body.append('expectedSha256', preview.fileSha256)
    body.append('previewFingerprint', preview.previewFingerprint)
  }
  return body
}

export const previewRangeOriginal = (file, month, businessUnit, supplementRuleId) =>
  request('/api/v1/price-range/items/original-preview', {
    method: 'POST', body: originalForm(file, month, businessUnit, supplementRuleId), timeout: 120000,
  })

export const publishRangeOriginal = (file, month, businessUnit, preview, supplementRuleId) =>
  request('/api/v1/price-range/items/original-import', {
    method: 'POST', body: originalForm(file, month, businessUnit, supplementRuleId, preview), timeout: 120000,
  })
