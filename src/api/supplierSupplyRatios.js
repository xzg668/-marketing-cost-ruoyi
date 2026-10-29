import { request } from './http.js'

const BASE_URL = '/api/v1/supplier-supply-ratios'

export function normalizeSupplierSupplyRatioPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list) ? page.list : (Array.isArray(page.records) ? page.records : []),
  }
}

export function toSupplierSupplyRatioFormData({ file, businessUnitType = '', sheetName = '' }) {
  const formData = new FormData()
  formData.append('file', file)
  if (sheetName) formData.append('sheetName', sheetName)
  // 未传时使用当前登录业务单元；后端校验显式值不能跨业务单元。
  if (businessUnitType) {
    formData.append('businessUnitType', businessUnitType)
  }
  return formData
}

export const fetchSupplierSupplyRatios = (params) =>
  request(BASE_URL, { params })

export const importSupplierSupplyRatioExcel = (payload) =>
  request(`${BASE_URL}/import-excel`, {
    method: 'POST',
    body: toSupplierSupplyRatioFormData(payload),
  })

export const fetchSupplierSupplyRatioChanges = (params) =>
  request(`${BASE_URL}/changes`, { params })
