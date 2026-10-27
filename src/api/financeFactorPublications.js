import { request } from './http'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'
import { financePreviousMonthExport } from '../pages/financeFactorPublicationUtils'

const BASE_PATH = '/api/v1/finance-factor-publications'

export const exportPreviousFinanceFactors = (scope, options) => {
  const { priceMonth, priceOrgCode, filename } = financePreviousMonthExport(scope)
  const query = new URLSearchParams({ priceMonth, priceOrgCode })
  return downloadAuthenticatedBlob(`${BASE_PATH}/export-previous-month?${query}`, filename, options)
}

export const fetchFinanceFactorSnapshot = (params, copperOnly = false) =>
  request(`${BASE_PATH}${copperOnly ? '/cu' : ''}`, { params })

const importForm = (file, context, previewFingerprint) => {
  const form = new FormData()
  form.append('file', file)
  form.append('priceMonth', context.priceMonth)
  form.append('priceOrgCode', context.priceOrgCode)
  if (context.defaultSchemeCode) form.append('defaultSchemeCode', context.defaultSchemeCode)
  if (context.sheetName) form.append('sheetName', context.sheetName)
  if (previewFingerprint) form.append('previewFingerprint', previewFingerprint)
  return form
}

export const previewFinanceFactors = (file, context) =>
  request(`${BASE_PATH}/preview`, { method: 'POST', body: importForm(file, context) })

export const publishFinanceFactors = (file, context, previewFingerprint) =>
  request(`${BASE_PATH}/publish`, {
    method: 'POST',
    body: importForm(file, context, previewFingerprint),
  })

export const previewFinanceCopper = (monthlyPriceId, body) =>
  request(`${BASE_PATH}/cu/${monthlyPriceId}/preview`, { method: 'POST', body })

export const publishFinanceCopper = (monthlyPriceId, body) =>
  request(`${BASE_PATH}/cu/${monthlyPriceId}/publish`, { method: 'POST', body })
