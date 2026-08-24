const CHILD_TYPE_ORDER = {
  STANDARD: 0,
  ALTERNATIVE: 1,
}

const WORKFLOW_LABELS = {
  QUOTE_BOM: '报价物料明细',
  PRICE_TYPE: '价格类型识别',
  PRICE_TYPE_CONFIRMATION: '价格类型识别',
  PRICE_PREPARE: '最终价格',
  FINAL_PRICE: '最终价格',
  COST_RUN: '成本核算',
}

export const sortAlternativeCandidates = (candidates) =>
  [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
    const leftOrder = CHILD_TYPE_ORDER[String(left?.childType || '').toUpperCase()] ?? 99
    const rightOrder = CHILD_TYPE_ORDER[String(right?.childType || '').toUpperCase()] ?? 99
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left?.materialCode || '').localeCompare(String(right?.materialCode || ''))
  })

export const isAlternativeCandidateSelected = (candidate, group) =>
  Boolean(candidate?.selected)
  || (
    String(candidate?.materialCode || '').trim() !== ''
    && String(candidate?.materialCode || '').trim()
      === String(group?.selectedMaterialCode || '').trim()
  )

export const alternativeCandidateTags = (candidate, group) => {
  const childType = String(candidate?.childType || '').toUpperCase()
  const tags = []
  if (childType === 'STANDARD') {
    tags.push({ text: '标准', type: 'primary' })
    tags.push({ text: '默认', type: 'info' })
  } else if (childType === 'ALTERNATIVE') {
    tags.push({ text: '替代', type: 'warning' })
  }
  if (isAlternativeCandidateSelected(candidate, group)) {
    tags.push({ text: '本次报价使用', type: 'success' })
  }
  return tags
}

export const canSelectQuoteBomAlternative = (permissions) => {
  const values = Array.isArray(permissions) ? permissions : []
  return values.includes('*:*:*')
    || values.includes('quote:costing:bom:alternative-select')
}

export const alternativeSelectionDisabled = ({
  canSelect = false,
  summary = {},
  group = {},
} = {}) =>
  !canSelect
  || Boolean(summary?.reviewRequired)
  || Boolean(group?.reviewRequired)
  || String(group?.selectionStatus || '').toUpperCase() === 'STALE'

export const alternativeReviewWarning = (summary = {}) => {
  if (!summary?.reviewRequired) return ''
  return 'BOM 版本或来源批次已变化，当前标准/替代选择已失效。请刷新后重新选择，再按当前规则重新生成。'
}

export const alternativeErrorMessage = (error) => {
  const message = String(error?.message || error || '').trim()
  if (message.includes('ALT_SELECTION_CONFLICT')) {
    return '该替代组已被其他操作更新，请刷新后根据最新选择重新操作。'
  }
  if (message.includes('ALT_SOURCE_STALE')) {
    return 'BOM 版本或来源批次已变化，请刷新并重新确认标准/替代选择。'
  }
  return message || '保存标准/替代选择失败'
}

export const formatAlternativeRebuildSummary = (result = {}) => {
  if (result?.idempotent) return '当前方案未变化'
  const workflowLabels = [...new Set(
    (Array.isArray(result?.workflowInvalidated) ? result.workflowInvalidated : [])
      .map((code) => WORKFLOW_LABELS[String(code || '').toUpperCase()] || code)
      .filter(Boolean),
  )]
  const invalidatedText = workflowLabels.length > 0
    ? `，${workflowLabels.join('、')}将在重算后更新`
    : ''
  if (result?.recalculationRequired !== false) {
    return `计价方案已保存，请点击“按当前规则重新生成”后继续核算${invalidatedText}`
  }
  return `计价方案已保存${invalidatedText}`
}
