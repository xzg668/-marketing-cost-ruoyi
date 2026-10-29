import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
import { request } from './http'

export const fetchMonthlyRepriceActiveLock = () =>
  request('/api/v1/monthly-reprice/active-lock')

export const fetchMonthlyRepriceBatches = (params) =>
  request('/api/v1/monthly-reprice/batches', { params })

export const fetchMonthlyRepriceBatch = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}`)

export const fetchMonthlyRepriceProgress = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/progress`)

export const fetchMonthlyRepriceTasks = (repriceNo, params) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/tasks`, { params })

export const fetchMonthlyRepriceResults = (repriceNo, params) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/results`, { params })

export const fetchMonthlyRepricePartItems = (repriceNo, resultId) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/results/${resultId}/part-items`)

export const fetchMonthlyRepriceCostItems = (repriceNo, resultId) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/results/${resultId}/cost-items`)

export const fetchMonthlyRepriceAuditLogs = (params) =>
  request('/api/v1/monthly-reprice/audit-logs', { params })

export const fetchRepriceCurrent = () => request('/api/v1/monthly-reprice/1130/current')
export const startReprice = () => request('/api/v1/monthly-reprice/1130/start', { method: 'POST' })
export const retryReprice = (no) => request(`/api/v1/monthly-reprice/1130/${encodeURIComponent(no)}/retry`, { method: 'POST' })
export const confirmReprice = (no, checkedRevision) => request(`/api/v1/monthly-reprice/1130/${encodeURIComponent(no)}/confirm`, { method: 'POST', body: { checkedRevision } })

export const fetchMonthlyCostComparison = (params) => request('/api/v1/monthly-reprice/1130/comparison', { params: { ...params, metrics: params.metrics == null ? undefined : params.metrics.length ? params.metrics.join(',') : 'NONE' }, suppressErrorToast: true })

export const downloadMonthlyCostComparison = (params, options) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') query.set(key, key === 'metrics' ? (value.length ? value.join(',') : 'NONE') : String(value))
  return downloadAuthenticatedBlob(`/api/v1/monthly-reprice/1130/comparison/export?${query}`, `制造成本明细对比_${params.baselineMonth}_${params.comparisonMonth}.xlsx`, options)
}
