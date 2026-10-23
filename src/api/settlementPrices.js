import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
const prices = '/api/v1/settlement-prices'
export const fetchSettlementPrices = (params) => request(`${prices}/pricing`, { params })
export const fetchSettlementEffectiveHistory = (id, priceMonth) => request(`${prices}/${id}/effective-history`, { params: { priceMonth } })
export const fetchSettlementHistory = (id) => request(`${prices}/${id}/history`)
export const downloadSettlementOriginal = (row) => downloadAuthenticatedBlob(`${prices}/${row.id}/original`, row.sourceFileName)
const upload = (file, month, fingerprint) => {
  const body = new FormData()
  body.append('file', file); body.append('priceMonth', month)
  if (fingerprint) body.append('previewFingerprint', fingerprint)
  return body
}
export const previewSettlement = (file, month) => request(`${prices}/import/preview`, { method: 'POST', body: upload(file, month), suppressErrorToast: true })
export const importSettlement = (file, month, fingerprint) => request(`${prices}/import`, { method: 'POST', body: upload(file, month, fingerprint), suppressErrorToast: true })
