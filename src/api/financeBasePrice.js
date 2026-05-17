import { request } from './http'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * T19：财务基价（影响因素）列表查询 —— 支持按价期月 / 关键字过滤（T05/T06）。
 */
export const list = (params) =>
  request('/api/v1/base-prices', { params })

/**
 * V4：影响因素表菜单读取 V2 事实源的导入批次。
 * 数据来自 lp_factor_upload_batch，不再依赖前端内存或旧 base-prices 批次号。
 */
export const fetchFactorImportBatches = (params) =>
  requestWithFactorEndpointFallback(
    '/api/v1/price-linked/items/import-history',
    '/api/v1/price-linked/factors/import-batches',
    { params },
  )

/**
 * V4：读取某个批次的影响因素行级来源明细。
 * 数据来自 lp_factor_row_ref + lp_factor_identity + lp_factor_monthly_price。
 */
export const fetchFactorImportBatchDetail = (batchId) =>
  requestWithFactorEndpointFallback(
    `/api/v1/price-linked/items/import-history/${batchId}`,
    `/api/v1/price-linked/factors/import-batches/${batchId}`,
  )

const isNotFound = (error) =>
  /404|资源不存在|not found/i.test(String(error?.message || ''))

/**
 * V4-09 回归兜底：
 * 影响因素表先走已稳定上线的 items/import-history 持久化接口，避免现场后端未重启时
 * factors 语义接口 404 导致页面空表；如果旧接口不可用，再尝试新的 factors 接口。
 */
const requestWithFactorEndpointFallback = async (primaryPath, fallbackPath, options = {}) => {
  try {
    return await request(primaryPath, options)
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
    return request(fallbackPath, options)
  }
}

/**
 * V4-06：影响因素月度调价，只改 lp_factor_monthly_price.price，不改公式绑定关系。
 */
export const adjustFactorMonthlyPrice = (factorMonthlyPriceId, body) =>
  request(`/api/v1/price-linked/factors/monthly-prices/${factorMonthlyPriceId}/adjust`, {
    method: 'PATCH',
    body,
  })

/**
 * V4-06：查询影响因素月度价格调价日志。
 */
export const fetchFactorMonthlyPriceChangeLogs = (factorMonthlyPriceId) =>
  request(
    `/api/v1/price-linked/factors/monthly-prices/${factorMonthlyPriceId}/change-logs`
  )

/**
 * V4-07：反查某个影响因素身份被哪些联动价行引用。
 */
export const fetchFactorLinkedItems = (factorIdentityId, params) =>
  request(`/api/v1/factor-identities/${factorIdentityId}/linked-items`, {
    params,
  })

/**
 * V5-07：影响因素表月度列表，补最近调价价、调价用途、调价批次。
 */
export const fetchFactorMonthlyPrices = (params) =>
  request('/api/v1/price-linked/factor-adjust/monthly-prices', { params })

/**
 * V5-07：调价批次分页查询。
 */
export const fetchFactorAdjustBatches = (params) =>
  request('/api/v1/price-linked/factor-adjust/batches', { params })

/**
 * V5-07：调价批次详情。
 */
export const fetchFactorAdjustBatchDetail = (batchId) =>
  request(`/api/v1/price-linked/factor-adjust/batches/${batchId}`)

/**
 * V5-07：调价明细分页查询。
 */
export const fetchFactorAdjustPrices = (params) =>
  request('/api/v1/price-linked/factor-adjust/prices', { params })

/**
 * V5-06：导出影响因素调价模板。
 */
export const exportFactorAdjustTemplate = async (params) => {
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
  const response = await fetch(
    `${API_BASE_URL}/api/v1/price-linked/factor-adjust/export-template?${query}`,
    { headers },
  )
  if (!response.ok) {
    throw new Error(await response.text() || '导出调价模板失败')
  }
  const disposition = response.headers.get('content-disposition') || ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  return {
    blob: await response.blob(),
    fileName: encodedName
      ? decodeURIComponent(encodedName)
      : `factor-adjust-template-${params?.pricingMonth || 'month'}.xlsx`,
  }
}

/**
 * V5-09：导入影响因素月度调价 Excel。
 */
export const importFactorAdjustExcel = (file, options = {}) => {
  const form = new FormData()
  form.append('file', file)
  form.append('pricingMonth', options.pricingMonth)
  form.append('businessUnitType', options.businessUnitType)
  form.append('usageScope', options.usageScope)
  if (options.remark) {
    form.append('remark', options.remark)
  }
  return request('/api/v1/price-linked/factor-adjust/import', {
    method: 'POST',
    body: form,
  })
}

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
