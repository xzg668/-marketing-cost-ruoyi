import { request } from './http.js'

const BASE_URL = '/api/v1/bom/material-shape-policies'

export const fetchMaterialQuoteShapePolicies = (params) =>
  request(BASE_URL, { params })

export const fetchMaterialQuoteShapePolicy = (id) =>
  request(`${BASE_URL}/${id}`)

export const createMaterialQuoteShapePolicy = (body) =>
  request(BASE_URL, { method: 'POST', body })

export const updateMaterialQuoteShapePolicy = (id, body) =>
  request(`${BASE_URL}/${id}`, { method: 'PUT', body })

export const toggleMaterialQuoteShapePolicy = (id, enabled) =>
  request(`${BASE_URL}/${id}/enabled`, {
    method: 'PUT',
    body: { enabled },
  })

export const deleteMaterialQuoteShapePolicy = (id) =>
  request(`${BASE_URL}/${id}`, { method: 'DELETE' })

export const fetchMaterialQuoteShapePolicyLogs = (params = {}) =>
  request('/api/v1/system/operation-log', {
    params: {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      title: '料品形态规则',
      operName: params.operName,
    },
  })
