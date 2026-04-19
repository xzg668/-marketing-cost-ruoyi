import { request } from './http'

export const fetchFixedItems = (params) =>
  request('/api/v1/price-fixed/items', { params })

export const createFixedItem = (body) =>
  request('/api/v1/price-fixed/items', { method: 'POST', body })

export const updateFixedItem = (id, body) =>
  request(`/api/v1/price-fixed/items/${id}`, { method: 'PATCH', body })

export const deleteFixedItem = (id) =>
  request(`/api/v1/price-fixed/items/${id}`, { method: 'DELETE' })

export const importFixedItems = (body) =>
  request('/api/v1/price-fixed/items/import', { method: 'POST', body })
