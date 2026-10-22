export const drawingColumns = [
  ['no', '序号'], ['code', '图号'], ['name', '名称'], ['qty', '数量'], ['mat', '材料'],
  ['grade', '重要性'], ['hsf', '风险'], ['weight', '单重'], ['note', '备注'],
]

export function safeDrawingUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}

export function drawingText(value) {
  if (value == null) return '未提供'
  if (value === '') return '（空）'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

export function drawingTaskLabel(task) {
  if (!task) return '尚未获取图库'
  if (task.taskState === 'RECEIVED') {
    return task.results?.some(result => result.resultId === task.currentResultId && result.eventType === 'MANUAL_CONFIRMATION')
      || task.differenceCount > 0 ? '已确认' : '无差异'
  }
  return { REQUESTING: '核验中', WAIT_REVIEW: '待人工确认', RECEIVED: '明细已接收',
    FAILED: '核验失败', SUPERSEDED: '历史任务' }[task.taskState] || task.taskState
}

// 跳转只在当前任务等待确认时开放；原始差异数不会因人工确认而清零。
export function drawingEditUrl(task) {
  return task?.taskState === 'WAIT_REVIEW' ? safeDrawingUrl(task.editUrl) : ''
}

export function drawingNeedsRefresh(task) {
  return ['REQUESTING', 'WAIT_REVIEW'].includes(task?.taskState)
    || (task?.taskState === 'RECEIVED' && task.consumptionState === 'PENDING')
}

export function drawingDetailGroups(data, drawingNo) {
  return {
    current: drawingNo && data ? data[drawingNo] || null : null,
    additional: Object.entries(data || {}).filter(([key]) => key !== drawingNo),
  }
}

export function drawingDateTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(new Date(value))
  }
  // 后端 LocalDateTime 已按业务时区保存，不能再按浏览器所在时区偏移。
  return typeof value === 'string' ? value.replace('T', ' ').slice(0, 19) : '未提供'
}

export function drawingConsumptionLabel(task, stage) {
  if (task?.taskState !== 'RECEIVED') return ''
  if (task.consumptionState === 'FAILED') return '后续处理失败，可从已存结果继续'
  if (task.consumptionState === 'NOT_READY') return task.errorMessage || '保留历史结果'
  return { E_DRAWING_COMPOSED: 'BOM 已组好', MAPPING_PENDING: '待确认 U9 料号',
    E_DRAWING_PUBLISHED: 'BOM 已就绪' }[stage] || (task.consumptionState === 'COMPLETE' ? '来源已导入，继续检查报价资料' : '等待导入和物料匹配')
}

export function drawingResultLabel(result) {
  return result?.eventType === 'MANUAL_CONFIRMATION' ? '人工已确认' : '首次核验'
}
