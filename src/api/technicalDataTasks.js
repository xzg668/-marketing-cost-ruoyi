import { request } from './http'

const id = (value) => encodeURIComponent(String(value))

export const publishTechnicalDataTasks = ({ requestId, oaFormItemIds, accountingMonth, assigneeUserId, moduleAssignees, checkFingerprints, dueAt }) =>
  request('/api/v2/technical-data/tasks/publish-from-quote', {
    method: 'POST',
    body: { requestId, oaFormItemIds, accountingMonth, assigneeUserId, moduleAssignees, checkFingerprints, dueAt },
    suppressErrorToast: true,
  })

export const prepareTechnicalDataTask = ({ requestId, oaFormItemId, accountingMonth, checkFingerprint }) =>
  request('/api/v2/technical-data/tasks/prepare-from-quote', {
    method: 'POST',
    body: { requestId, oaFormItemId, accountingMonth, checkFingerprint },
    suppressErrorToast: true,
  })

export const checkTechnicalDataSources = (itemId, accountingMonth) =>
  request(`/api/v2/technical-data/quote-items/${id(itemId)}/check`, {
    method: 'POST', params: { accountingMonth }, suppressErrorToast: true,
  })

export const fetchTechnicalDataAssignees = (keyword = '', limit = 50) =>
  request('/api/v2/technical-data/assignees', { params: { keyword, limit } })

export const fetchTechnicalDataProducts = ({
  current = 1,
  size = 20,
  taskStatus,
  accountingMonth,
  keyword,
} = {}) => request('/api/v2/technical-data/products', {
  params: { current, size, taskStatus, accountingMonth, keyword },
  suppressErrorToast: true,
})

export const fetchTechnicalDataTask = (taskId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}`, { suppressErrorToast: true })

export const fetchTechnicalDataDrawing = (productId, versionId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/drawing`, {
    params: { versionId }, suppressErrorToast: true,
  })

export const recheckTechnicalDataDrawing = (productId, { expectedVersion, maintained, drawingNo }) =>
  request(`/api/v2/technical-data/products/${id(productId)}/drawing/recheck`, {
    method: 'POST', body: { expectedVersion, maintained, drawingNo }, suppressErrorToast: true,
  })

export const fetchTechnicalDataManufacturing = (productId, versionId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/manufacturing`, {
    params: { versionId }, suppressErrorToast: true,
  })

export const fetchTechnicalDataRawMaterial = (productId, materialNo) =>
  request(`/api/v2/technical-data/products/${id(productId)}/manufacturing/raw-material`, {
    params: { materialNo }, suppressErrorToast: true,
  })

export const saveTechnicalDataManufacturing = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/manufacturing`, {
    method: 'PUT', body, suppressErrorToast: true,
  })

export const fetchTechnicalDataWorkflow = (taskId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/workflow`, { suppressErrorToast: true })

export const confirmTechnicalDataFinance = (taskId, approvalFingerprint) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/finance/confirm`, {
    method: 'POST', body: { approvalFingerprint }, suppressErrorToast: true,
  })

export const returnTechnicalDataPerson = (taskId, body) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/finance/return`, {
    method: 'POST', body, suppressErrorToast: true,
  })

export const validateTechnicalDataTask = (taskId, assigneeUserId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/validate`, {
    params: { assigneeUserId },
    method: 'POST',
    suppressErrorToast: true,
  })

export const submitTechnicalDataTask = (
  taskId, expectedTaskVersion, expectedVersion, idempotencyKey, assigneeUserId,
) => request(`/api/v2/technical-data/tasks/${id(taskId)}/submit`, {
  method: 'POST',
  body: { expectedTaskVersion, expectedVersion, idempotencyKey, assigneeUserId },
  suppressErrorToast: true,
})

export const exchangeTechnicalDataAccessTicket = (taskId, code) =>
  request('/api/v2/technical-data/access-tickets/exchange', {
    method: 'POST',
    body: { taskId, code },
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
      productProperty: profile.productProperty,
      hasAdditionalFees: profile.hasAdditionalFees,
      unitToolingFee: profile.unitToolingFee,
      unitMouldFee: profile.unitMouldFee,
      unitCertificationFee: profile.unitCertificationFee,
      expectedVersion: profile.expectedVersion,
    },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataPackage = (productId, versionId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package`, {
    params: { versionId },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataPackageReferences = (productId, keyword = '') =>
  request(`/api/v2/technical-data/products/${id(productId)}/package/references`, {
    params: { keyword },
    suppressErrorToast: true,
  })

export const fetchTechnicalDataPackageChildren = (productId, keyword) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package/children`, {
    params: { keyword },
    suppressErrorToast: true,
  })

export const saveTechnicalDataPackage = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/package`, {
    method: 'PUT',
    body,
    suppressErrorToast: true,
  })

export const fetchTechnicalDataSolder = (productId, versionId = null) =>
  request(`/api/v2/technical-data/products/${id(productId)}/solder`, {
    method: 'GET', suppressErrorToast: true, params: versionId == null ? {} : { versionId },
  })

export const fetchTechnicalDataSolderReferences = (productId, keyword) =>
  request(`/api/v2/technical-data/products/${id(productId)}/solder/references`, {
    method: 'GET', suppressErrorToast: true, params: { keyword },
  })

export const fetchTechnicalDataSolderMaterial = (productId, materialNo) =>
  request(`/api/v2/technical-data/products/${id(productId)}/solder/material`, {
    method: 'GET', suppressErrorToast: true, params: { materialNo },
  })

export const saveTechnicalDataSolder = (productId, data) =>
  request(`/api/v2/technical-data/products/${id(productId)}/solder`, { method: 'PUT', body: data, suppressErrorToast: true })

export const fetchTechnicalDataAuxiliary = (productId, versionId) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary`, {
    params: { versionId }, suppressErrorToast: true,
  })

export const fetchTechnicalDataAuxiliaryReferences = (productId, keyword) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary/references`, {
    params: { keyword }, suppressErrorToast: true,
  })

export const previewTechnicalDataAuxiliaryUpload = (productId, file) => {
  const body = new FormData()
  body.append('file', file)
  return request(`/api/v2/technical-data/products/${id(productId)}/auxiliary/upload-preview`, {
    method: 'POST', body, suppressErrorToast: true,
  })
}

export const saveTechnicalDataAuxiliary = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/auxiliary`, {
    method: 'PUT', body, suppressErrorToast: true,
  })

export const downloadTechnicalDataAuxiliary = (productId, kind, fileName, versionId) =>
  downloadTechnicalDataFile(productId, 'auxiliary', kind, fileName, versionId)

export const downloadTechnicalDataSalary = (productId, kind, fileName, versionId) =>
  downloadTechnicalDataFile(productId, 'salary', kind, fileName, versionId)

async function downloadTechnicalDataFile(productId, module, kind, fileName, versionId) {
  if (!['template', 'file'].includes(kind)) throw new Error('补录文件类型无效')
  const token = window.location.pathname.startsWith('/technical-data-access')
    ? sessionStorage.getItem('technicalDataAccessToken') : localStorage.getItem('token')
  const params = versionId == null ? '' : `?versionId=${id(versionId)}`
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v2/technical-data/products/${id(productId)}/${module}/${kind}${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.msg || '补录文件下载失败')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fetchTechnicalDataNetLoss = (productId, versionId = null) =>
  request(`/api/v2/technical-data/products/${id(productId)}/net-loss`, {
    method: 'GET', suppressErrorToast: true, params: versionId ? { versionId: id(versionId) } : undefined
  })

export const fetchTechnicalDataNetLossReferences = (productId, searchBy, keyword) =>
  request(`/api/v2/technical-data/products/${id(productId)}/net-loss/references`, {
    method: 'GET', suppressErrorToast: true, params: { searchBy, keyword }
  })

export const saveTechnicalDataNetLoss = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/net-loss`, {
    method: 'PUT', body, suppressErrorToast: true
  })

export const fetchTechnicalDataSalary = (productId, versionId = null) =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary`, {
    params: versionId == null ? {} : { versionId: id(versionId) }, suppressErrorToast: true,
  })

export const fetchTechnicalDataSalaryReferences = (productId, keyword, entryMode = 'REFERENCE') =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary/references`, {
    params: { keyword, entryMode }, suppressErrorToast: true,
  })

export const saveTechnicalDataSalary = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/salary`, {
    method: 'PUT', body, suppressErrorToast: true,
  })

export const previewTechnicalDataSalaryUpload = (productId, file) => {
  const body = new FormData()
  body.append('file', file)
  return request(`/api/v2/technical-data/products/${id(productId)}/salary/upload-preview`, {
    method: 'POST', body, suppressErrorToast: true,
  })
}

export const retryTechnicalDataWorkflow = (taskId, recipientId) =>
  request(`/api/v2/technical-data/tasks/${id(taskId)}/workflow/retry`, {
    method: 'POST', body: { recipientId }, suppressErrorToast: true,
  })

export const fetchTechnicalDataPrice = productId =>
  request(`/api/v2/technical-data/products/${id(productId)}/price`, { suppressErrorToast: true })

export const fetchTechnicalDataPriceReferences = (productId, searchBy, keyword) =>
  request(`/api/v2/technical-data/products/${id(productId)}/price/references?${new URLSearchParams({ searchBy, keyword })}`, { suppressErrorToast: true })

export const saveTechnicalDataPrice = (productId, body) =>
  request(`/api/v2/technical-data/products/${id(productId)}/price`, { method: 'PUT', body, suppressErrorToast: true })

export const recheckTechnicalDataPrice = productId =>
  request(`/api/v2/technical-data/products/${id(productId)}/price/recheck`, { method: 'POST', suppressErrorToast: true })
