import { request } from './http'

const id = (value) => encodeURIComponent(String(value))

export const fetchMyTechnicalDataTasks = ({
  current = 1,
  size = 20,
  taskStatus,
  accountingMonth,
} = {}) => request('/api/v2/technical-data/tasks/mine', {
  params: { current, size, taskStatus, accountingMonth },
  suppressErrorToast: true,
})

export const fetchMyTechnicalDataProducts = ({
  current = 1,
  size = 20,
  taskStatus,
  accountingMonth,
  keyword,
} = {}) => request('/api/v2/technical-data/products/mine', {
  params: { current, size, taskStatus, accountingMonth, keyword },
  suppressErrorToast: true,
})

export const fetchTechnicalDataTask = (taskId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}`, { suppressErrorToast: true })

export const validateTechnicalDataTask = (taskId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/validate`, {
    method: 'POST',
    suppressErrorToast: true,
  })

export const submitTechnicalDataTask = (
  taskId, expectedTaskVersion, idempotencyKey,
) => request(`/api/v2/technical-data/tasks/${id(taskId)}/submit`, {
  method: 'POST',
  body: { expectedTaskVersion, idempotencyKey },
  suppressErrorToast: true,
})

export const exchangeTechnicalDataAccessTicket = (ticket, expectedUserId) =>
  request('/api/v2/technical-data/access-tickets/exchange', {
    method: 'POST',
    body: { ticket, expectedUserId },
    skipAuth: true,
    suppressErrorToast: true,
  })

export const reassignTechnicalDataTask = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/admin/reassign`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const startTechnicalDataProxyEntry = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/admin/proxy-entry`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const unlockTechnicalDataDraft = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/admin/unlock-draft`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const voidTechnicalDataTask = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/admin/void`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const retryTechnicalDataExternalTask = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/external-task/retry`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const saveTechnicalDataProfile = (productId, profile) =>
  request(`/api/v2/technical-data/products/${id(productId)}/profile`, {
    method: 'PATCH',
    body: {
      productModel: profile.productModel,
      productProperty: profile.productProperty,
      newProduct: profile.newProduct,
      expectedVersion: profile.expectedVersion,
    },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataPackage = (productId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package`, {
    suppressErrorToast: true,
  })

export const fetchTechnicalDataPackageReferences = (productId, keyword = '') =>
  request(`/api/v2/technical-data/products/${id(productId)}/package/references`, {
    params: { keyword },
    suppressErrorToast: true,
  })

export const applyTechnicalDataPackageReference = (productId, sourceVersionId, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package/reference`, {
    method: 'POST',
    body: { sourceVersionId, expectedVersion },
    suppressErrorToast: true,
  })

export const saveTechnicalDataPackage = (productId, items, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package`, {
    method: 'PUT',
    body: { items, expectedVersion },
    suppressErrorToast: true,
  })

export const deleteTechnicalDataPackageItem = (productId, itemId, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package/items/${id(itemId)}`, {
    method: 'DELETE',
    params: { expectedVersion },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataAuxiliary = (productId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary`, {
    suppressErrorToast: true,
  })

export const fetchTechnicalDataAuxiliaryReferences = (productId, keyword = '') =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary/references`, {
    params: { keyword },
    suppressErrorToast: true,
  })

export const applyTechnicalDataAuxiliaryReference = (
  productId, sourceType, sourceId, expectedVersion,
) => request(`/api/v2/technical-data/products/${id(productId)}/auxiliary/reference`, {
  method: 'POST',
  body: { sourceType, sourceId, expectedVersion },
  suppressErrorToast: true,
})

export const saveTechnicalDataAuxiliary = (productId, items, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary`, {
    method: 'PUT',
    body: { items, expectedVersion },
    suppressErrorToast: true,
  })

export const deleteTechnicalDataAuxiliaryItem = (productId, itemId, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary/items/${id(itemId)}`, {
    method: 'DELETE',
    params: { expectedVersion },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataSalary = (productId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary`, {
    suppressErrorToast: true,
  })

export const fetchTechnicalDataSalaryReferences = (productId, keyword = '') =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary/references`, {
    params: { keyword },
    suppressErrorToast: true,
  })

export const applyTechnicalDataSalaryReference = (
  productId, sourceType, sourceId, expectedVersion,
) => request(`/api/v2/technical-data/products/${id(productId)}/salary/reference`, {
  method: 'POST',
  body: { sourceType, sourceId, expectedVersion },
  suppressErrorToast: true,
})

export const saveTechnicalDataSalary = (productId, items, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary`, {
    method: 'PUT',
    body: { items, expectedVersion },
    suppressErrorToast: true,
  })

export const deleteTechnicalDataSalaryItem = (productId, itemId, expectedVersion) =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary/items/${id(itemId)}`, {
    method: 'DELETE',
    params: { expectedVersion },
    suppressErrorToast: true,
  })
