import { request } from './http'

export const fetchThreeExpenseRates = (params) =>
  request('/api/v1/three-expense-rates', { params })

export const importThreeExpenseRates = (body) =>
  request('/api/v1/three-expense-rates/import', { method: 'POST', body })

export const createThreeExpenseRate = (body) =>
  request('/api/v1/three-expense-rates', { method: 'POST', body })

export const updateThreeExpenseRate = (id, body) =>
  request(`/api/v1/three-expense-rates/${id}`, { method: 'PATCH', body })

export const deleteThreeExpenseRate = (id) =>
  request(`/api/v1/three-expense-rates/${id}`, { method: 'DELETE' })
