import { request } from './http'

export const fetchMaterialPriceTypes = (params) =>
  request('/api/v1/material-price-types', { params, suppressErrorToast: true })

export const updateMaterialPricePriority = (id, body) =>
  request(`/api/v1/material-price-types/${id}/priority`, {
    method: 'PATCH', body, suppressErrorToast: true,
  })

export const fetchSpecialPriceRules = (search) =>
  request('/api/v1/material-price-types/special', { params: { search }, suppressErrorToast: true })
export const findSpecialPriceMaterial = (code) =>
  request('/api/v1/material-price-types/special/material', { params: { code }, suppressErrorToast: true })
export const saveSpecialPriceRule = (id, body) =>
  request(`/api/v1/material-price-types/special${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST', body, suppressErrorToast: true,
  })
