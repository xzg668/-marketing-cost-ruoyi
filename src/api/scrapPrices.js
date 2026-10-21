import { request } from './http'

const base = '/api/v1/scrap-prices'

export const fetchScrapPrices = (params) => request(base, { params })
export const fetchScrapPrice = (id) => request(`${base}/${id}`)
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
