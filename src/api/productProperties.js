import { request } from './http'

export const fetchProductProperties = (params) =>
  request('/api/v1/product-properties', { params })

export const fetchProductPropertyRules = (params) =>
  request('/api/v1/product-properties/rules', { params })

export const saveProductPropertyRules = (body) =>
  request('/api/v1/product-properties/rules', { method: 'PUT', body })

export const importProductProperties = ({ file, propertyYear, importMode }) => {
  const body = new FormData()
  body.append('file', file)
  body.append('propertyYear', String(propertyYear))
  body.append('importMode', importMode)
  return request('/api/v1/product-properties/import', {
    method: 'POST',
    body,
    timeout: 180000,
  })
}
