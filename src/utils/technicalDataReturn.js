export const pendingReturn = result => ['PREPARED', 'SENDING', 'OA_ACCEPTED', 'UNKNOWN'].includes(result?.status)

export function returnMessage(result) {
  if (!result) return ''
  if (result.status === 'SUCCESS') return '退回成功，原技术员可修改选中的资料。'
  if (result.status === 'UNKNOWN') return 'OA 结果尚未确认，资料仍为只读；请核实原请求，勿重复退回。'
  if (['PREPARED', 'SENDING', 'OA_ACCEPTED'].includes(result.status)) return '退回处理中，请刷新本次结果。'
  const code = result.oaResult?.errorCode
  return `${result.status === 'NOT_SENT' ? '退回未发送' : 'OA 未同意退回'}：${result.oaResult?.message || '请核实接口结果'}${code ? `（${code}）` : ''}`
}

export function buildReturnRequest(rows, requestKey) {
  if (!rows.length || new Set(rows.map(row => row.formId)).size !== 1) throw new Error('请选择同一张 OA 单的产品')
  const selected = rows.filter(row => row.selectedModules?.length)
  if (!selected.length) throw new Error('请选择需要修改的板块')
  const targets = selected.map(row => {
    if (!row.reason?.trim()) throw new Error(`请填写产品 ${row.productNo} 的退回原因`)
    const modules = [...new Set(row.selectedModules)]
    if (modules.some(type => !row.modules.some(module => module.moduleType === type))) throw new Error('退回范围已变化，请重新打开确认框')
    return { taskId: row.taskId, expectedTaskVersion: row.taskVersion, modules, reason: row.reason.trim() }
  })
  return { requestKey, targets }
}
