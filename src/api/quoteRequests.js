import { request } from './http'

const encodePath = (value) => encodeURIComponent(String(value || '').trim())

export const fetchQuoteRequests = (params) =>
  request('/api/v1/quote-requests', { params })

export const fetchQuoteRequestDetail = (oaNo) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}`)

export const confirmQuoteRequestClassification = (oaNo, body) =>
  request(`/api/v1/quote-requests/${encodePath(oaNo)}/confirm-classification`, {
    method: 'POST',
    body,
  })
