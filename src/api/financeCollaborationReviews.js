import { request } from './http'

const id = (value) => encodeURIComponent(String(value))

export const fetchMyFinanceReviews = (completed = false) =>
  request(`/api/v1/collaboration/finance-reviews/mine?completed=${completed ? 'true' : 'false'}`, {
    suppressErrorToast: true,
  })

export const fetchFinanceReview = (reviewId) =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}`, { suppressErrorToast: true })

export const fetchFinanceReviewItem = (reviewId, reviewItemId) =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}/items/${id(reviewItemId)}`)

export const decideFinanceReviewItem = (reviewId, reviewItemId, decision, reason = null) =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}/items/${id(reviewItemId)}/decision`, {
    method: 'PUT', body: { decision, reason },
  })

export const rejectFinanceReview = (reviewId, comment = '') =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}/reject`, {
    method: 'POST', body: { comment },
  })

export const approveFinanceReview = (reviewId, comment = '') =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}/approve`, {
    method: 'POST', body: { comment }, timeout: 70000,
  })

export const retryFinanceReviewRecheck = (reviewId) =>
  request(`/api/v1/collaboration/finance-reviews/${id(reviewId)}/retry-recheck`, {
    method: 'POST', timeout: 70000,
  })
