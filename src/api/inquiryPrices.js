import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const base = '/api/v1/inquiry-prices'
const quiet = { suppressErrorToast: true }
const form = (file, fields) => {
  const body = new FormData()
  body.append('file', file)
  for (const [key, value] of Object.entries(fields)) body.append(key, value)
  return body
}
export const fetchInquiryPrices = params => request(base, { ...quiet, params })
export const fetchInquiryHistory = params => request(`${base}/history`, { ...quiet, params })
export const fetchInquiryBatch = id => request(`${base}/imports/${id}`, quiet)
export const downloadInquiryOriginal = (id, filename, options) => downloadAuthenticatedBlob(`${base}/imports/${id}/original`, filename, options)
export const inquiryImportApi = {
  preview: (file, priceMonth) => request(`${base}/preview`, { ...quiet, method: 'POST', body: form(file, { priceMonth }) }),
  publish: (file, priceMonth, requestId) => request(`${base}/import`, { ...quiet, method: 'POST', body: form(file, { priceMonth, requestId }) }),
}
