import { request } from './http'

export const fetchMonthlyRepriceActiveLock = () =>
  request('/api/v1/monthly-reprice/active-lock')

export const fetchMonthlyRepriceBatches = (params) =>
  request('/api/v1/monthly-reprice/batches', { params })

export const fetchMonthlyRepriceBatch = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}`)

export const fetchMonthlyRepriceProgress = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/progress`)

export const createMonthlyRepriceBatch = (body) =>
  request('/api/v1/monthly-reprice/batches', {
    method: 'POST',
    body,
  })

export const expandMonthlyRepriceBatch = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/expand`, {
    method: 'POST',
  })

export const prepareMonthlyRepriceLinkedPrice = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/prepare-linked-price`, {
    method: 'POST',
  })

export const confirmMonthlyRepriceBatch = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/confirm`, {
    method: 'POST',
  })

export const cancelMonthlyRepriceBatch = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/cancel`, {
    method: 'POST',
  })

export const retryMonthlyRepriceFailedTasks = (repriceNo) =>
  request(`/api/v1/monthly-reprice/batches/${repriceNo}/retry-failed`, {
    method: 'POST',
  })

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
