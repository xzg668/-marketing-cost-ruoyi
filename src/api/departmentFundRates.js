import { request } from './http'

export const fetchDepartmentFundRates = (params) =>
  request('/api/v1/department-fund-rates', { params })

export const importDepartmentFundRates = (body) =>
  request('/api/v1/department-fund-rates/import', { method: 'POST', body })

export const createDepartmentFundRate = (body) =>
  request('/api/v1/department-fund-rates', { method: 'POST', body })

export const updateDepartmentFundRate = (id, body) =>
  request(`/api/v1/department-fund-rates/${id}`, { method: 'PATCH', body })

export const deleteDepartmentFundRate = (id) =>
  request(`/api/v1/department-fund-rates/${id}`, { method: 'DELETE' })
