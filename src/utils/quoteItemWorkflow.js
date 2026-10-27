import { carriedForwardPriceCount, priceReadyLabel } from './pricePrepareDisplay.js'

const READY_BOM_STATUSES = new Set([
  'SYNCED',
  'REUSED_CURRENT_MONTH',
  'CURRENT_MONTH_QUOTED',
  'U9_BOM_EXISTS',
  'MANUAL_ENTERED',
])

const BOM_STATUS_LABELS = {
  SYNCED: 'BOM已同步',
  REUSED_CURRENT_MONTH: '复用本月BOM',
  CURRENT_MONTH_QUOTED: '本月已报价',
  U9_BOM_EXISTS: 'U9有此BOM',
  MANUAL_ENTERED: 'BOM已补录',
  NO_BOM: '无BOM',
  ENTRY_PENDING: '待补BOM',
  ENTRY_IN_PROGRESS: 'BOM补录中',
  SYNCING: 'BOM同步中',
  EXPIRED: 'BOM已过期',
  CHECK_FAILED: 'BOM检查失败',
  NOT_CHECKED: 'BOM待检查',
}

export function withQuoteItemWorkflow(detail, drawingStates = {}) {
  return {
    ...(detail || {}),
    items: (detail?.items || []).map((item) => ({
      ...item,
      workflow: quoteItemWorkflow(item, drawingStates[item.id]),
    })),
  }
}

// 历史成本待重算只影响核算动作；当前工作区的缺口仍应能独立查看。
export function hasQuoteItemCostingGap(item) {
  const workspace = item?.costingWorkspace
  return ['WAIT_BOM', 'WAIT_TECH_DATA', 'WAIT_PRICE_TYPE', 'WAIT_PRICE', 'SYSTEM_FAILED']
    .includes(String(workspace?.workspaceStatus || '').toUpperCase())
    || item?.workflow?.nextAction === 'VIEW_COSTING_GAP'
}

export function quoteItemWorkflow(item, drawingWorkspace) {
  const workspace = item?.costingWorkspace || null
  const workspaceStatus = String(workspace?.workspaceStatus || '').toUpperCase()
  const bomStatus = String(item?.bomStatus?.bomStatus || 'NOT_CHECKED').toUpperCase()
  const bomReady = READY_BOM_STATUSES.has(bomStatus)
  const calculated = item?.calcStatus === '已核算' || Boolean(item?.confirmedCostVersionId)
  const historyPriceCount = carriedForwardPriceCount(workspace?.carriedForwardPriceCount)
  const drawing = drawingBomProgress(item, drawingWorkspace)
  const base = {
    bomStatus: drawing?.bomStatus || (bomReady ? 'AVAILABLE' : bomStatus),
    bomStatusLabel: drawing?.bomStatusLabel || BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
    assigneeName: item?.technicianName || '',
  }

  if (workspace?.inputChanged || workspaceStatus === 'STALE') {
    return state(base, 'STALE', '核算输入已变化', 'STALE', '待重新核算',
      'RESTART_COSTING', '重新核算',
      '规则、替代料、包装或价格来源已变化；重新核算后才会替换当前结果。')
  }
  if (['QUEUED', 'RUNNING'].includes(workspaceStatus)
      || (!workspaceStatus && item?.calcStatus === '试算中')) {
    return state(base, 'PENDING', '在核算工作台确认', 'COSTING', '核算中',
      'VIEW_COSTING_PROGRESS', '查看进度', '核算任务正在处理')
  }
  if (drawing?.pending) {
    return state(base, 'PENDING', '待检查', drawing.currentStatus, drawing.currentStatusLabel,
      drawing.nextAction, drawing.nextActionLabel, drawing.message)
  }
  if (workspaceStatus === 'BOM_READY') {
    return state(base, 'PENDING', '在核算工作台处理', 'READY_FOR_COSTING', '可核算',
      'START_COSTING', '核算本产品', '当前月报价物料已生成，可继续价格检查与核算')
  }
  if (workspaceStatus === 'WAIT_BOM') {
    if (drawing) {
      const gapMessage = unresolvedBomGapMessage(workspace)
      if (drawing.ready && !gapMessage) return readyDrawingWorkflow(base)
      return state(base, 'PENDING', '待检查', 'BOM_IN_PROGRESS', '待完善BOM资料',
        'VIEW_COSTING_GAP', '查看缺口', gapMessage || drawing.message)
    }
    return state(
      base,
      'PENDING_BOM',
      '待BOM补齐后检查',
      'MISSING_BOM',
      '待补BOM',
      'VIEW_COSTING_GAP',
      '查看缺口',
      workspace?.lastErrorMessage || '当前产品缺少可用于核算的BOM',
    )
  }
  if (workspaceStatus === 'WAIT_TECH_DATA') {
    return state(base, 'PENDING', '待技术资料生效', 'MISSING_TECH_DATA', '待技术资料',
      'VIEW_COSTING_GAP', '查看缺口', workspace?.lastErrorMessage || '当前月份缺少已审核生效的技术资料', '产品技术')
  }
  if (workspaceStatus === 'WAIT_PRICE_TYPE') {
    // Existing workspaces retain this historical status until their next preparation.
    return state(base, 'PENDING', '待重新检查价格', 'MISSING_PRICE', '待重新检查价格',
      'VIEW_COSTING_GAP', '查看缺口', '请重新发起核算，按当前取价顺序检查价格', '财务报价')
  }
  if (workspaceStatus === 'WAIT_PRICE') {
    const assignee = String(workspace?.lastErrorCode || '').toUpperCase() === 'FINANCE_BASE_PRICE_MISSING'
      ? '财务报价'
      : '财务报价/产品技术'
    return state(base, 'MISSING', '缺价格', 'MISSING_PRICE', '缺价格',
      'VIEW_COSTING_GAP', '查看缺口', workspace?.lastErrorMessage || '价格存在缺口', assignee)
  }
  if (workspaceStatus === 'SYSTEM_FAILED') {
    return state(base, 'ERROR', '系统处理失败', 'SYSTEM_FAILED', '系统处理失败',
      'RETRY_COSTING', '重试本产品', workspace?.lastErrorMessage || '系统处理失败，可重试')
  }
  if (workspaceStatus === 'READY') {
    return state(base, 'READY', priceReadyLabel(historyPriceCount), 'READY_FOR_COSTING', '可核算',
      'START_COSTING', '核算本产品', '当前资料已准备，可核算本产品')
  }
  if (calculated) {
    return state(base, 'READY', priceReadyLabel(historyPriceCount), 'COMPLETED', '核算完成',
      'VIEW_COSTING_RESULT', '查看结果', historyPriceCount > 0
        ? `${historyPriceCount}项沿用最近一次已审批价格`
        : '当前成功结果可直接查看')
  }
  if (drawing) {
    if (!drawing.ready) {
      return state(base, 'PENDING', '待检查', drawing.currentStatus, drawing.currentStatusLabel,
        drawing.nextAction, drawing.nextActionLabel, drawing.message)
    }
    return readyDrawingWorkflow(base)
  }

  const missingBom = ['NO_BOM', 'ENTRY_PENDING', 'EXPIRED'].includes(bomStatus)
  const bomInProgress = ['ENTRY_IN_PROGRESS', 'SYNCING'].includes(bomStatus)
  return state(
    base,
    missingBom ? 'PENDING_BOM' : 'PENDING',
    missingBom ? '待BOM补齐后检查' : '尚未核算',
    bomInProgress ? 'BOM_IN_PROGRESS' : missingBom ? 'MISSING_BOM' : 'NOT_STARTED',
    bomInProgress ? 'BOM处理中' : missingBom ? '待补BOM' : '未开始',
    missingBom || bomInProgress ? 'VIEW_COSTING_GAP' : 'START_COSTING',
    missingBom || bomInProgress ? '查看缺口' : '核算本产品',
    item?.bomStatus?.errorMessage || '显示报价与核算工作区已保存的状态',
  )
}

/** 图库进度只修正展示，不把“已接收明细”等同于“BOM或价格已就绪”。 */
function drawingBomProgress(item, workspace) {
  const sameItem = workspace && String(workspace.itemId) === String(item?.id)
    && (!item?.electronicDrawingAccountingMonth || workspace.accountingMonth === item.electronicDrawingAccountingMonth)
  const current = sameItem ? workspace.current : null
  if (item?.bomStatus?.bomStatus === 'U9_BOM_EXISTS'
      || (current?.taskState === 'RECEIVED' && current.consumptionState === 'NOT_READY')) return null
  const stage = String(sameItem ? workspace.workflowStage || '' : item?.electronicDrawingStage || '').toUpperCase()
  const progress = (bomStatus, bomStatusLabel, currentStatus, currentStatusLabel, message, nextAction = null, nextActionLabel = '') =>
    ({ bomStatus, bomStatusLabel, currentStatus, currentStatusLabel, message, nextAction, nextActionLabel, pending: true })
  if (current?.taskState === 'WAIT_REVIEW' || (!current && stage === 'E_DRAWING_WAIT_REVIEW')) {
    return progress('E_DRAWING_WAIT_REVIEW', '待图纸确认', 'E_DRAWING_WAIT_REVIEW', '待图纸确认',
      '电子图库明细有差异，请在电子图库栏点击“去修正”，确认结果接收后继续处理。')
  }
  if (current?.taskState === 'REQUESTING' || (!current && stage === 'QUERYING_E_DRAWING')) {
    return progress('BOM_IN_PROGRESS', '图库获取中', 'BOM_IN_PROGRESS', '图库获取中', '正在获取电子图库明细。')
  }
  if (current?.taskState === 'FAILED') {
    return progress('E_DRAWING_FAILED', '图库获取失败', 'E_DRAWING_FAILED', '图库获取失败',
      current.errorMessage || '电子图库获取失败，请在电子图库栏重新获取。')
  }
  if (current?.taskState === 'SUPERSEDED') return null
  if (current?.taskState === 'RECEIVED' && current.consumptionState === 'FAILED') {
    return progress('E_DRAWING_RECEIVED', '已有图库明细', 'E_DRAWING_FAILED', '图库处理失败',
      current.errorMessage || '图库明细已保存，后续处理失败，请查看原因。', 'VIEW_COSTING_GAP', '查看原因')
  }
  if (current?.taskState === 'RECEIVED' && current.consumptionState === 'PENDING') {
    return progress('E_DRAWING_RECEIVED', '图库明细已接收', 'BOM_IN_PROGRESS', '图库处理中',
      '已接收电子图库明细，正在匹配料号和准备BOM。')
  }
  if (stage === 'MAPPING_PENDING') {
    const canResolve = Boolean(item?.electronicDrawingWorkflowId)
    return progress('E_DRAWING_RECEIVED', '已有图库明细', 'MAPPING_PENDING', '待匹配料号',
      '电子图库明细已取得，请确认对应的U9料号。',
      canResolve ? 'RESOLVE_ELECTRONIC_DRAWING_MATERIAL' : 'VIEW_COSTING_GAP', canResolve ? '选择U9料号' : '查看缺口')
  }
  if (['E_DRAWING_COMPOSED', 'E_DRAWING_PUBLISHED'].includes(stage)) {
    return { bomStatus: 'AVAILABLE', bomStatusLabel: '电子图库BOM已就绪', ready: true, pending: false }
  }
  if (current?.taskState === 'RECEIVED' || ['E_DRAWING_RECEIVED', 'PARSING', 'MATCHING', 'MATERIALS_MATCHED', 'COMPOSING', 'VALIDATION_FAILED'].includes(stage)) {
    return { ...progress('E_DRAWING_RECEIVED', '已有图库明细', 'BOM_IN_PROGRESS', '待完善图库资料',
      '电子图库明细已取得，请继续检查料号及BOM资料。', 'VIEW_COSTING_GAP', '查看缺口'), pending: false }
  }
  return null
}

function unresolvedBomGapMessage(workspace) {
  const message = workspace?.lastErrorMessage || ''
  // 仅替换已被图库接替的U9根BOM缺失提示；真实子BOM或其他缺口原样保留。
  if (message && !/^未在 lp_bom_raw_hierarchy 找到正式 BOM/.test(message)) return message
  return null
}

function readyDrawingWorkflow(base) {
  return state(base, 'PENDING', '待检查', 'READY_FOR_COSTING', '可继续核算',
    'START_COSTING', '核算本产品', '电子图库BOM已就绪，可继续后续资料检查与核算')
}

function state(
  base,
  priceStatus,
  priceStatusLabel,
  currentStatus,
  currentStatusLabel,
  nextAction,
  nextActionLabel,
  message,
  assigneeName,
) {
  return {
    ...base,
    ...(assigneeName ? { assigneeName } : {}),
    priceStatus,
    priceStatusLabel,
    currentStatus,
    currentStatusLabel,
    nextAction,
    nextActionLabel,
    actionEnabled: Boolean(nextAction),
    message,
  }
}
