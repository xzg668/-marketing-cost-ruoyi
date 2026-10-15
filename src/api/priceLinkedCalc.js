import { request } from './http'

export const fetchPriceLinkedCalcResults = (params) =>
  request('/api/v1/price-linked/calc/results', { params })

// 已保存结果的计算依据；查询不会触发重算。
export const fetchCalcTrace = (calcId) =>
  request(`/api/v1/price-linked/calc/${calcId}/trace`)
