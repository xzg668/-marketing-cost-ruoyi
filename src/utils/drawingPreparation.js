import { drawingDetailGroups } from './drawingVerification.js'

// 接收证据、当前资料缺项和上次处理结果分别投影；不改变核算工作区或BOM就绪条件。
export function drawingReceipt(workspace, detail) {
  const task = workspace?.current
  if (task?.taskState !== 'RECEIVED' || !task.currentResultId
      || String(task.localTaskId) !== String(detail?.localTaskId)
      || String(task.currentResultId) !== String(detail?.resultId)
      || detail?.productDrawingNo !== task.drawingNo
      || !['DIRECT_ACCEPTED', 'MANUAL_CONFIRMED'].includes(detail?.adoption)) return null
  const group = drawingDetailGroups(detail.data, task.drawingNo, detail.productGroupKey).current
  if (!Array.isArray(group?.params?.items) || !group.params.items.length) return null
  return { receivedDetailCount: group.params.items.length, productGroupResolved: true,
    rows: group.params.items, drawingNo: task.drawingNo, receivedAt: detail.receivedAt }
}

export function resolvedDrawingMismatch(task) {
  return task?.taskState === 'RECEIVED' && task.consumptionState === 'FAILED'
    && task.productGroupResolved === true && Number.isInteger(task.receivedDetailCount)
    && task.receivedDetailCount > 0
    && /^已接收明细中没有本产品图号的有效行：/.test(task.errorMessage || '')
}

export function drawingIssueKind(code = '', message = '') {
  if (/LOAD_FAILED|QUERY_FAILED|READ_FAILED|SYSTEM_FAILED/.test(code)
      || /查询.*(?:失败|超时|异常|未取得明确结论)|读取.*(?:失败|超时)|连接.*(?:失败|超时)|返回空结果|续接失败，请按结果编号排查|系统未能从已有原始BOM生成本次计价BOM/.test(message)) return 'SYSTEM'
  if (code === 'WAIT_FINANCE') return 'MATERIAL_MATCH'
  if (/物料形态.*(?:未|待)|(?:未|待|先).*(?:确认|确定|选择).*形态|形态未确定/.test(message)) return 'MATERIAL_SHAPE'
  if (/MISSING_RAW|MANUFACTURING|MANUFACTURE_DETAIL/.test(code)
      || /制造件.*(?:原材料|毛重|净长|工艺|明细)|缺.*(?:毛重|净长)/.test(message)) return 'MANUFACTURING'
  if (/CHILD|PARENT|RELATION|STRUCTURE/.test(code)
      || /子件关系|下级.*(?:缺|未)|缺少.*(?:下级|子件|子BOM)|缺.*子BOM|缺少父项/.test(message)) return 'CHILD_RELATION'
  if (/MAPPING|UNMATCHED|AMBIGUOUS/.test(code) || /(?:匹配|选择|确认).*料号/.test(message)) return 'MATERIAL_MATCH'
  if (/数量|层级序号|图号分组|图号归属/.test(message)) return 'DRAWING_DETAIL'
  return 'BOM_DATA'
}

export function hasCurrentDrawingSource(drawing) {
  const task = drawing?.current
  return Boolean(drawing?.sourceVersionId && task?.taskState === 'RECEIVED' && task.currentResultId
    && String(task.currentResultId) === String(task.consumedResultId))
}

const titles = {
  SYSTEM: '资料读取或处理异常', MANUFACTURING: '待补图库制造件明细', CHILD_RELATION: '待补子件关系',
  MATERIAL_MATCH: '待确认物料料号', DRAWING_DETAIL: '图纸明细待修正', BOM_DATA: '待完善BOM资料',
  MATERIAL_SHAPE: '待确认物料形态',
}

export function drawingPreparationIssues({ drawing, effectiveBom = {}, resolution, supplement,
  readError = '', historyView = false } = {}) {
  if (historyView) return []
  const result = [], seen = new Set()
  function add(issue) {
    if (!issue.message) return
    const kind = issue.kind || drawingIssueKind(issue.code, issue.message)
    const key = JSON.stringify([kind, issue.materialCode || '', issue.sourcePath || '', issue.message])
    if (seen.has(key)) return
    seen.add(key)
    result.push({ ...issue, kind, title: titles[kind], type: kind === 'SYSTEM' ? 'error' : 'warning',
      action: kind === 'MATERIAL_MATCH' || kind === 'DRAWING_DETAIL' ? 'RESOLVE' : kind === 'SYSTEM' ? 'RETRY'
        : kind === 'MATERIAL_SHAPE' ? 'SHAPE' : 'TECHNICAL' })
  }
  if (readError) add({ code: 'READ_FAILED', message: readError, kind: 'SYSTEM' })
  const currentDetailedGaps = hasCurrentDrawingSource(drawing)
    && String(resolution?.sourceVersionId) === String(drawing.sourceVersionId)
    && String(resolution?.productTaskId) === String(drawing.itemId)
    && resolution?.accountingMonth === drawing.accountingMonth
    && resolution?.items?.some(row => row.requiresAction || ['MISSING_RAW', 'ERROR', 'WAIT_FINANCE'].includes(row.processingState))
  for (const issue of effectiveBom.blockIssues || []) {
    if (!readError && resolvedDrawingMismatch(drawing?.current)
        && issue.message === drawing.current.errorMessage) continue
    // 本次待消费或同版明细已给出具体缺项时，通用“未生成”不再充当异常原因。
    if (!readError && (currentDetailedGaps || resolvedDrawingMismatch(drawing?.current) && !hasCurrentDrawingSource(drawing))
        && effectiveBom.state === 'BLOCKED' && !effectiveBom.nodes?.length
        && issue.issueCode === 'MONTHLY_BOM_NOT_READY'
        && issue.message === '系统未能从已有原始BOM生成本次计价BOM，请联系管理员检查数据') continue
    add({ ...issue, code: issue.issueCode || '', kind: effectiveBom.state === 'ERROR' ? 'SYSTEM' : undefined })
  }
  const rows = resolution?.items || []
  const bySequence = new Map(rows.map(row => [row.sourceSequence, row]))
  function sourcePath(row) {
    const path = [], visited = new Set()
    for (let current = row; current && !visited.has(current.sourceSequence); current = bySequence.get(current.parentSourceSequence)) {
      visited.add(current.sourceSequence)
      path.unshift(current.resolvedMaterialCode || current.drawingCode || current.sourceName)
    }
    return path.filter(Boolean).join(' → ')
  }
  for (const row of rows) {
    if (row.processingState === 'EXCLUDED') continue
    if (row.requiresAction) add({ code: 'MAPPING_PENDING', kind: 'MATERIAL_MATCH',
      message: row.processingMessage || '未唯一匹配到料品档案，请确认对应料号',
      materialCode: row.resolvedMaterialCode || row.drawingCode, materialName: row.sourceName, sourcePath: sourcePath(row) })
    else if (['MISSING_RAW', 'ERROR', 'WAIT_FINANCE'].includes(row.processingState)) add({
      code: row.processingState, message: row.processingMessage || '此节点资料尚未完善',
      materialCode: row.resolvedMaterialCode || row.drawingCode, materialName: row.sourceName, sourcePath: sourcePath(row) })
  }
  for (const module of supplement?.pendingModules || []) {
    const code = typeof module === 'string' ? module : module.moduleType
    if (code === 'MANUFACTURING' && !result.some(issue => issue.kind === 'MANUFACTURING'))
      add({ code, message: '本产品制造件原材料、毛重、净长等明细尚未完成提交或生效，请核对技术补录资料。' })
    if (code === 'DRAWING_BOM' && !result.some(issue => issue.kind === 'DRAWING_DETAIL'))
      add({ code, kind: 'DRAWING_DETAIL', message: '电子图库明细的确认或补录尚未完成，请核对图纸明细资料。' })
  }
  return result
}

export function drawingPreparationView({ drawing, effectiveBom = {}, resolution, supplement,
  readError = '', historyView = false } = {}) {
  const task = drawing?.current
  const received = !historyView && task?.taskState === 'RECEIVED'
    && task.productGroupResolved === true && task.receivedDetailCount > 0
  const issues = drawingPreparationIssues({ drawing, effectiveBom, resolution, supplement, readError, historyView })
  const pendingImport = received && !hasCurrentDrawingSource(drawing) && !effectiveBom.nodes?.length
  const bomReady = effectiveBom.state === 'DRAFT' && effectiveBom.nodes?.length > 0 && !effectiveBom.blockIssues?.length
  return { received, pendingImport, issues,
    applies: !historyView && !bomReady && (received || hasCurrentDrawingSource(drawing)),
    type: issues.some(issue => issue.type === 'error') ? 'error' : 'warning',
    title: issues.some(issue => issue.type === 'error') ? '资料读取或处理异常'
      : issues.length ? `BOM资料待处理（${issues.length}项）` : pendingImport ? '图库明细已接收，待继续准备BOM' : 'BOM资料待检查',
    message: issues.length ? '请按下列具体缺项处理，已有明细和结构已保留；资料齐全后才能核算成本。'
      : pendingImport ? '尚未完成本次BOM资料检查，请点击电子图库栏的“继续处理”，检查料号、子件关系及制造件明细。'
      : '已有图库明细已保留，请继续核对BOM资料。',
  }
}
