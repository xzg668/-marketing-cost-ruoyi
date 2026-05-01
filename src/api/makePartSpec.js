// 自制件工艺规格 API（V48）
import { request } from './http'

export const fetchMakeSpecs = (params) =>
  request('/api/v1/make-part-spec/items', { params })

export const createMakeSpec = (body) =>
  request('/api/v1/make-part-spec/items', { method: 'POST', body })

export const updateMakeSpec = (id, body) =>
  request(`/api/v1/make-part-spec/items/${id}`, { method: 'PATCH', body })

export const deleteMakeSpec = (id) =>
  request(`/api/v1/make-part-spec/items/${id}`, { method: 'DELETE' })

export const importMakeSpecs = (body) =>
  request('/api/v1/make-part-spec/items/import', { method: 'POST', body })
