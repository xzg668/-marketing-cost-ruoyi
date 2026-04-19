import { request } from './http'

export const fetchBasePrices = (params) =>
  request('/api/v1/base-prices', { params })

export const createBasePrice = (body) =>
  request('/api/v1/base-prices', { method: 'POST', body })

export const updateBasePrice = (id, body) =>
  request(`/api/v1/base-prices/${id}`, { method: 'PATCH', body })

export const deleteBasePrice = (id) =>
  request(`/api/v1/base-prices/${id}`, { method: 'DELETE' })

export const importBasePrices = (body) =>
  request('/api/v1/base-prices/import', { method: 'POST', body })
