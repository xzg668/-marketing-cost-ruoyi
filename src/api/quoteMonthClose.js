import { request } from './http'

const root = '/api/v1/quote-month-close'

export const fetchQuoteMonthClose = (periodMonth) =>
  request(root, { params: { periodMonth }, suppressErrorToast: true })

export const fetchQuoteMonthCloseHistory = () =>
  request(`${root}/history`, { suppressErrorToast: true })

export const confirmQuoteMonthClose = (periodMonth) =>
  request(`${root}/confirm`, { method: 'POST', body: { periodMonth }, suppressErrorToast: true })

export const revokeQuoteMonthClose = (closeId, periodMonth, reason) =>
  request(`${root}/${encodeURIComponent(closeId)}/revoke`, {
    method: 'POST', body: { periodMonth, reason }, suppressErrorToast: true,
  })
