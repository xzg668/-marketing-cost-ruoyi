import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
import { request } from './http'

const base = '/api/v1/scrap-prices'

export const fetchScrapPrices = (params) => request(base, { params })
export const fetchScrapPrice = (id) => request(`${base}/${id}`)
export const trialScrapPrice = (id, body) => request(`${base}/${id}/trial`, { method: 'POST', body })
export const editScrapPrice = (id, body) => request(`${base}/${id}`, { method: 'PATCH', body })

const upload = (file, priceMonth, previewFingerprint) => {
  const body = new FormData()
  body.append('file', file)
  body.append('priceMonth', priceMonth)
  if (previewFingerprint) body.append('previewFingerprint', previewFingerprint)
  return body
}

export const previewScrapPrices = (file, month) =>
  request(`${base}/import/preview`, { method: 'POST', body: upload(file, month) })

export const importScrapPrices = (file, month, fingerprint) =>
  request(`${base}/import`, { method: 'POST', body: upload(file, month, fingerprint) })

const scrapHistoryBase = '/api/v1/scrap-prices/imports'
export const fetchScrapImports = params => request(scrapHistoryBase, { params, suppressErrorToast: true })
export const voidScrapImport = id => request(`${scrapHistoryBase}/${id}/void`, { method: 'POST', suppressErrorToast: true })
export const downloadScrapImport = (row, options) => downloadAuthenticatedBlob(
  `${scrapHistoryBase}/${row.id}/original`, row.file_name, options)
