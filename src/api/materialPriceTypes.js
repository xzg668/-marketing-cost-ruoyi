import { request } from './http'

export const fetchMaterialPriceTypes = (params) =>
  request('/api/v1/material-price-types', { params })

export const importMaterialPriceTypes = (body) =>
  request('/api/v1/material-price-types/import', { method: 'POST', body })

export const createMaterialPriceType = (body) =>
  request('/api/v1/material-price-types', { method: 'POST', body })

export const updateMaterialPriceType = (id, body) =>
  request(`/api/v1/material-price-types/${id}`, { method: 'PATCH', body })

export const deleteMaterialPriceType = (id) =>
  request(`/api/v1/material-price-types/${id}`, { method: 'DELETE' })
