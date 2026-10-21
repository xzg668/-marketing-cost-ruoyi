import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
const prices = '/api/v1/settlement-prices'
const bases = '/api/v1/settlement-base-prices'
export const fetchSettlementPrices = (params) => request(`${prices}/pricing`, { params })
export const fetchSettlementHistory = (id) => request(`${prices}/${id}/history`)
export const confirmSettlementWeights = (id, body) => request(`${prices}/${id}/weights`, { method: 'PATCH', body })
export const downloadSettlementOriginal = (row) => downloadAuthenticatedBlob(`${prices}/${row.id}/original`, row.sourceFileName)
const upload = (file, month, fingerprint) => {
  const body = new FormData()
  body.append('file', file); body.append('priceMonth', month)
  if (fingerprint) body.append('previewFingerprint', fingerprint)
  return body
}
export const previewSettlement = (file, month) => request(`${prices}/import/preview`, { method: 'POST', body: upload(file, month), suppressErrorToast: true })
export const importSettlement = (file, month, fingerprint) => request(`${prices}/import`, { method: 'POST', body: upload(file, month, fingerprint), suppressErrorToast: true })
export const fetchSettlementBase = (month) => request(bases, { params: { priceMonth: month } })
export const fetchSettlementBaseHistory = (month) => request(`${bases}/history`, { params: { priceMonth: month } })
export const saveSettlementBase = (body) => request(bases, { method: 'PUT', body })
