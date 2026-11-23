import { request } from './http'

export const fetchCostRunDetail = (oaNo, productCode, params = {}) =>
  request('/api/v1/cost-run/detail', { params: { oaNo, productCode, ...params } })

export const fetchCostRunTraces = (costRunNo) =>
  request(`/api/v1/cost-run/detail/${encodeURIComponent(String(costRunNo || '').trim())}/traces`)

export const fetchCostRunTraceDetail = (costRunNo, traceId) =>
  request(`/api/v1/cost-run/detail/${encodeURIComponent(String(costRunNo || '').trim())}/traces/${encodeURIComponent(String(traceId ?? '').trim())}`)

export const fetchCostAmountComposition = (costRunNo, params) =>
  request(`/api/v1/cost-run/detail/${encodeURIComponent(String(costRunNo || '').trim())}/composition`, { params })

const cmsCostPeriodPath = (costRunNo, costCode) =>
  `/api/v1/cost-run/detail/${encodeURIComponent(costRunNo)}/composition/${costCode === 'DIRECT_LABOR' ? 'direct-labor-period' : 'cms-period'}`

export const fetchCmsCostPeriod = (costRunNo, costCode, period) =>
  request(cmsCostPeriodPath(costRunNo, costCode), { params: { costCode, period }, suppressErrorToast: true })

export const saveCmsCostPeriod = (costRunNo, costCode, body) =>
  request(cmsCostPeriodPath(costRunNo, costCode), { method: 'POST', params: { costCode }, body, suppressErrorToast: true })
