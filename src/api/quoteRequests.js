import { request } from './http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const encodePath = (value) => encodeURIComponent(String(value || '').trim())

export const fetchQuoteRequests = (params) =>
  request('/api/v1/quote-requests', { params })

export const fetchQuoteRequestDetail = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}`)

export const fetchQuoteCollaborationSummary = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/collaboration-summary`)

export const scanQuoteItemCollaboration = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/collaboration/scan`, {
    method: 'POST',
  })

export const fetchQuoteTechnicianCandidates = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/collaboration/technician-candidates`)

export const startQuoteItemCollaboration = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/collaboration/start`, {
    method: 'POST',
    body,
  })

export const batchStartQuoteCollaboration = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/collaboration/batch-start`, {
    method: 'POST',
    body,
  })

export const fetchQuoteItemCollaborationHistory = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/collaboration/history`)

export const fetchQuoteCostingWorkbench = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-workbench`)

export const fetchQuoteEffectiveBom = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom`)

export const rebuildQuoteEffectiveBom = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/rebuild`, {
    method: 'POST',
  })

export const previewQuoteEffectiveBomAlternative = (oaNo, itemId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/alternative-preview`, {
    method: 'POST',
    body,
  })

export const confirmQuoteEffectiveBom = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/confirm`, {
    method: 'POST',
    body,
  })

export const prepareQuoteEffectiveBomCosting = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/prepare-costing`, {
    method: 'POST',
  })

export const launchQuoteCostingWorkbench = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-workbench/launch`, {
    method: 'POST',
  })

export const fetchQuoteBomAlternativeGroups = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/alternative-groups`, {
    params,
  })

export const fetchQuoteBomAlternativeFeatureStatus = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/alternative-groups/feature-status`)

export const selectQuoteBomAlternative = (oaNo, itemId, groupKey, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/alternative-groups/${encodePath(groupKey)}/selection`, {
    method: 'PUT',
    body,
  })

export const fetchQuoteBomAlternativeHistory = (oaNo, itemId, groupKey, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-bom/alternative-groups/${encodePath(groupKey)}/history`, {
    params,
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

export const checkQuotePriceSources = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-prepare/check`, {
    method: 'POST',
    body,
  })

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
  link.download = `cost-run_${oaNo}_${itemId}_${versionId}.xlsx`
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
