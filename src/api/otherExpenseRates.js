import { request } from './http'

export const fetchOtherExpenseRates = (params) =>
  request('/api/v1/other-expense-rates', { params })

export const createOtherExpenseRate = (body) =>
  request('/api/v1/other-expense-rates', { method: 'POST', body })

export const updateOtherExpenseRate = (id, body) =>
  request(`/api/v1/other-expense-rates/${id}`, { method: 'PATCH', body })

export const deleteOtherExpenseRate = (id) =>
  request(`/api/v1/other-expense-rates/${id}`, { method: 'DELETE' })

export const importOtherExpenseRates = (body) =>
  request('/api/v1/other-expense-rates/import', { method: 'POST', body })
