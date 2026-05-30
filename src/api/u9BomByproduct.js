import { request } from './http.js'

const BASE_URL = '/api/v1/base/u9/bom-byproduct'

export const U9_BOM_BYPRODUCT_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']
export const U9_BOM_BYPRODUCT_MAX_FILE_SIZE = 30 * 1024 * 1024
export const U9_BOM_BYPRODUCT_IMPORT_TIMEOUT = 5 * 60 * 1000

export function getU9BomByproductUploadFile(uploadFile) {
  return uploadFile?.raw || uploadFile || null
}

export function getU9BomByproductUploadFileName(file) {
  return file?.name || ''
}

export function validateU9BomByproductFile(file) {
  if (!file) {
    return { valid: false, message: '请选择 U9 BOM副产品 Excel' }
  }
  const lowerName = getU9BomByproductUploadFileName(file).toLowerCase()
  const validExt = U9_BOM_BYPRODUCT_ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  if (!validExt) {
    return { valid: false, message: '仅支持 .xlsx / .xls 文件' }
  }
  if (file.size && file.size > U9_BOM_BYPRODUCT_MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 30MB' }
  }
  return { valid: true, message: '' }
}

export function normalizeU9BomByproductPage(response) {
  const page = response || {}
  return {
    total: Number(page.total || 0),
    list: Array.isArray(page.records) ? page.records : (Array.isArray(page.list) ? page.list : []),
  }
}

export function normalizeU9BomByproductImportResult(response) {
  const result = response || {}
  return {
    datasetCode: result.datasetCode || '',
    sourceType: result.sourceType || '',
    totalCount: Number(result.totalCount || 0),
    successCount: Number(result.successCount || 0),
    failCount: Number(result.failCount || 0),
    status: result.status || '',
    message: result.message || '',
    errors: Array.isArray(result.errors) ? result.errors : [],
  }
}

export function toU9BomByproductImportFormData({ file }) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export const importU9BomByproductExcel = (payload) =>
  request(`${BASE_URL}/import`, {
    method: 'POST',
    body: toU9BomByproductImportFormData(payload),
    timeout: U9_BOM_BYPRODUCT_IMPORT_TIMEOUT,
  })

export const fetchU9BomByproductRows = (params) =>
  request(`${BASE_URL}/rows`, { params })

export const fetchU9BomByproductTemplateMapping = () =>
  request(`${BASE_URL}/template-mapping`)
