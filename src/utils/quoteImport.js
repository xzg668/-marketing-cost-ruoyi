export const QUOTE_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024
export const QUOTE_IMPORT_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

const toArray = (value) => (Array.isArray(value) ? value : [])

export function getQuoteImportFile(fileLike) {
  return fileLike?.raw || fileLike || null
}

export function getQuoteImportFileName(fileLike) {
  return getQuoteImportFile(fileLike)?.name || fileLike?.name || ''
}

export function isQuoteImportExcelFile(fileLike) {
  const name = getQuoteImportFileName(fileLike).toLowerCase()
  return QUOTE_IMPORT_ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function validateQuoteImportFile(fileLike) {
  const file = getQuoteImportFile(fileLike)
  if (!file) {
    return { valid: false, message: '请选择报价单 Excel 文件' }
  }
  if (!isQuoteImportExcelFile(file)) {
    return { valid: false, message: '仅支持 .xlsx / .xls 格式' }
  }
  if (Number(file.size || 0) > QUOTE_IMPORT_MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 20MB' }
  }
  return { valid: true, message: '' }
}

export function normalizeQuoteExcelPreview(preview, fallbackFileName = '') {
  const safePreview = preview || {}
  const errors = toArray(safePreview.errors)
  const warnings = toArray(safePreview.warnings)
  const forms = toArray(safePreview.forms)
  const derivedItemCount = forms.reduce((total, form) => total + toArray(form?.items).length, 0)
  const derivedFeeCount = forms.reduce((total, form) => total + toArray(form?.extraFees).length, 0)
  const errorCount = Number(safePreview.errorCount ?? errors.length ?? 0)
  const warningCount = Number(safePreview.warningCount ?? warnings.length ?? 0)
  const valid = safePreview.valid === false ? false : errorCount === 0
  return {
    fileName: safePreview.fileName || fallbackFileName || '',
    formCount: Number(safePreview.formCount || forms.length || 0),
    itemCount: Number(safePreview.itemCount || derivedItemCount || 0),
    feeCount: Number(safePreview.feeCount || derivedFeeCount || 0),
    errorCount,
    warningCount,
    valid,
    statusLabel: valid ? (warningCount > 0 ? '可提交，有提醒' : '校验通过') : '存在错误',
    statusType: valid ? (warningCount > 0 ? 'warning' : 'success') : 'danger',
    forms,
    errors,
    warnings,
  }
}

export function canCommitQuoteExcelPreview(preview) {
  return Boolean(preview) && normalizeQuoteExcelPreview(preview).valid
}

export function normalizeQuoteExcelCommitResponse(response) {
  return toArray(response?.results).map((row, index) => ({
    rowKey: row?.ingestLogId || row?.oaFormId || row?.oaNo || index,
    oaNo: row?.oaNo || '',
    oaFormId: row?.oaFormId ?? '',
    ingestLogId: row?.ingestLogId ?? '',
    ingestStatus: row?.ingestStatus || '',
    classificationStatus: row?.classificationStatus || '',
    itemCount: Number(row?.itemCount || 0),
  }))
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
