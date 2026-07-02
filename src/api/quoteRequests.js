import { request } from './http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const encodePath = (value) => encodeURIComponent(String(value || '').trim())

export const fetchQuoteRequests = (params) =>
  request('/api/v1/quote-requests', { params })

export const fetchQuoteRequestDetail = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}`)

export const fetchQuoteCostingWorkbench = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-workbench`)

export const launchQuoteCostingWorkbench = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-workbench/launch`, {
    method: 'POST',
  })

export const updateCostingBomRow = (oaNo, itemId, rowId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/rows/${encodePath(rowId)}`, {
    method: 'PUT',
    body,
  })

export const confirmCostingBom = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/confirm`, {
    method: 'POST',
    body,
  })

export const cancelCostingBomConfirm = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/cancel-confirm`, {
    method: 'POST',
    body,
  })

export const fetchQuotePriceTypeConfirmation = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-type-confirmation`, { params })

export const importMissingPriceType = (oaNo, itemId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-type-confirmation/import-missing`, {
    method: 'POST',
    body,
  })

export const adjustPriceType = (oaNo, itemId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-type-confirmation/adjust`, {
    method: 'POST',
    body,
  })

export const confirmPriceType = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-type-confirmation/confirm`, {
    method: 'POST',
    body,
  })

export const fetchQuotePricePrepare = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-prepare`, { params })

export const generateQuotePricePrepare = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-prepare/generate`, {
    method: 'POST',
    body,
  })

export const fetchQuoteCostRun = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run`, { params })

export const trialQuoteCostRun = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run/trial`, {
    method: 'POST',
    body,
  })

export const confirmQuoteCostRun = (oaNo, itemId, costRunNo, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run/${encodePath(costRunNo)}/confirm`, {
    method: 'POST',
    body,
  })

export const costRunVersionExportUrl = (oaNo, itemId, versionId) =>
  `/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run/versions/${encodePath(versionId)}/export`

export const exportQuoteCostRunVersion = async (oaNo, itemId, versionId) => {
  const url = costRunVersionExportUrl(oaNo, itemId, versionId)
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new Error(await response.text() || '导出成本核算版本失败')
  }
  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `cost-run_${oaNo}_${itemId}_${versionId}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}

export const confirmQuoteRequestClassification = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/confirm-classification`, {
    method: 'POST',
    body,
  })
