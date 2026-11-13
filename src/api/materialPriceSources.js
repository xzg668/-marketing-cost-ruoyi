import { request } from './http'

export const fetchMaterialPriceSources = params =>
  request('/api/v1/material-price-sources', { params, suppressErrorToast: true })

export const updateMaterialPriceAttribute = body =>
  request('/api/v1/material-price-sources/attribute', {
    method: 'PATCH', body, suppressErrorToast: true,
  })

export const refreshMaterialPriceSources = () =>
  request('/api/v1/material-price-sources/refresh', { method: 'POST', suppressErrorToast: true, timeout: 180000 })
