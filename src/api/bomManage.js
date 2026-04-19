import { request } from './http'

export const fetchBomManageItems = (params) =>
  request('/api/v1/bom-manage', { params })

export const fetchBomManageItemDetails = (params) =>
  request('/api/v1/bom-manage/details', { params })

export const refreshBomManageItems = (body) =>
  request('/api/v1/bom-manage/refresh', { method: 'POST', body })
