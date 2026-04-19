import { request } from './http'

export const fetchLinkedItems = (params) =>
  request('/api/v1/price-linked/items', { params })

export const createLinkedItem = (body) =>
  request('/api/v1/price-linked/items', { method: 'POST', body })

export const updateLinkedItem = (id, body) =>
  request(`/api/v1/price-linked/items/${id}`, { method: 'PATCH', body })

export const deleteLinkedItem = (id) =>
  request(`/api/v1/price-linked/items/${id}`, { method: 'DELETE' })

export const importLinkedItems = (body) =>
  request('/api/v1/price-linked/items/import', { method: 'POST', body })
