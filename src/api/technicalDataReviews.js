import { request } from './http'

const id = (value) => encodeURIComponent(String(value))

export const fetchMyTechnicalDataReviews = ({
  current = 1,
  size = 20,
  taskStatus,
  accountingMonth,
} = {}) => request('/api/v2/technical-data/reviews/mine', {
  params: { current, size, taskStatus, accountingMonth },
  suppressErrorToast: true,
})

export const fetchTechnicalDataReviewTask = (taskId) =>
  request(`/api/v2/technical-data/reviews/tasks/${id(taskId)}`, {
    suppressErrorToast: true,
  })

export const fetchTechnicalDataReviewItem = (taskId, itemId) =>
  request(`/api/v2/technical-data/reviews/tasks/${id(taskId)}/items/${id(itemId)}`, {
    suppressErrorToast: true,
  })

export const decideTechnicalDataReviewItem = (
  taskId, item, decision, expectedTaskVersion, reason,
) => request(
  `/api/v2/technical-data/reviews/tasks/${id(taskId)}/items/${id(item.id)}/${decision === 'PASSED' ? 'pass' : 'return'}`,
  {
    method: 'POST',
    body: {
      productId: item.productId,
      submittedVersionId: item.submittedVersionId,
      expectedTaskVersion,
      expectedReviewItemVersion: item.rowVersion,
      reason,
    },
    suppressErrorToast: true,
  },
)
