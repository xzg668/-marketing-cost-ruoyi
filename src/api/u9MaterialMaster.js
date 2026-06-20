import { request } from './http.js'

const BASE_URL = '/api/v1/base/u9/material-master'

export const U9_MATERIAL_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']
export const U9_MATERIAL_MAX_FILE_SIZE = 150 * 1024 * 1024
export const U9_MATERIAL_IMPORT_TIMEOUT = 10 * 60 * 1000
export const U9_MATERIAL_ORGANIZATIONS = [
  { label: '商用', value: 'COMMERCIAL' },
  { label: '板换', value: 'PLATE' },
]

export function getU9MaterialUploadFile(uploadFile) {
  return uploadFile?.raw || uploadFile || null
}

export function getU9MaterialUploadFileName(file) {
  return file?.name || ''
}

export function validateU9MaterialFile(file) {
  if (!file) {
    return { valid: false, message: '请选择 U9 料品主档 Excel' }
  }
  const name = getU9MaterialUploadFileName(file)
  const lowerName = name.toLowerCase()
  const validExt = U9_MATERIAL_ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  if (!validExt) {
    return { valid: false, message: '仅支持 .xlsx / .xls 文件' }
  }
  if (file.size && file.size > U9_MATERIAL_MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 150MB' }
  }
  return { valid: true, message: '' }
}

export function normalizeU9MaterialRawPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : []),
  }
}

export function normalizeU9MaterialImportResult(response) {
  const result = response || {}
  return {
    datasetCode: result.datasetCode || '',
    sourceType: result.sourceType || '',
    mappingVersion: result.mappingVersion || '',
    totalCount: Number(result.totalCount || 0),
    successCount: Number(result.successCount || 0),
    failCount: Number(result.failCount || 0),
    status: result.status || '',
    message: result.message || '',
    errors: Array.isArray(result.errors) ? result.errors : [],
  }
}

export function toU9MaterialImportFormData({ file, organizationCode = 'COMMERCIAL' }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('organizationCode', organizationCode)
  return formData
}

export const importU9MaterialExcel = (payload) =>
  request(`${BASE_URL}/import`, {
    method: 'POST',
    body: toU9MaterialImportFormData(payload),
    timeout: U9_MATERIAL_IMPORT_TIMEOUT,
  })

export const fetchU9MaterialRaw = (params) =>
  request(`${BASE_URL}/raw`, { params })

export const fetchU9MaterialOptions = (keyword, limit = 20, organizationCode = 'COMMERCIAL') =>
  request(`${BASE_URL}/options`, { params: { keyword, limit, organizationCode } })

export const fetchU9MaterialTemplateMapping = () =>
  request(`${BASE_URL}/template-mapping`)
