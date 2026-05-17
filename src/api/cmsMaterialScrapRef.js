import { request } from './http.js'

const BASE_URL = '/api/v1/cms-cost/material-scrap-refs'

export function normalizeCmsMaterialScrapRefPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list) ? page.list : (Array.isArray(page.records) ? page.records : []),
  }
}

export function toCmsMaterialScrapRefFormData({ file, businessUnitType = '' }) {
  const formData = new FormData()
  formData.append('file', file)
  if (businessUnitType) {
    formData.append('businessUnitType', businessUnitType)
  }
  return formData
}

export const importCmsMaterialScrapRefExcel = (payload) =>
  request(`${BASE_URL}/import`, {
    method: 'POST',
    body: toCmsMaterialScrapRefFormData(payload),
  })

export const fetchCmsMaterialScrapRefsCurrent = (params) =>
  request(`${BASE_URL}/current`, { params })
