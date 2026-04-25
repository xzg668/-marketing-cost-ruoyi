import { request } from './http'

export const fetchLinkedItems = (params) =>
  request('/api/v1/price-linked/items', { params })

export const createLinkedItem = (body) =>
  request('/api/v1/price-linked/items', { method: 'POST', body })

export const updateLinkedItem = (id, body) =>
  request(`/api/v1/price-linked/items/${id}`, { method: 'PATCH', body })

export const deleteLinkedItem = (id) =>
  request(`/api/v1/price-linked/items/${id}`, { method: 'DELETE' })

export const importLinkedItems = (body) =>
  request('/api/v1/price-linked/items/import', { method: 'POST', body })

/**
 * T19：公式编辑器实时预览 —— 规范化 + 变量赋值 + 结果 + trace。
 * 对应后端 POST /api/v1/price-linked/formula/preview（T14）。
 */
export const previewFormula = (body) =>
  request('/api/v1/price-linked/formula/preview', { method: 'POST', body })

/**
 * T19：联动 + 固定 Excel 批量导入 —— 走 multipart/form-data（T18）。
 * @param {File|Blob} file   前端上传文件
 * @param {string}    pricingMonth 价期月（如 "2026-02"）
 */
export const importLinkedItemsExcel = (file, pricingMonth) => {
  const form = new FormData()
  form.append('file', file)
  form.append('pricingMonth', pricingMonth)
  return request('/api/v1/price-linked/items/import-excel', {
    method: 'POST',
    body: form,
  })
}

/**
 * T19：查询单条联动计算结果的 trace JSON（T16）—— 404 的情况由 errorHandler 统一提示。
 */
export const fetchTrace = (id) =>
  request(`/api/v1/price-linked/items/${id}/trace`)
