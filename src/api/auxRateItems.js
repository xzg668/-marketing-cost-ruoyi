import { request } from './http'

export const fetchAuxRateItems = (params) =>
  request('/api/v1/aux-rate-items', { params })

export const importAuxRateItems = (body) =>
  request('/api/v1/aux-rate-items/import', { method: 'POST', body })

export const createAuxRateItem = (body) =>
  request('/api/v1/aux-rate-items', { method: 'POST', body })

export const updateAuxRateItem = (id, body) =>
  request(`/api/v1/aux-rate-items/${id}`, { method: 'PATCH', body })

export const deleteAuxRateItem = (id) =>
  request(`/api/v1/aux-rate-items/${id}`, { method: 'DELETE' })
