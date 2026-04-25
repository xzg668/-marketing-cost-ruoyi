import { request } from './http'

/**
 * T19：财务基价（影响因素）列表查询 —— 支持按价期月 / 关键字过滤（T05/T06）。
 */
export const list = (params) =>
  request('/api/v1/base-prices', { params })

/**
 * T19：影响因素 10 Excel 导入 —— multipart/form-data（T17）。
 * @param {File|Blob} file         上传的 .xlsx
 * @param {string}    priceMonth   价期月（必填，如 "2026-02"）
 */
export const importInfluenceFactors = (file, priceMonth) => {
  const form = new FormData()
  form.append('file', file)
  form.append('priceMonth', priceMonth)
  return request('/api/v1/base-prices/import-excel', {
    method: 'POST',
    body: form,
  })
}
