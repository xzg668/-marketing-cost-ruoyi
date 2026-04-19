import { request } from './http'

export const fetchProductProperties = (params) =>
  request('/api/v1/product-properties', { params })

export const createProductProperty = (body) =>
  request('/api/v1/product-properties', { method: 'POST', body })

export const updateProductProperty = (id, body) =>
  request(`/api/v1/product-properties/${id}`, { method: 'PATCH', body })

export const deleteProductProperty = (id) =>
  request(`/api/v1/product-properties/${id}`, { method: 'DELETE' })

export const importProductProperties = (body) =>
  request('/api/v1/product-properties/import', { method: 'POST', body })
