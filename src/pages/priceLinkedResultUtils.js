/**
 * T24：PriceLinkedResultPage 的纯函数辅助层 —— 与 Vue 组件解耦。
 *
 * 职责：
 *   1) 解析 /items/{id}/trace 返回的 `traceJson` 字符串为结构化对象
 *   2) 把扁平 trace map 拉平为时间轴 step（normalize / resolve / evaluate / error）
 *   3) 计算系统结果 vs Excel 金标的差异 + 是否超阈值（0.01）
 */

/** T24：差异阈值 —— DoD 要求 > 0.01 红色高亮 */
export const DIFF_THRESHOLD = 0.01

/**
 * 把后端 traceJson 字符串安全 parse；非法 JSON / null → null。
 * 用 try/catch 是因为历史数据里 trace_json 可能为空或损坏。
 */
export const parseTraceJson = (traceJson) => {
  if (traceJson == null || traceJson === '') return null
  if (typeof traceJson !== 'string') return traceJson
  try {
    return JSON.parse(traceJson)
  } catch (_) {
    return null
  }
}

/**
 * 把 trace 对象扁平化为时间轴 steps —— 按业务语义分四段：
 *   - normalize: 原始表达式 + 规范化后表达式
 *   - resolve:   变量赋值列表（vars 键值对）
 *   - evaluate:  最终结果 + 可能的 legacyResult / diff（dual 模式）
 *   - error:     致命错误（如果有）
 */
export const buildTraceTimeline = (trace) => {
  if (!trace || typeof trace !== 'object') return []
  const steps = []

  // normalize
  if (trace.rawExpr || trace.normalizedExpr) {
    steps.push({
      step: 'normalize',
      title: '规范化',
      rawExpr: trace.rawExpr || '',
      normalizedExpr: trace.normalizedExpr || '',
    })
  }

  // resolve
  if (trace.variables && typeof trace.variables === 'object') {
    const entries = Object.entries(trace.variables).map(([code, value]) => ({
      code,
      value,
    }))
    steps.push({
      step: 'resolve',
      title: '变量解析',
      variables: entries,
    })
  }

  // evaluate
  if (
    trace.result !== undefined ||
    trace.legacyResult !== undefined ||
    trace.newResult !== undefined ||
    trace.diff !== undefined
  ) {
    steps.push({
      step: 'evaluate',
      title: '表达式求值',
      result: trace.result ?? trace.newResult ?? null,
      legacyResult: trace.legacyResult ?? null,
      diff: trace.diff ?? null,
      mode: trace.mode || '',
    })
  }

  // error（致命错误放最后，便于 UI 突出显示）
  if (trace.error) {
    steps.push({
      step: 'error',
      title: '错误',
      error: trace.error,
    })
  }

  return steps
}

/**
 * 计算差异 = |system - golden|，并判断是否超阈值。
 * 任一侧缺失 → {diff: null, exceeds: false}
 */
export const diffWithGolden = (system, golden) => {
  if (system == null || system === '' || golden == null || golden === '') {
    return { diff: null, exceeds: false }
  }
  const s = Number(system)
  const g = Number(golden)
  if (!Number.isFinite(s) || !Number.isFinite(g)) {
    return { diff: null, exceeds: false }
  }
  const diff = Math.abs(s - g)
  return { diff, exceeds: diff > DIFF_THRESHOLD }
}

// ============================ T7：导入结果展示辅助 ============================

export const formatImportCount = (value) =>
  value === null || value === undefined || value === '' ? '-' : value

export const pickImportResultValue = (result = {}, ...keys) => {
  for (const key of keys) {
    if (result?.[key] !== undefined && result?.[key] !== null) {
      return result[key]
    }
  }
  return null
}

export const importFactorPriceConflictStrategyText = (value) => {
  if (value === 'KEEP_EXISTING') return '保留已有价格，冲突行跳过'
  if (value === 'OVERWRITE') return '使用本次 Excel 覆盖'
  return value || '-'
}

export const buildImportSummaryItems = (result = {}, context = {}) => {
  const factorPreviewRows = context.factorPreviewRows || []
  const conflictRows = context.conflictRows || []
  const failedRows = context.failedRows || []
  const quoteBaseRecognizedCount =
    context.quoteBaseRecognizedCount ?? pickImportResultValue(result, 'quoteBaseRecognizedCount') ?? 0
  const quoteBaseConflictCount =
    context.quoteBaseConflictCount ?? pickImportResultValue(result, 'quoteBaseConflictCount') ?? 0
  const quoteBaseUnrecognizedCount =
    context.quoteBaseUnrecognizedCount ?? pickImportResultValue(result, 'quoteBaseUnrecognizedCount') ?? 0
  const bindingConflictCount = pickImportResultValue(result, 'conflictBindingCount') ?? 0
  const rawBindingErrorCount = pickImportResultValue(result, 'bindingErrorCount') ?? 0
  const fallbackFailedCount = Math.max(0, rawBindingErrorCount - bindingConflictCount)
  const failedCount = failedRows.length || fallbackFailedCount

  return [
    { key: 'batch', label: '上传批次ID', value: formatImportCount(pickImportResultValue(result, 'batchId', 'factorUploadBatchId')) },
    { key: 'formulaEffectiveDate', label: '公式生效日期', value: formatImportCount(pickImportResultValue(result, 'formulaEffectiveDate')) },
    { key: 'factorPriceConflictStrategy', label: '影响因素价格冲突', value: importFactorPriceConflictStrategyText(pickImportResultValue(result, 'factorPriceConflictStrategy')) },
    { key: 'factor', label: '影响因素识别条数', value: formatImportCount(pickImportResultValue(result, 'factorRecognizedCount', 'factorRowCount', 'validFactorRowCount') ?? factorPreviewRows.length) },
    { key: 'quoteBaseRecognized', label: '公共基价已识别', value: formatImportCount(quoteBaseRecognizedCount), tag: 'success' },
    { key: 'quoteBaseConflict', label: '公共基价冲突', value: formatImportCount(quoteBaseConflictCount), tag: quoteBaseConflictCount ? 'danger' : 'info' },
    { key: 'quoteBaseUnrecognized', label: '公共基价未识别', value: formatImportCount(quoteBaseUnrecognizedCount), tag: 'info' },
    { key: 'created', label: '月度价格新增', value: formatImportCount(pickImportResultValue(result, 'monthlyPriceCreatedCount')) },
    { key: 'unchanged', label: '月度价格不变', value: formatImportCount(pickImportResultValue(result, 'monthlyPriceUnchangedCount')) },
    {
      key: 'monthlyConflict',
      label: '月度价格冲突',
      value: formatImportCount(pickImportResultValue(result, 'monthlyPriceConflictCount', 'monthlyPriceSkippedCount')),
      tag: pickImportResultValue(result, 'monthlyPriceConflictCount', 'monthlyPriceSkippedCount') ? 'danger' : 'info',
    },
    {
      key: 'monthlyOverwrite',
      label: '月度价格覆盖',
      value: formatImportCount(pickImportResultValue(result, 'monthlyPriceOverwriteCount', 'monthlyPriceUpdatedCount')),
      tag: pickImportResultValue(result, 'monthlyPriceOverwriteCount', 'monthlyPriceUpdatedCount') ? 'warning' : 'info',
    },
    { key: 'linked', label: '联动价导入条数', value: formatImportCount(pickImportResultValue(result, 'linkedCount')) },
    { key: 'linkedCreated', label: '联动价新增版本', value: formatImportCount(pickImportResultValue(result, 'linkedVersionCreatedCount', 'linkedCreatedCount')), tag: 'success' },
    {
      key: 'linkedSkipped',
      label: '联动价未变化跳过',
      value: formatImportCount(pickImportResultValue(result, 'linkedUnchangedSkippedCount', 'linkedSkippedCount')),
      tag: 'info',
    },
    {
      key: 'linkedExpired',
      label: '联动价旧版本失效',
      value: formatImportCount(pickImportResultValue(result, 'linkedExpiredCount', 'linkedUpdatedCount')),
      tag: pickImportResultValue(result, 'linkedExpiredCount', 'linkedUpdatedCount') ? 'warning' : 'info',
    },
    { key: 'auto', label: '自动绑定成功', value: formatImportCount(pickImportResultValue(result, 'autoBindingCount')), tag: 'success' },
    {
      key: 'conflict',
      label: '历史关系冲突',
      value: formatImportCount(bindingConflictCount || conflictRows.filter((row) => row.conflictType === 'BINDING_HISTORY').length),
      tag: conflictRows.length ? 'danger' : 'info',
    },
    { key: 'failed', label: '失败条数', value: formatImportCount(failedCount), tag: failedCount ? 'danger' : 'info' },
  ]
}

const isPresentIdentity = (value) =>
  value !== undefined && value !== null && value !== '' && value !== '-'

export const normalizeImportBindingError = (row = {}) => {
  const existingFactorIdentity = row.existingFactorIdentity ?? row.oldFactorIdentityId ?? '-'
  const newFactorIdentity = row.newFactorIdentity ?? row.newFactorIdentityId ?? '-'
  const reason = row.reason || row.message || ''
  const identityConflict =
    isPresentIdentity(existingFactorIdentity) &&
    isPresentIdentity(newFactorIdentity) &&
    String(existingFactorIdentity) !== String(newFactorIdentity)
  const isHistoryConflict = reason.includes('冲突') || identityConflict

  return {
    rowNumber: row.excelRowNumber ?? row.rowNumber ?? '-',
    materialCode: row.materialCode || '-',
    tokenName: row.tokenName || row.token || '-',
    factorName: row.factorName || '-',
    priceText: row.priceText || '-',
    formula: row.formula || row.formulaExpr || '',
    refSheet: row.refSheet || row.sourceRefSheet || '',
    refRow: row.refRow || row.sourceRefRow || '',
    refText: row.refSheet || row.refRow ? `${row.refSheet || '-'}!${row.refRow || '-'}` : '-',
    existingFactorIdentity,
    newFactorIdentity,
    reason,
    message: reason,
    conflictType: isHistoryConflict ? 'BINDING_HISTORY' : 'BINDING_ERROR',
    conflictTypeText: isHistoryConflict ? '历史绑定关系冲突' : '自动绑定失败',
    failureTypeText: '自动绑定失败',
    canOpenBinding: !!row.materialCode,
  }
}

export const buildFactorPriceConflictRows = (factorPreviewRows = []) =>
  factorPreviewRows
    .filter((row) => String(row?.monthlyPriceAction || row?.action || '').toUpperCase().includes('CONFLICT'))
    .map((row) => ({
      rowNumber: row.sourceRowNumber ?? row.rowNumber ?? '-',
      materialCode: '-',
      tokenName: '-',
      factorName: row.factorName || row.shortName || '-',
      priceText: [row.oldPrice != null ? `已有 ${row.oldPrice}` : '', row.newPrice != null ? `当前 ${row.newPrice}` : '']
        .filter(Boolean)
        .join(' / ') || '-',
      formula: '',
      refText: row.sourceSheetName || row.sourceRowNumber
        ? `${row.sourceSheetName || '-'}!${row.sourceRowNumber || '-'}`
        : '-',
      existingFactorIdentity: row.factorIdentityId ?? '-',
      newFactorIdentity: row.factorIdentityId ?? '-',
      reason: '影响因素价格冲突：本月已有价格与本次 Excel 价格不一致，当前策略为保留已有价格，已跳过覆盖',
      message: '影响因素价格冲突：本月已有价格与本次 Excel 价格不一致，当前策略为保留已有价格，已跳过覆盖',
      conflictType: 'FACTOR_PRICE',
      conflictTypeText: '影响因素价格冲突',
      canOpenBinding: false,
    }))

export const normalizeImportErrorRow = (row = {}) => {
  const message = row.message || row.reason || ''
  const isFormulaLifecycle = message.includes('生命周期倒挂') || message.includes('formulaEffectiveDate')
  return {
    rowNumber: row.rowNumber ?? row.excelRowNumber ?? '-',
    materialCode: row.materialCode || '-',
    refText: '-',
    formula: row.formula || '',
    message,
    failureType: isFormulaLifecycle ? 'FORMULA_LIFECYCLE' : 'IMPORT_ERROR',
    failureTypeText: isFormulaLifecycle ? '公式版本生效日期倒挂' : '导入失败',
    canOpenBinding: !!row.materialCode,
  }
}

export const splitImportDetailRows = (result = {}, factorPreviewRows = []) => {
  const bindingErrorRows = Array.isArray(result?.bindingErrors)
    ? result.bindingErrors.map(normalizeImportBindingError)
    : []
  const factorConflictRows = buildFactorPriceConflictRows(factorPreviewRows)
  const bindingConflictRows = bindingErrorRows.filter(
    (row) => row.conflictType === 'BINDING_HISTORY',
  )
  const bindingFailureRows = bindingErrorRows.filter(
    (row) => row.conflictType !== 'BINDING_HISTORY',
  )
  const regularErrors = Array.isArray(result?.errors)
    ? result.errors.map(normalizeImportErrorRow)
    : []

  return {
    bindingErrorRows,
    factorConflictRows,
    conflictRows: [...factorConflictRows, ...bindingConflictRows],
    failedRows: [...bindingFailureRows, ...regularErrors],
  }
}
