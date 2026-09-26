// 完成数量和能否提交以后台整张 OA 单据的结果为准，不使用当前列表页或筛选后的数量。
export function personalPendingProductCount(document, userId) {
  return document.tasks.filter(task => {
    const modules = task.products[0].modules.filter(module => module.required
      && String(module.assigneeUserId ?? task.assigneeUserId) === String(userId))
    return modules.some(module => !['SUBMITTED', 'APPROVED'].includes(module.moduleStatus))
  }).length
}

export function technicalSubmissionMessage(document, userId) {
  const result = document.lastSubmission
  if (!result) return document.canSubmit ? '本人资料已补齐，可以确认提交审批。' : '请先补齐本单中本人负责的全部资料。'
  if (result.status === 'SUCCESS' && personalPendingProductCount(document, userId) > 0) return '部分资料需要修改，请按退回要求调整后重新确认提交。'
  return ({ SUCCESS: '本人资料已提交，等待 OA 审批。', OA_ACCEPTED: 'OA 已受理，正在确认本地提交状态。',
    SENDING: '本次提交正在等待 OA 结果，请勿重复发起。', UNKNOWN: 'OA 结果尚未确认，请核实原流程；资料暂为只读。',
    REJECTED: 'OA 未受理：' + (result.oaResult?.message || '请核实流程状态'),
    NOT_SENT: '本次未发送：' + (result.oaResult?.message || '请检查接口配置') })[result.status] || ''
}

export function submittedDocumentRows(document) {
  return document.tasks.map(task => ({ ...task, taskId: task.id, product: task.products[0],
    assignedModules: [], editableModules: [] }))
}
