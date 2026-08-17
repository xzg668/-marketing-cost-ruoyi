import { request } from './http'

const id = (value) => encodeURIComponent(String(value))
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const fetchMyTechnicalTasks = () =>
  request('/api/v1/collaboration/product-tasks/mine', { suppressErrorToast: true })

export const fetchTechnicalTask = (taskId) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}`, { suppressErrorToast: true })

export const startTechnicalTask = (taskId, expectedVersion) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/start`, {
    method: 'POST',
    body: { expectedVersion },
  })

export const validateTechnicalTask = (taskId, expectedVersion) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/validate`, {
    method: 'POST',
    body: { expectedVersion },
  })

export const submitTechnicalTask = (taskId, expectedVersion) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/submit`, {
    method: 'POST',
    body: { expectedVersion },
  })

export const fetchTechnicalTaskChangeLog = (taskId) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/change-log`)

export const fetchTechnicalBomWorkspace = (taskId) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-workspace`)

export const searchTechnicalBomCandidates = (taskId, filters = {}) => {
  const params = new URLSearchParams()
  for (const key of ['keyword', 'spec', 'model']) {
    const value = String(filters[key] || '').trim()
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-candidates${query ? `?${query}` : ''}`)
}

export const fetchTechnicalBomCandidateTree = (taskId, productCode, bomPurpose) => {
  const params = new URLSearchParams()
  if (String(bomPurpose || '').trim()) params.set('bomPurpose', bomPurpose)
  const query = params.toString()
  return request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-candidates/${id(productCode)}${query ? `?${query}` : ''}`)
}

export const copyTechnicalBomDraft = (taskId, body) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-draft/copy`, {
    method: 'POST', body,
  })

export const createTechnicalBomDraft = (taskId, body) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-draft/new`, {
    method: 'POST', body,
  })

export const saveTechnicalBomDraft = (taskId, body) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/bom-draft`, {
    method: 'POST', body,
  })

export const downloadTechnicalElectronicBomTemplate = async (taskId) => {
  const headers = {}
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(
    `${API_BASE_URL}/api/v1/collaboration/product-tasks/${id(taskId)}/bom-draft/export-electronic-template`,
    { headers },
  )
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || contentType.includes('application/json')) {
    let message = '电子图库BOM模板下载失败'
    try {
      const payload = await response.json()
      message = payload?.msg || payload?.message || message
    } catch { /* 保留统一提示 */ }
    throw new Error(message)
  }
  const disposition = response.headers.get('content-disposition') || ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : '电子图库BOM协作模板.xlsx',
  }
}

export const verifyTechnicalElectronicBom = (taskId, expectedVersion, bomPurpose = '主制造') =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/electronic-bom/verify`, {
    method: 'POST', body: { expectedVersion, bomPurpose }, timeout: 70000,
  })

export const fetchTechnicalPackageWorkspace = (taskId) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/package-draft`)

export const searchTechnicalPackageSources = (taskId, sourceMode, keyword = '') => {
  const path = sourceMode === 'PACKAGE_PARENT' ? 'package-parents' : 'reference-products'
  const params = new URLSearchParams()
  if (String(keyword || '').trim()) params.set('keyword', String(keyword).trim())
  const query = params.toString()
  return request(`/api/v1/collaboration/product-tasks/${id(taskId)}/package/${path}${query ? `?${query}` : ''}`)
}

export const copyTechnicalPackageDraft = (taskId, body) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/package-draft/copy`, {
    method: 'POST', body,
  })

export const saveTechnicalPackageDraft = (taskId, body) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/package-draft`, {
    method: 'PUT', body,
  })

export const checkTechnicalPackagePrice = (taskId, expectedVersion) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/package-draft/check-price`, {
    method: 'POST', body: { expectedVersion },
  })

export const fetchTechnicalPriceGaps = (taskId) =>
  request(`/api/v1/collaboration/product-tasks/${id(taskId)}/price-gaps`)

export const searchFormalPriceReferences = (gapId, filters = {}) => {
  const params = new URLSearchParams()
  if (String(filters.keyword || '').trim()) params.set('keyword', String(filters.keyword).trim())
  if (String(filters.priceType || '').trim()) params.set('priceType', String(filters.priceType).trim())
  const query = params.toString()
  return request(`/api/v1/collaboration/price-gaps/${id(gapId)}/formal-prices${query ? `?${query}` : ''}`)
}

export const copyTechnicalPriceDraft = (gapId, body) =>
  request(`/api/v1/collaboration/price-gaps/${id(gapId)}/draft/copy`, {
    method: 'POST', body,
  })

export const createTechnicalPriceDraft = (gapId, priceType) =>
  request(`/api/v1/collaboration/price-gaps/${id(gapId)}/draft/direct`, {
    method: 'POST', body: { priceType },
  })

export const fetchTechnicalPriceDraft = (draftId) =>
  request(`/api/v1/collaboration/price-drafts/${id(draftId)}`)

export const saveTechnicalPriceDraft = (draftId, body) =>
  request(`/api/v1/collaboration/price-drafts/${id(draftId)}`, {
    method: 'PUT', body,
  })

export const validateTechnicalPriceDraft = (draftId, expectedVersion) =>
  request(`/api/v1/collaboration/price-drafts/${id(draftId)}/validate`, {
    method: 'POST', body: { expectedVersion },
  })

export const changeTechnicalPriceDraftReference = (draftId, body) =>
  request(`/api/v1/collaboration/price-drafts/${id(draftId)}/change-reference`, {
    method: 'POST', body,
  })
