const numberOrZero = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const currentPricingMonth = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export const priceLinkedTemplateText = (templateType) => {
  const normalized = String(templateType || '').toUpperCase()
  if (normalized === 'STANDARD') return '标准模板'
  if (normalized === 'TYPE2') return '采购价联动类型 2'
  if (normalized === 'AMBIGUOUS') return '模板结构存在歧义'
  if (normalized === 'UNKNOWN') return '未识别模板'
  return templateType || '-'
}

export const buildType2PreviewSummary = (preview = {}) => [
  {
    key: 'templateType',
    label: '识别模板',
    value: priceLinkedTemplateText(preview.templateType),
  },
  {
    key: 'businessSheetName',
    label: '业务计算 Sheet',
    value: preview.businessSheetName || '-',
  },
  {
    key: 'importDataSheetName',
    label: 'importdata1 Sheet',
    value: preview.importDataSheetName || '-',
  },
  {
    key: 'factorRowCount',
    label: '影响因素',
    value: numberOrZero(preview.factorRowCount),
  },
  {
    key: 'businessRowCount',
    label: '产品行数',
    value: numberOrZero(preview.businessRowCount),
  },
  {
    key: 'matchedRowCount',
    label: '匹配成功',
    value: numberOrZero(preview.matchedRowCount),
    tag: 'success',
  },
  {
    key: 'unmatchedRowCount',
    label: '未匹配',
    value: numberOrZero(preview.unmatchedRowCount),
    tag: numberOrZero(preview.unmatchedRowCount) ? 'danger' : 'info',
  },
  {
    key: 'duplicateRowCount',
    label: '重复',
    value: numberOrZero(preview.duplicateRowCount),
    tag: numberOrZero(preview.duplicateRowCount) ? 'danger' : 'info',
  },
  {
    key: 'formulaMismatchCount',
    label: '公式异常',
    value: numberOrZero(preview.formulaMismatchCount),
    tag: numberOrZero(preview.formulaMismatchCount) ? 'danger' : 'info',
  },
  {
    key: 'canonicalFactorConflictCount',
    label: '价格冲突',
    value: numberOrZero(preview.canonicalFactorConflictCount),
    tag: numberOrZero(preview.canonicalFactorConflictCount) ? 'danger' : 'info',
  },
]

export const normalizeType2PreviewErrors = (errors = []) =>
  (Array.isArray(errors) ? errors : []).map((row, index) => ({
    key: [
      row?.sourceSheetName,
      row?.rowNumber,
      row?.materialCode,
      row?.errorCode,
      index,
    ].join('|'),
    sourceSheetName: row?.sourceSheetName || row?.sheetName || '-',
    rowNumber: row?.rowNumber ?? row?.excelRowNumber ?? '-',
    materialCode: row?.materialCode || '-',
    supplierCode: row?.supplierCode || '-',
    errorStage: row?.errorStage || '-',
    errorCode: row?.errorCode || '-',
    message: row?.message || row?.reason || '预检未通过',
  }))

export const canConfirmLinkedPreview = ({
  file,
  loading,
  error,
  preview,
} = {}) =>
  Boolean(
    file &&
    !loading &&
    !error &&
    preview?.canConfirm === true &&
    preview?.fileSha256,
  )

export const linkedImportResultText = (result = {}) => {
  const status = String(result.importStatus || '').toUpperCase()
  const created =
    result.linkedVersionCreatedCount ?? result.linkedCreatedCount ?? 0
  const skipped =
    result.linkedUnchangedSkippedCount ?? result.linkedSkippedCount ?? 0
  const conflicts =
    result.canonicalFactorConflictCount ??
    result.monthlyPriceConflictCount ??
    0
  const failures = Array.isArray(result.errors)
    ? result.errors.length
    : Number(result.errorCount || 0)
  const prefix = status === 'PARTIAL' ? '部分导入完成' : '导入完成'
  return `${prefix}：新增版本 ${created}，未变化跳过 ${skipped}，冲突 ${conflicts}，失败 ${failures}`
}
