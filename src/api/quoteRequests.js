import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const encodePath = (value) => encodeURIComponent(String(value || '').trim())

export const fetchQuoteRequests = (params) =>
  request('/api/v1/quote-requests', { params })

export const fetchQuoteRequestDetail = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}`)

const drawingWorkspacePath = (oaNo, itemId) =>
  `/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/drawing-verifications`

export const fetchDrawingVerificationWorkspace = (oaNo, itemId, accountingMonth) =>
  request(drawingWorkspacePath(oaNo, itemId), { params: { accountingMonth }, suppressErrorToast: true })

export const fetchDrawingVerificationResult = (oaNo, itemId, accountingMonth, resultId) =>
  request(`${drawingWorkspacePath(oaNo, itemId)}/results/${encodePath(resultId)}`, {
    params: { accountingMonth }, suppressErrorToast: true,
  })

export const operateDrawingVerification = (oaNo, itemId, accountingMonth, body) =>
  request(drawingWorkspacePath(oaNo, itemId), {
    method: 'POST', params: { accountingMonth }, body, timeout: 600000, suppressErrorToast: true,
  })

export const fetchElectronicDrawingMaterialResolution = (taskId, accountingMonth) =>
  request(`/api/v1/quote-requests/electronic-drawing/tasks/${encodePath(taskId)}/material-resolution`, {
    params: { accountingMonth },
    suppressErrorToast: true,
  })

export const searchElectronicDrawingMaterialOptions = (taskId, params) =>
  request(`/api/v1/quote-requests/electronic-drawing/tasks/${encodePath(taskId)}/material-options`, {
    params,
    suppressErrorToast: true,
  })

export const saveElectronicDrawingMaterialResolutions = (taskId, body, accountingMonth) =>
  request(`/api/v1/quote-requests/electronic-drawing/tasks/${encodePath(taskId)}/material-resolutions`, {
    method: 'PUT',
    params: { accountingMonth },
    body,
    suppressErrorToast: true,
  })

export const fetchQuoteCostingWorkbench = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/costing-workbench`)

export const fetchQuoteEffectiveBom = (oaNo, itemId, options = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom`, options)

export const rebuildQuoteEffectiveBom = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/rebuild`, {
    method: 'POST',
  })

export const previewQuoteEffectiveBomAlternative = (oaNo, itemId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/alternative-preview`, {
    method: 'POST',
    body,
  })

export const prepareQuoteEffectiveBomCosting = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/effective-bom/prepare-costing`, {
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

// 当前接口只读自动识别正式价格类型，不生成 OA 级确认副本。
export const fetchQuotePriceTypeRecognition = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/price-type-recognition`, { params })

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

export const confirmSupplierPriceReview = (oaNo, itemId, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/supplier-price-reviews/confirm`, {
    method: 'POST',
    body,
  })

export const fetchQuoteCostRun = (oaNo, itemId, params) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run`, { params })

export const fetchQuoteCostResultHistory = (oaNo, itemId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-result-history`)

export const fetchQuoteMonthlyCostResultDetail = (oaNo, itemId, resultId) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-result-history/monthly/${encodePath(resultId)}`)

export const submitQuoteProductCostRun = (oaNo, itemId, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-runs`, {
    method: 'POST',
    body,
  })

export const submitQuoteBatchCostRun = (oaNo, body = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/cost-runs`, {
    method: 'POST',
    body,
  })

export const fetchCurrentQuoteBatchCostRun = (oaNo, params = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/cost-runs/current`, { params })

export const fetchCurrentQuoteProductCostRunTask = (oaNo, itemId, params = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-runs/current`, { params })

export const costRunVersionExportUrl = (oaNo, itemId, versionId) =>
  `/api/v1/quote-requests/${encodePath(oaNo)}/items/${encodePath(itemId)}/cost-run/versions/${encodePath(versionId)}/export`

export const exportQuoteCostRunVersion = async (oaNo, itemId, versionId, options) => {
  if (!oaNo || !itemId || !versionId) throw new Error('导出需要明确的报价产品和成本版本')
  const filename = `cost-run_${oaNo}_${itemId}_${versionId}.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
  const token = localStorage.getItem('token')
  return downloadAuthenticatedBlob(costRunVersionExportUrl(oaNo, itemId, versionId), filename, {
    ...options,
    isCurrent: () => token === localStorage.getItem('token') && (options?.isCurrent?.() ?? true),
  })
}

export const confirmQuoteRequestClassification = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/confirm-classification`, {
    method: 'POST',
    body,
  })

export const fetchQuoteFinalSubmission = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/final-submission`, { suppressErrorToast: true })

export const confirmQuoteFinalSubmission = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/final-submission`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const fetchQuoteCostingPreparation = (oaNo, params = {}) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/costing-preparation`, { params, suppressErrorToast: true })

export const prepareQuoteCosting = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/costing-preparation`, {
    // 整单资料检查先同步完成，再进入核算队列；100 产品并发时可能超过通用的 60 秒。
    method: 'POST', body, timeout: 600000, suppressErrorToast: true,
  })
