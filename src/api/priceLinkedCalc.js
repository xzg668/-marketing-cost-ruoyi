import { request } from './http'

export const fetchPriceLinkedCalc = (params) =>
  request('/api/v1/price-linked/calc', { params })

export const refreshPriceLinkedCalc = (body) =>
  request('/api/v1/price-linked/calc/refresh', { method: 'POST', body })

// 读 calc_item 刷新时落库的 trace_json —— 展示的就是该行实际代入 OA 金属锁价算出的过程，
// 与列表"部品单价"同源；和 /items/{linkedItemId}/trace 的 preview 口径互补
export const fetchCalcTrace = (calcId) =>
  request(`/api/v1/price-linked/calc/${calcId}/trace`)
