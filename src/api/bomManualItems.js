import { request } from './http'

export const fetchBomManualItems = (params) =>
  request('/api/v1/boms', { params })

export const fetchBomManualSummaryItems = (params) =>
  request('/api/v1/boms/summary', { params })

export const fetchBomManualItemDetails = (params) =>
  request('/api/v1/boms/details', { params })

export const importBomManualItems = (body) =>
  request('/api/v1/boms/import', { method: 'POST', body })

export const createBomManualItem = (body) =>
  request('/api/v1/boms', { method: 'POST', body })

export const updateBomManualItem = (id, body) =>
  request(`/api/v1/boms/${id}`, { method: 'PATCH', body })

export const deleteBomManualItem = (id) =>
  request(`/api/v1/boms/${id}`, { method: 'DELETE' })
