import { request } from './http.js'

export const CMS_COST_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']
export const CMS_COST_MAX_FILE_SIZE = 20 * 1024 * 1024

export function getCmsCostUploadFile(uploadFile) {
  return uploadFile?.raw || uploadFile || null
}

export function getCmsCostUploadFileName(file) {
  return file?.name || ''
}

export function validateCmsCostFile(file) {
  if (!file) {
    return { valid: false, message: '请选择 Excel 文件' }
  }

  const name = getCmsCostUploadFileName(file)
  const lowerName = name.toLowerCase()
  const validExt = CMS_COST_ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  if (!validExt) {
    return { valid: false, message: '仅支持 .xlsx / .xls 文件' }
  }

  if (file.size && file.size > CMS_COST_MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 20MB' }
  }

  return { valid: true, message: '' }
}

export function normalizeCmsCostImportResult(response) {
  const result = response || {}
  return {
    importBatchId: result.importBatchId ?? null,
    batchNo: result.batchNo || '',
    status: result.status || '',
    planRowCount: Number(result.planRowCount || 0),
    workshopRowCount: Number(result.workshopRowCount || 0),
    subjectRowCount: Number(result.subjectRowCount || 0),
    subjectSettingRowCount: Number(result.subjectSettingRowCount || 0),
    salaryInsertCount: Number(result.salaryInsertCount || 0),
    salarySkipCount: Number(result.salarySkipCount || 0),
    salaryBlockedCount: Number(result.salaryBlockedCount || 0),
    auxInsertCount: Number(result.auxInsertCount || 0),
    auxSkipCount: Number(result.auxSkipCount || 0),
    errorCount: Number(result.errorCount || 0),
    errorMessage: result.errorMessage || '',
  }
}

export function canSubmitCmsCostImport(files) {
  return Boolean(files?.planFile || files?.workshopFile || files?.subjectFile || files?.subjectSettingFile)
}

export function missingCmsCostFileLabel(files) {
  return canSubmitCmsCostImport(files) ? '' : '至少一个 CMS Excel 文件'
}

function appendOptionalFile(formData, key, file) {
  if (file) {
    formData.append(key, file)
  }
}

function toCmsCostFormData({
  planFile,
  workshopFile,
  subjectFile,
  subjectSettingFile,
  dryRun = false,
  businessUnitType = '',
}) {
  const formData = new FormData()
  appendOptionalFile(formData, 'planFile', planFile)
  appendOptionalFile(formData, 'workshopFile', workshopFile)
  appendOptionalFile(formData, 'subjectFile', subjectFile)
  appendOptionalFile(formData, 'subjectSettingFile', subjectSettingFile)
  formData.append('dryRun', String(Boolean(dryRun)))
  if (businessUnitType) {
    formData.append('businessUnitType', businessUnitType)
  }
  return formData
}

export const importCmsCostExcel = (payload) =>
  request('/api/v1/cms-cost/import', {
    method: 'POST',
    body: toCmsCostFormData(payload),
  })

export function toCmsCostPageParams(filters = {}, current = 1, size = 20) {
  return {
    ...filters,
    current,
    size,
  }
}

export function normalizeCmsCostPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.list) ? page.list : (Array.isArray(page.records) ? page.records : []),
    rawType: page.rawType || '',
  }
}

export const fetchCmsCostImportRecords = (params) =>
  request('/api/v1/cms-cost/import-records', { params })

export const fetchCmsPlanCostRows = (params) =>
  request('/api/v1/cms-cost/plan-rows', { params })

export const fetchCmsWorkshopLaborRows = (params) =>
  request('/api/v1/cms-cost/workshop-rows', { params })

export const fetchCmsProductSubjectCostRows = (params) =>
  request('/api/v1/cms-cost/subject-rows', { params })

export const fetchCmsSubjectSettings = (params) =>
  request('/api/v1/cms-cost/subject-settings', { params })

export const fetchCmsCostDeriveLogs = (params) =>
  request('/api/v1/cms-cost/derive-logs', { params })

export const fetchCmsCostEffectiveSources = (params) =>
  request('/api/v1/cms-cost/effective-sources', { params })

export const fetchCmsCostEffectiveSourceLogs = (params) =>
  request('/api/v1/cms-cost/effective-source-logs', { params })

export const refreshCmsCostEffectiveSource = (body) =>
  request('/api/v1/cms-cost/effective-sources/refresh', { method: 'POST', body })
