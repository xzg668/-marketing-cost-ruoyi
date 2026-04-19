import { request } from './http'

export const fetchPriceVariables = (params) =>
  request('/api/v1/price-linked/variables', { params })
