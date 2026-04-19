import { request } from './http'

// 单据列表
export const fetchSettleList = (params) =>
  request('/api/v1/price-settle', { params })

// 单据详情（含明细）
export const fetchSettleDetail = (id) =>
  request(`/api/v1/price-settle/${id}`)

// 新增单据
export const createSettle = (body) =>
  request('/api/v1/price-settle', { method: 'POST', body })

// 编辑单据
export const updateSettle = (id, body) =>
  request(`/api/v1/price-settle/${id}`, { method: 'PATCH', body })

// 删除单据（含明细）
export const deleteSettle = (id) =>
  request(`/api/v1/price-settle/${id}`, { method: 'DELETE' })

// 导入（单据+明细）
export const importSettle = (body) =>
  request('/api/v1/price-settle/import', { method: 'POST', body })

// 新增明细行
export const createSettleItem = (settleId, body) =>
  request(`/api/v1/price-settle/${settleId}/items`, { method: 'POST', body })

// 编辑明细行
export const updateSettleItem = (id, body) =>
  request(`/api/v1/price-settle/items/${id}`, { method: 'PATCH', body })

// 删除明细行
export const deleteSettleItem = (id) =>
  request(`/api/v1/price-settle/items/${id}`, { method: 'DELETE' })
