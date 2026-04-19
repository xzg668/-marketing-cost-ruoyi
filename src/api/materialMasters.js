import { request } from './http'

export const fetchMaterialMasters = (params) =>
  request('/api/v1/materials', { params })

export const importMaterialMasters = (body) =>
  request('/api/v1/materials/import', { method: 'POST', body })

export const createMaterialMaster = (body) =>
  request('/api/v1/materials', { method: 'POST', body })

export const updateMaterialMaster = (id, body) =>
  request(`/api/v1/materials/${id}`, { method: 'PATCH', body })

export const deleteMaterialMaster = (id) =>
  request(`/api/v1/materials/${id}`, { method: 'DELETE' })
