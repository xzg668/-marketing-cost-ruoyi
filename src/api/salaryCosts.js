import { request } from './http'

export const fetchSalaryCosts = (params) =>
  request('/api/v1/salary-costs', { params })

export const importSalaryCosts = (body) =>
  request('/api/v1/salary-costs/import', { method: 'POST', body })

export const createSalaryCost = (body) =>
  request('/api/v1/salary-costs', { method: 'POST', body })

export const updateSalaryCost = (id, body) =>
  request(`/api/v1/salary-costs/${id}`, { method: 'PATCH', body })

export const deleteSalaryCost = (id) =>
  request(`/api/v1/salary-costs/${id}`, { method: 'DELETE' })
