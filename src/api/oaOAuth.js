import { request } from './http'

export const startOaLogin = body => request('/api/v1/auth/oa/start', {
  method: 'POST', body, skipAuth: true, suppressErrorToast: true,
})
export const exchangeOaLogin = body => request('/api/v1/auth/oa/exchange', {
  method: 'POST', body, skipAuth: true, suppressErrorToast: true,
})
export const fetchOaIdentity = () => request('/api/v1/auth/oa/me', { suppressErrorToast: true })
