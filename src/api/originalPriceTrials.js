import { request } from './http'

export const fetchLinkedEffectivePrices = (originalIds, pricingMonth) => request('/api/v1/price-linked/original-effective-prices', {
  method: 'POST', body: { originalIds, pricingMonth }, suppressErrorToast: true,
})
export const fetchRangeEffectivePrices = (originalIds, pricingMonth) => request('/api/v1/price-range/original-effective-prices', {
  method: 'POST', body: { originalIds, pricingMonth }, suppressErrorToast: true,
})
export const fetchLinkedEffectiveDetail = (id, pricingMonth) => request(`/api/v1/price-linked/items/${id}/original-effective-price`, {
  params: { pricingMonth }, suppressErrorToast: true,
})
export const fetchRangeEffectiveDetail = (id, pricingMonth) => request(`/api/v1/price-range/original-rules/${id}/effective-price`, {
  params: { pricingMonth }, suppressErrorToast: true,
})

export const trialLinkedOriginal = (id, body) => request(`/api/v1/price-linked/items/${id}/original-trial`, {
  method: 'POST', body, suppressErrorToast: true,
})
export const trialRangeOriginal = (id, body) => request(`/api/v1/price-range/original-rules/${id}/trial`, {
  method: 'POST', body, suppressErrorToast: true,
})
