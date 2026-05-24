import { request } from './http.js'

const BASE_URL = '/api/v1/supplier-supply-ratios'

export function normalizeSupplierSupplyRatioPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list) ? page.list : (Array.isArray(page.records) ? page.records : []),
  }
}

export function toSupplierSupplyRatioFormData({ file, businessUnitType = '' }) {
  const formData = new FormData()
  formData.append('file', file)
  // 预留业务单元参数，后续 SRM 同步或多事业部导入时保持同一接口口径。
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

export const updateSupplierSupplyRatio = (id, body) =>
  request(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    body,
  })

export const deleteSupplierSupplyRatio = (id) =>
  request(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  })
