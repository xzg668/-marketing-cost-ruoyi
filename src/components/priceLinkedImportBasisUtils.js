const safeParse = (value) => {
  if (!value || typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch (_) {
    return null
  }
}

export const normalizeImportBasis = (response = {}) => {
  const snapshot =
    response.snapshot || safeParse(response.sourceInputSnapshotJson) || null
  return {
    ...response,
    available: response.importBasisAvailable === true,
    emptyMessage:
      response.message || '历史记录暂无类型 2 导入依据',
    sourceFileName: response.sourceFileName || '-',
    sourceBatchText: [
      response.sourceBatchNo,
      response.sourceUploadBatchId != null
        ? `ID ${response.sourceUploadBatchId}`
        : '',
    ].filter(Boolean).join(' / ') || '-',
    sourceLocation: [
      response.sourceSheetName,
      response.sourceRowNumber != null ? `第 ${response.sourceRowNumber} 行` : '',
      response.sourceFormulaCellRef,
    ].filter(Boolean).join(' / ') || '-',
    sourceFormula: response.sourceFormula || snapshot?.sourceFormula || '-',
    systemFormula: response.systemFormula || '-',
    inputCells: Array.isArray(snapshot?.inputCells)
      ? snapshot.inputCells.map((cell) => ({
          ...cell,
          calculationValue:
            cell?.calculationValue ?? cell?.numericValue ?? null,
          blankDefaultedToZero: cell?.blankDefaultedToZero === true,
        }))
      : [],
    factorBindings: Array.isArray(response.factorBindings)
      ? response.factorBindings
      : [],
    taxBasis: snapshot?.taxBasis || null,
    reconcileBasis: snapshot?.reconcileBasis || null,
  }
}

export const taxExecutionText = (basis = {}) => {
  if (!basis.taxBasis) return '-'
  if (basis.taxBasis.taxAdjustmentRequired) return '最终执行除税'
  if (basis.taxBasis.finalVatDivisorStripped) return '已移除 Excel 末尾重复除税'
  return '不执行除税'
}

export const taxIncludedText = (value) => {
  if (value === 1 || value === true || String(value).toUpperCase() === 'TRUE') {
    return '含税'
  }
  if (value === 0 || value === false || String(value).toUpperCase() === 'FALSE') {
    return '不含税'
  }
  return '-'
}

export const buildImportBasisDifferenceRows = (basis = {}) => {
  const reconcile = basis.reconcileBasis
  if (!reconcile) return []
  return [
    ['含税价', reconcile.taxIncluded],
    ['不含税价', reconcile.taxExcluded],
  ].map(([label, row]) => ({
    priceType: label,
    excelPrice: row?.excelPrice ?? '-',
    systemPrice: row?.systemPrice ?? '-',
    absoluteDifference: row?.absoluteDifference ?? '-',
    tolerance: row?.tolerance ?? reconcile.tolerance ?? '-',
    passed: row?.compared ? row?.passed === true : null,
  }))
}
