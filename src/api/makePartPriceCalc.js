import { request } from './http.js'

const BASE_URL = '/api/v1/make-part-price-calc'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const MAKE_PART_STATUS_OPTIONS = [
  { value: 'OK', label: '正常', tag: 'success' },
  { value: 'MISSING_BOM', label: '缺BOM子项', tag: 'danger' },
  { value: 'MISSING_WEIGHT', label: '缺重量', tag: 'danger' },
  { value: 'MISSING_RAW_PRICE', label: '缺原材料价', tag: 'danger' },
  { value: 'MISSING_SCRAP_MAPPING', label: '缺废料映射', tag: 'warning' },
  { value: 'MISSING_SCRAP_PRICE', label: '缺回收单价', tag: 'danger' },
  { value: 'MISSING_STOCK_UNIT', label: '缺库存单位', tag: 'warning' },
]

export const MAKE_PART_PROCESS_TYPE_OPTIONS = [
  { value: '毛坯加工', label: '毛坯加工' },
  { value: '原材料加工', label: '原材料加工' },
]

export function normalizeMakePartCalcPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : []),
  }
}

export function normalizeMakePartGenerateResult(response) {
  const result = response || {}
  return {
    calcBatchId: result.calcBatchId || '',
    parentCount: Number(result.parentCount || 0),
    totalCount: Number(result.totalCount || result.rowCount || 0),
    rowCount: Number(result.rowCount || result.totalCount || 0),
    okCount: Number(result.okCount || 0),
    warningCount: Number(result.warningCount || 0),
    errorCount: Number(result.errorCount || 0),
    statusSummary: result.statusSummary || {},
  }
}

export const fetchMakePartPriceCalcPage = (params) =>
  request(`${BASE_URL}/page`, { params })

export const fetchMakePartPriceGapPage = (params) =>
  request(`${BASE_URL}/gap-page`, { params })

export const generateMakePartPriceCalc = (body) =>
  request(`${BASE_URL}/generate`, {
    method: 'POST',
    body,
    timeout: 120000,
  })

export const fetchLatestMakePartPriceCalcBatch = (params) =>
  request(`${BASE_URL}/latest-batch`, { params })

export const fetchMakePartPriceCalcDetail = (id) =>
  request(`${BASE_URL}/${id}`)

export const fetchMakePartPriceCalcStatusSummary = (params) =>
  request(`${BASE_URL}/status-summary`, { params })

export async function exportMakePartPriceCalc(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })
  const headers = {}
  const token = localStorage.getItem('token')
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const suffix = query.toString() ? `?${query}` : ''
  const response = await fetch(`${API_BASE_URL}${BASE_URL}/export${suffix}`, { headers })
  if (!response.ok) {
    throw new Error(await response.text() || '导出制造件价格生成失败')
  }
  const disposition = response.headers.get('content-disposition') || ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : `制造件价格生成_${Date.now()}.xlsx`,
  }
}
