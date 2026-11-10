/** OA仍在报价员节点时，已保存的核算结果决定显示“待提交”。 */
export function quoteOaWorkflowLabel(workflow, submission, calculationStatus) {
  if (!workflow) return ''
  if (submission?.status === 'PENDING') return '成本提交中'
  if (submission?.status === 'UNKNOWN') return 'OA 提交结果待确认'
  if (submission?.status === 'SUBMITTED') return '成本审批中'
  if (submission?.status === 'COMPLETED') return '已完成'
  if (['COSTING', 'RECOSTING'].includes(workflow.state)
      && (calculationStatus === '待核算' || submission?.status === 'RETURNED')) return '待核算'
  if (!workflow.syncError && ['COSTING', 'RECOSTING', 'TECHNICAL'].includes(workflow.state)
      && submission?.totalProducts > 0 && submission.readyProducts === submission.totalProducts) {
    return '已核算，待提交 OA'
  }
  return workflow.label
}
