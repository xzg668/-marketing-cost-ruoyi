import { request } from './http'

export const fetchPriceLinkedCalc = (params) =>
  request('/api/v1/price-linked/calc', { params })

export const refreshPriceLinkedCalc = (body) =>
  request('/api/v1/price-linked/calc/refresh', { method: 'POST', body })
