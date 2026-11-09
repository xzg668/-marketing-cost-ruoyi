import { request } from '../http'

export const listUsers = (params) =>
  request('/api/v1/system/user', { params })

export const getUser = (id) =>
  request(`/api/v1/system/user/${id}`)

export const createUser = (data) =>
  request('/api/v1/system/user', { method: 'POST', body: data })

export const updateUser = (id, data) =>
  request(`/api/v1/system/user/${id}`, { method: 'PUT', body: data })

export const deleteUser = (id) =>
  request(`/api/v1/system/user/${id}`, { method: 'DELETE' })

export const resetPassword = (id, data) =>
  request(`/api/v1/system/user/${id}/reset-password`, { method: 'PUT', body: data })

export const assignRoles = (id, data) =>
  request(`/api/v1/system/user/${id}/roles`, { method: 'PUT', body: data })

export const listRoles = () =>
  request('/api/v1/system/user/roles')

export const getQuoteScope = (id) =>
  request(`/api/v1/system/user/${id}/quote-scope`)

export const saveQuoteScope = (id, quoteScope) =>
  request(`/api/v1/system/user/${id}/quote-scope`, { method: 'PUT', body: { quoteScope } })
