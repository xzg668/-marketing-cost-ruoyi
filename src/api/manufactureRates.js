import { request } from './http'

export const fetchManufactureRates = (params) =>
  request('/api/v1/manufacture-rates', { params })

export const importManufactureRates = (body) =>
  request('/api/v1/manufacture-rates/import', { method: 'POST', body })

export const createManufactureRate = (body) =>
  request('/api/v1/manufacture-rates', { method: 'POST', body })

export const updateManufactureRate = (id, body) =>
  request(`/api/v1/manufacture-rates/${id}`, { method: 'PATCH', body })

export const deleteManufactureRate = (id) =>
  request(`/api/v1/manufacture-rates/${id}`, { method: 'DELETE' })
