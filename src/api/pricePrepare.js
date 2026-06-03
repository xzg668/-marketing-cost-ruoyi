import { request } from './http.js'

const BASE_URL = '/api/v1/cost/price-prepare'

export const PRICE_PREPARE_BATCH_STATUS_OPTIONS = [
  { value: 'SUCCESS', label: '全部就绪', tag: 'success' },
  { value: 'PARTIAL', label: '存在缺口', tag: 'warning' },
  { value: 'FAILED', label: '执行失败', tag: 'danger' },
]

export const PRICE_PREPARE_SUMMARY_STATUS_OPTIONS = [
  { value: 'READY', label: '全部就绪', tag: 'success' },
  { value: 'PARTIAL', label: '未完成', tag: 'warning' },
  { value: 'NOT_PREPARED', label: '未准备', tag: 'info' },
  { value: 'FAILED', label: '执行失败', tag: 'danger' },
]

export const PRICE_PREPARE_ITEM_TYPE_OPTIONS = [
  { value: 'NORMAL', label: '普通料号', tag: 'info' },
  { value: 'PACKAGE_COMPONENT', label: '包装组件', tag: 'success' },
  { value: 'MAKE_PART', label: '自制件', tag: 'warning' },
]

export const PRICE_PREPARE_ITEM_STATUS_OPTIONS = [
  { value: 'READY', label: '已准备', tag: 'success' },
  { value: 'MISSING_MASTER', label: '缺主档', tag: 'danger' },
  { value: 'MISSING_STRUCTURE', label: '缺结构', tag: 'danger' },
  { value: 'MISSING_PRICE', label: '缺价格', tag: 'warning' },
  { value: 'FAILED', label: '行处理失败', tag: 'danger' },
]

export const PRICE_PREPARE_GAP_TYPE_OPTIONS = [
  { value: 'MISSING_MASTER', label: '缺主档', tag: 'danger' },
  { value: 'MISSING_STRUCTURE', label: '缺结构', tag: 'danger' },
  { value: 'MISSING_SCRAP_MAPPING', label: '缺废料映射', tag: 'warning' },
  { value: 'MISSING_PRICE', label: '缺价格', tag: 'warning' },
]

export const PRICE_PREPARE_GAP_PUSH_STATUS_OPTIONS = [
  { value: 'PENDING', label: '已记录，OA推送后续接入', tag: 'info' },
  { value: 'NOT_PUSHED', label: '已记录，OA推送后续接入', tag: 'info' },
  { value: 'PUSHED', label: '已推送OA', tag: 'success' },
  { value: 'FAILED', label: '推送失败', tag: 'danger' },
]

export function normalizePricePreparePage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : []),
  }
}

export const generatePricePrepare = (body) =>
  request(`${BASE_URL}/generate`, {
    method: 'POST',
    body,
    timeout: 120000,
  })

export const generatePricePrepareBulk = (body) =>
  request(`${BASE_URL}/generate-bulk`, {
    method: 'POST',
    body,
    timeout: 300000,
  })

export const fetchPricePrepareBatches = (params) =>
  request(`${BASE_URL}/batches`, { params })

export const fetchPricePrepareCandidates = (params) =>
  request(`${BASE_URL}/candidates`, { params })

export const fetchPricePrepareOaSummary = (params) =>
  request(`${BASE_URL}/oa-summary`, { params })

export const fetchPricePrepareTopProductSummary = (params) =>
  request(`${BASE_URL}/top-product-summary`, { params })

export const fetchPricePrepareItems = (params) =>
  request(`${BASE_URL}/items`, { params })

export const fetchPricePrepareGaps = (params) =>
  request(`${BASE_URL}/gaps`, { params })

export const confirmPricePrepareNoScrap = (body) =>
  request(`${BASE_URL}/no-scrap-confirmations`, {
    method: 'POST',
    body,
  })

export const revokePricePrepareNoScrap = (id, body) =>
  request(`${BASE_URL}/no-scrap-confirmations/${id}/revoke`, {
    method: 'POST',
    body,
  })
