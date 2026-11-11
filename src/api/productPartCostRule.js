import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const base = '/api/v1/rules/product-part-cost'
export const listProductPartCostRules = (params = {}) => request(base, { params })
export const createProductPartCostRule = (body) => request(base, { method: 'POST', body })
export const updateProductPartCostRule = (id, body) => request(`${base}/${id}`, { method: 'PUT', body })
export const deleteProductPartCostRule = (id, revision) => request(`${base}/${id}`, { method: 'DELETE', params: { revision } })
export const downloadProductPartCostTemplate = () => downloadAuthenticatedBlob(`${base}/template`, '成品零件成本配置模板.xlsx')
export const importProductPartCostRules = (file) => {
  const body = new FormData()
  body.append('file', file)
  return request(`${base}/import-excel`, { method: 'POST', body })
}
