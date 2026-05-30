import { request } from './http.js'

const BASE_URL = '/api/v1/quote-bom-details'

export function normalizeQuoteBomPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list) ? page.list : [],
    gaps: Array.isArray(page.gaps) ? page.gaps : [],
    found: page.found !== false,
    referenceFinishedCode: page.referenceFinishedCode || '',
    sourceTopProductCode: page.sourceTopProductCode || '',
    periodMonth: page.periodMonth || '',
    packageReferenceId: page.packageReferenceId || null,
  }
}

export const fetchQuoteBomPackageStructures = (params) =>
  request(`${BASE_URL}/package-structures`, { params })

export const fetchQuoteBomCostingProducts = (params) =>
  request(`${BASE_URL}/costing-products`, { params })

export const fetchQuoteBomCostingRows = (params) =>
  request(`${BASE_URL}/costing-rows`, { params })
