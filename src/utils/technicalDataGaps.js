// 当前提交/退回结论来自资料接口；仅投影展示，不改写历史核算结果。
export function productSupplement(state, itemId, month) {
  return state?.supplements?.find(row => String(row.oaFormItemId) === String(itemId)
    && (!month || row.accountingMonth === month)) || null
}

export function currentSupplementWorkspace(workspace, supplement) {
  if (!supplement) return workspace
  const view = { ...(workspace || {}), supplement }
  if (['QUEUED', 'RUNNING'].includes(view.workspaceStatus)) return view
  if (supplement.pendingModules.length) {
    view.workspaceStatus = 'WAIT_TECH_DATA'
    view.currentStep = 'PRODUCT_DETAIL'
    view.inputChanged = false
    view.gapCount = supplement.pendingModules.length
    view.lastErrorCode = supplement.status === 'RETURNED' ? 'TECHNICAL_PRODUCT_RETURNED' : 'TECHNICAL_SUBMISSION_PENDING'
    view.lastErrorMessage = supplement.status === 'RETURNED'
      ? `本产品已退回，${view.gapCount} 项补录资料待重新提交`
      : `本产品还有 ${view.gapCount} 项补录资料未成功提交`
    return view
  }
  if (view.workspaceStatus === 'WAIT_PRICE' && supplement.remainingPriceGapCount != null) {
    view.gapCount = supplement.remainingPriceGapCount
    view.lastErrorMessage = view.gapCount
      ? `补录资料已提交，仍有 ${view.gapCount} 项价格缺口待处理`
      : '补录资料已提交，可核算本产品'
  }
  if (view.workspaceStatus === 'WAIT_TECH_DATA'
      || view.workspaceStatus === 'WAIT_PRICE' && view.gapCount === 0) {
    view.workspaceStatus = 'READY'
    view.currentStep = 'PRODUCT_DETAIL'
    view.lastErrorCode = null
    view.lastErrorMessage = '补录资料已提交，可核算本产品'
    view.gapCount = 0
  }
  return view
}

export function currentPriceGaps(rows, supplement) {
  const resolved = new Set(supplement?.resolvedPriceGapKeys || [])
  return (rows || []).filter(row => !resolved.has(
    `${row.gapMaterialCode || ''}|${row.gapType || ''}|${row.reasonCode || ''}`))
}

export function currentPriceGapCount(total, rows, supplement) {
  const original = rows || []
  const remaining = currentPriceGaps(original, supplement)
  // 总数可能包含未加载的财务缺口，只扣除本次确实已解决的记录。
  return Math.max(Number(total) || 0, original.length) - (original.length - remaining.length)
}
