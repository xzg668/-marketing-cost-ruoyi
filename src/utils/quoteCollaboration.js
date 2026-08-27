import { carriedForwardPriceCount, priceReadyLabel } from './pricePrepareDisplay.js'

export const STARTABLE_COLLABORATION_ACTIONS = new Set([
  'START_BOM_SUPPLEMENT',
  'START_PACKAGE_SUPPLEMENT',
  'START_PRICE_SUPPLEMENT',
  'LINK_EXISTING_TASK',
  'APPLY_APPROVED_RESULT',
])

export const ASSIGN_TECHNICIAN_ACTION = 'ASSIGN_TECHNICIAN'

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

export function mergeCollaborationSummary(detail, summary) {
  return mergeCollaborationItems(detail, summary?.items, summary?.summaryVersion || '')
}

export function mergeCollaborationItems(detail, projectionItems, summaryVersion) {
  const projections = new Map(
    (projectionItems || [])
      .filter((item) => item?.itemId != null)
      .map((item) => [String(item.itemId), item]),
  )
  return {
    ...(detail || {}),
    ...(summaryVersion === undefined ? {} : { collaborationSummaryVersion: summaryVersion }),
    items: (detail?.items || []).map((item) => {
      const projection = projections.get(String(item.id))
      return projection ? { ...item, collaboration: projection } : item
    }),
  }
}

/**
 * 先用详情接口已经返回的持久化状态形成首屏投影。
 * 这里不访问 U9、不展开 BOM、不逐料检查价格；任务执行时会更新这份持久化投影。
 */
export function buildStoredCollaborationSummary(detail) {
  return {
    summaryVersion: 'STORED',
    items: (detail?.items || []).map(storedProjection),
  }
}

function storedProjection(item) {
  const itemId = item?.id
  const workspace = item?.costingWorkspace || null
  const workspaceStatus = String(workspace?.workspaceStatus || '')
  const bomStatus = String(item?.bomStatus?.bomStatus || 'NOT_CHECKED')
  const bomReady = READY_BOM_STATUSES.has(bomStatus)
  const calculated = item?.calcStatus === '已核算' || Boolean(item?.confirmedCostVersionId)
  const historyPriceCount = carriedForwardPriceCount(workspace?.carriedForwardPriceCount)
  if (workspace?.inputChanged || workspaceStatus === 'STALE') {
    return {
      itemId,
      bomStatus: bomReady ? 'AVAILABLE' : bomStatus,
      bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
      priceStatus: 'STALE',
      priceStatusLabel: '核算输入已变化',
      currentStatus: 'STALE',
      currentStatusLabel: '待重新核算',
      nextAction: 'RESTART_COSTING',
      nextActionLabel: '重新核算',
      actionEnabled: true,
      batchSelectable: false,
      message: '规则、替代料、包装或价格来源已变化；原核算结果仍可查看，重新核算后才会替换当前结果。',
    }
  }
  // 工作区是当前月产品核算的权威状态。旧 oa_form_item.calc_status 可能仍为“试算中”，
  // 不能覆盖已经写回的缺口或失败终态；只有尚无工作区时才兼容旧字段。
  const costingActive = ['QUEUED', 'RUNNING'].includes(workspaceStatus)
    || (!workspaceStatus && item?.calcStatus === '试算中')
  if (costingActive) {
    return {
      itemId,
      bomStatus: bomReady ? 'AVAILABLE' : bomStatus,
      bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
      priceStatus: 'PENDING',
      priceStatusLabel: '在核算工作台确认',
      currentStatus: 'COSTING',
      currentStatusLabel: '核算中',
      nextAction: 'VIEW_COSTING_PROGRESS',
      nextActionLabel: '查看进度',
      actionEnabled: true,
      batchSelectable: false,
      message: '核算任务正在处理，完成后会写回当前状态',
    }
  }
  if (workspaceStatus === 'BOM_READY') {
    return {
      itemId,
      bomStatus: 'AVAILABLE',
      bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || '报价物料已生成',
      priceStatus: 'PENDING',
      priceStatusLabel: '在核算工作台处理',
      currentStatus: 'READY_FOR_COSTING',
      currentStatusLabel: '可核算',
      nextAction: 'START_COSTING',
      nextActionLabel: '核算本产品',
      actionEnabled: true,
      batchSelectable: false,
      message: '当前月报价物料已生成，可继续处理价格类型、价格和成本',
    }
  }
  const workspaceGap = {
    WAIT_BOM: ['MISSING_BOM', '待补BOM', 'VIEW_COSTING_GAP', '查看缺口'],
    WAIT_PRICE_TYPE: ['MISSING_PRICE', '缺价格类型', 'VIEW_COSTING_GAP', '查看缺口'],
    WAIT_PRICE: ['MISSING_PRICE', '缺价格', 'VIEW_COSTING_GAP', '查看缺口'],
    SYSTEM_FAILED: ['SYSTEM_FAILED', '系统处理失败', 'RETRY_COSTING', '重试本产品'],
    READY: ['READY_FOR_COSTING', '可核算', 'START_COSTING', '核算本产品'],
  }[workspaceStatus]
  if (workspaceGap) {
    const technicalGap = requiresTechnicalCollaboration(workspaceStatus, workspace)
    const assigneeName = workspaceGapAssignee(workspaceStatus, workspace, item)
    return {
      itemId,
      bomStatus: bomReady ? 'AVAILABLE' : bomStatus,
      bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
      priceStatus: workspaceStatus === 'READY' ? 'READY' : 'MISSING',
      priceStatusLabel: workspaceStatus === 'READY' ? priceReadyLabel(historyPriceCount) : workspaceGap[1],
      currentStatus: workspaceGap[0],
      currentStatusLabel: workspaceGap[1],
      assigneeName,
      nextAction: technicalGap ? ASSIGN_TECHNICIAN_ACTION : workspaceGap[2],
      nextActionLabel: technicalGap ? '指定技术负责人' : workspaceGap[3],
      actionEnabled: true,
      batchSelectable: technicalGap,
      message: workspace?.lastErrorMessage
        || (workspace?.gapCount ? `当前有 ${workspace.gapCount} 个待处理缺口` : workspaceGap[1]),
    }
  }
  if (calculated) {
    return {
      itemId,
      bomStatus: bomReady ? 'AVAILABLE' : bomStatus,
      bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM状态已保存',
      priceStatus: 'READY',
      priceStatusLabel: priceReadyLabel(historyPriceCount),
      currentStatus: 'COMPLETED',
      currentStatusLabel: '核算完成',
      nextAction: 'VIEW_COSTING_RESULT',
      nextActionLabel: '查看结果',
      actionEnabled: true,
      batchSelectable: false,
      message: historyPriceCount > 0
        ? `当前成功结果可直接查看；${historyPriceCount}项沿用最近一次已审批价格，不阻断报价，请财务后续更新审批。`
        : '当前成功结果可直接查看；只有输入变化后才需要重新核算。',
    }
  }
  const missingBom = ['NO_BOM', 'ENTRY_PENDING', 'EXPIRED'].includes(bomStatus)
  const bomInProgress = ['ENTRY_IN_PROGRESS', 'SYNCING'].includes(bomStatus)
  return {
    itemId,
    bomStatus: bomReady ? 'AVAILABLE' : missingBom ? 'NO_BOM' : bomStatus,
    bomStatusLabel: BOM_STATUS_LABELS[bomStatus] || 'BOM待检查',
    priceStatus: missingBom ? 'PENDING_BOM' : 'PENDING',
    priceStatusLabel: missingBom ? '待BOM补齐后检查' : '尚未核算',
    currentStatus: bomInProgress ? 'BOM_IN_PROGRESS' : missingBom ? 'MISSING_BOM' : 'NOT_STARTED',
    currentStatusLabel: bomInProgress ? 'BOM处理中' : missingBom ? '待补BOM' : '未开始',
    nextAction: missingBom ? ASSIGN_TECHNICIAN_ACTION
      : bomInProgress ? 'VIEW_COSTING_GAP' : 'START_COSTING',
    nextActionLabel: missingBom ? '指定技术负责人'
      : bomInProgress ? '查看缺口' : '核算本产品',
    actionEnabled: true,
    batchSelectable: missingBom,
    message: '显示最近一次任务保存的状态',
  }
}

function requiresTechnicalCollaboration(workspaceStatus, workspace) {
  if (workspaceStatus === 'WAIT_BOM') return true
  return workspaceStatus === 'WAIT_PRICE'
    && String(workspace?.lastErrorCode || '').toUpperCase() !== 'FINANCE_BASE_PRICE_MISSING'
}

function workspaceGapAssignee(workspaceStatus, workspace, item) {
  if (workspaceStatus === 'WAIT_BOM') return item?.technicianName || '待指定技术负责人'
  if (workspaceStatus === 'WAIT_PRICE_TYPE') return '财务报价'
  if (workspaceStatus === 'WAIT_PRICE') {
    return workspace?.lastErrorCode === 'FINANCE_BASE_PRICE_MISSING'
      ? '财务报价'
      : '财务报价/产品技术'
  }
  return ''
}

export function canBatchStartCollaboration(row) {
  return Boolean(row?.id && row?.collaboration?.batchSelectable
    && (STARTABLE_COLLABORATION_ACTIONS.has(row.collaboration.nextAction)
      || row.collaboration.nextAction === ASSIGN_TECHNICIAN_ACTION))
}

export function buildCollaborationBatchStartItems(rows, technicianUserId = null) {
  return (rows || []).filter(canBatchStartCollaboration).map((row) => ({
    itemId: row.id,
    technicianUserId: row.collaboration?.nextAction === ASSIGN_TECHNICIAN_ACTION
      ? technicianUserId
      : undefined,
    expectedProjectionVersion: row.collaboration?.projectionVersion,
  }))
}

export function collaborationTagType(code) {
  const value = String(code || '')
  if (['AVAILABLE', 'READY_FOR_COSTING', 'COMPLETED'].includes(value)) return 'success'
  if (['NO_BOM', 'MISSING_BOM', 'MISSING_PACKAGE', 'MISSING_PRICE', 'RETURNED_TO_TECH', 'TECH_VALIDATION_FAILED'].includes(value)) return 'danger'
  if (['TECHNICIAN_UNASSIGNED', 'WAIT_TECH', 'BOM_IN_PROGRESS', 'PACKAGE_IN_PROGRESS', 'PRICE_IN_PROGRESS', 'TECH_SUBMITTED', 'WAIT_FINANCE', 'REUSABLE'].includes(value)) return 'warning'
  return 'info'
}
