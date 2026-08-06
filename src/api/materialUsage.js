import { request } from './http.js'

const BASE_URL = '/api/v1/base/u9/material-usage'

export const MATERIAL_USAGE_ORGANIZATIONS = [
  { label: '商用（210）', value: 'COMMERCIAL' },
  { label: '板换（220）', value: 'PLATE' },
]

export function normalizeMaterialUsagePage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list)
      ? page.list
      : (Array.isArray(page.records) ? page.records : []),
  }
}

export const fetchMaterialUsage = (params) =>
  request(BASE_URL, { params })
