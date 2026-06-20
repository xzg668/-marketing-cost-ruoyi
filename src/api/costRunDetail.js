import { request } from './http'

export const fetchCostRunDetail = (oaNo, productCode, params = {}) =>
  request('/api/v1/cost-run/detail', { params: { oaNo, productCode, ...params } })

export const fetchCostRunTraces = (costRunNo) =>
  request(`/api/v1/cost-run/detail/${encodeURIComponent(String(costRunNo || '').trim())}/traces`)

export const fetchCostRunTraceDetail = (costRunNo, traceId) =>
  request(`/api/v1/cost-run/detail/${encodeURIComponent(String(costRunNo || '').trim())}/traces/${encodeURIComponent(String(traceId ?? '').trim())}`)
