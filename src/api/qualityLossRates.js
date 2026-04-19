import { request } from './http'

export const fetchQualityLossRates = (params) =>
  request('/api/v1/quality-loss-rates', { params })

export const importQualityLossRates = (body) =>
  request('/api/v1/quality-loss-rates/import', { method: 'POST', body })

export const createQualityLossRate = (body) =>
  request('/api/v1/quality-loss-rates', { method: 'POST', body })

export const updateQualityLossRate = (id, body) =>
  request(`/api/v1/quality-loss-rates/${id}`, { method: 'PATCH', body })

export const deleteQualityLossRate = (id) =>
  request(`/api/v1/quality-loss-rates/${id}`, { method: 'DELETE' })
