import { request } from './http'

export const fetchMaterialPriceTypes = (params) =>
  request('/api/v1/material-price-types', { params, suppressErrorToast: true })

export const updateMaterialPricePriority = (id, body) =>
  request(`/api/v1/material-price-types/${id}/priority`, {
    method: 'PATCH', body, suppressErrorToast: true,
  })
