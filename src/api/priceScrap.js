// CMS 回收废料当前价 API：自制件新计算只按 scrapCode 取当前有效价，不按月份匹配。
import { request } from './http'

export const fetchScrapItems = (params) =>
  request('/api/v1/price-scrap/items', { params })

export const createScrapItem = (body) =>
  request('/api/v1/price-scrap/items', { method: 'POST', body })

export const updateScrapItem = (id, body) =>
  request(`/api/v1/price-scrap/items/${id}`, { method: 'PATCH', body })

export const deleteScrapItem = (id) =>
  request(`/api/v1/price-scrap/items/${id}`, { method: 'DELETE' })

export const importScrapItems = (body) =>
  request('/api/v1/price-scrap/items/import', { method: 'POST', body })

export const fetchCurrentScrapItem = (scrapCode) =>
  request('/api/v1/price-scrap/items/current', { params: { scrapCode } })
