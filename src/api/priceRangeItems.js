import { request } from './http'

export const fetchRangeItems = (params) =>
  request('/api/v1/price-range/items', { params })

export const createRangeItem = (body) =>
  request('/api/v1/price-range/items', { method: 'POST', body })

export const updateRangeItem = (id, body) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'PATCH', body })

export const deleteRangeItem = (id) =>
  request(`/api/v1/price-range/items/${id}`, { method: 'DELETE' })

export const importRangeItems = (body) =>
  request('/api/v1/price-range/items/import', { method: 'POST', body })
