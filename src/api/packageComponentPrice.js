import { request } from './http.js'

const BASE_URL = '/api/v1/package-components'

export const PACKAGE_PRICE_STATUS_OPTIONS = [
  { value: 'PRICED', label: '已取价', tag: 'success' },
  { value: 'MISSING_STRUCTURE', label: '缺结构', tag: 'danger' },
  { value: 'MISSING_CHILD_PRICE', label: '缺子件价格', tag: 'warning' },
]

export const PACKAGE_SNAPSHOT_STATUS_OPTIONS = [
  { value: 'NORMAL', label: '正常', tag: 'success' },
  { value: 'MISSING_STRUCTURE', label: '缺结构', tag: 'danger' },
]

export const PACKAGE_GAP_TYPE_OPTIONS = [
  { value: 'MISSING_STRUCTURE', label: '缺结构', tag: 'danger' },
  { value: 'MISSING_ROUTE', label: '缺价格类型', tag: 'warning' },
  { value: 'MISSING_PRICE', label: '缺价格', tag: 'danger' },
]

export const PACKAGE_OA_PUSH_STATUS_OPTIONS = [
  { value: 'NOT_PUSHED', label: '未推送', tag: 'info' },
  { value: 'PUSHED', label: '已推送', tag: 'success' },
  { value: 'FAILED', label: '推送失败', tag: 'danger' },
]

export function normalizePackagePage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : []),
  }
}

export const fetchPackageComponentPrices = (params) =>
  request(`${BASE_URL}/prices`, { params })

export const fetchPackageComponentPriceDetails = (id) =>
  request(`${BASE_URL}/prices/${id}/details`)

export const generatePackageComponentPrice = (body) =>
  request(`${BASE_URL}/prices/generate`, {
    method: 'POST',
    body,
    timeout: 120000,
  })

export const generatePackageComponentPriceByOa = (body) =>
  request(`${BASE_URL}/prices/generate-by-oa`, {
    method: 'POST',
    body,
    timeout: 300000,
  })

export const fetchPackageComponentSnapshots = (params) =>
  request(`${BASE_URL}/snapshots`, { params })

export const fetchPackageComponentSnapshotDetails = (id) =>
  request(`${BASE_URL}/snapshots/${id}/details`)

export const fetchPackageComponentGaps = (params) =>
  request(`${BASE_URL}/gaps`, { params })
