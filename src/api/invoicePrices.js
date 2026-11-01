import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const base = '/api/v1/invoice-prices'
const quiet = { suppressErrorToast: true }
const form = (file, fields = {}) => {
  const body = new FormData()
  body.append('file', file)
  for (const [key, value] of Object.entries(fields)) body.append(key, value)
  return body
}
export const fetchInvoicePrices = params => request(base, { ...quiet, params })
export const fetchInvoiceHistory = params => request(`${base}/history`, { ...quiet, params })
export const fetchInvoiceBatch = id => request(`${base}/imports/${id}`, quiet)
export const downloadInvoiceOriginal = (id, filename, options) => downloadAuthenticatedBlob(`${base}/imports/${id}/original`, filename, options)
export const invoiceImportApi = {
  preview: file => request(`${base}/preview`, { ...quiet, method: 'POST', body: form(file) }),
  publish: (file, orgCode, requestId) => request(`${base}/import`, { ...quiet, method: 'POST', body: form(file, { orgCode, requestId }) }),
}
