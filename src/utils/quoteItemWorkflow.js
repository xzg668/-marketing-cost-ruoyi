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

export function withQuoteItemWorkflow(detail) {
  return {
    ...(detail || {}),
    items: (detail?.items || []).map((item) => ({
      ...item,
      workflow: quoteItemWorkflow(item),
    })),
  }
}

export function quoteItemWorkflow(item) {
  const workspace = item?.costingWorkspace || null
  const workspaceStatus = String(workspace?.workspaceStatus || '').toUpperCase()
  const bomStatus = String(item?.bomStatus?.bomStatus || 'NOT_CHECKED').toUpperCase()
  const bomReady = READY_BOM_STATUSES.has(bomStatus)
  const calculated = item?.calcStatus === '已核算' || Boolean(item?.confirmedCostVersionId)
  const historyPriceCount = carriedForwardPriceCount(workspace?.carriedForwardPriceCount)
  const base = {
    bomStatus: bomReady ? 'AVAILABLE' : bomStatus,
    bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
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
  if (workspaceStatus === 'BOM_READY') {
    return state(base, 'PENDING', '在核算工作台处理', 'READY_FOR_COSTING', '可核算',
      'START_COSTING', '核算本产品', '当前月报价物料已生成，可继续价格检查与核算')
  }
  if (workspaceStatus === 'WAIT_BOM') {
    const mappingPending = String(item?.electronicDrawingStage || '').toUpperCase() === 'MAPPING_PENDING'
      && item?.electronicDrawingWorkflowId
    return state(
      base,
      'PENDING_BOM',
      mappingPending ? '电子图库物料待匹配' : '待BOM补齐后检查',
      'MISSING_BOM',
      mappingPending ? '待匹配电子图库料号' : '待补BOM',
      mappingPending ? 'RESOLVE_ELECTRONIC_DRAWING_MATERIAL' : 'VIEW_COSTING_GAP',
      mappingPending ? '选择U9料号' : '查看缺口',
      workspace?.lastErrorMessage || '当前产品缺少可用于核算的BOM',
    )
  }
  if (workspaceStatus === 'WAIT_TECH_DATA') {
    return state(base, 'PENDING', '待技术资料生效', 'MISSING_TECH_DATA', '待技术资料',
      'VIEW_COSTING_GAP', '查看缺口', workspace?.lastErrorMessage || '当前月份缺少已审核生效的技术资料', '产品技术')
  }
  if (workspaceStatus === 'WAIT_PRICE_TYPE') {
    return state(base, 'MISSING', '缺价格类型', 'MISSING_PRICE', '缺价格类型',
      'VIEW_COSTING_GAP', '查看缺口', workspace?.lastErrorMessage || '价格类型存在缺口', '财务报价')
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
