export const QUOTE_SCENARIO_OPTIONS = [
  { value: 'DIRECT_SALE', label: '板换直销' },
  { value: 'STANDARD_BATCH', label: '标准品/批量品' },
  { value: 'NEW_PRODUCT', label: '新品' },
  { value: 'MASS_PRODUCT', label: '批量品' },
  { value: 'DERIVED_PRODUCT', label: '衍生品' },
  { value: 'TECH_SUPPLEMENT', label: '技术补充单' },
  { value: 'UNKNOWN', label: '待人工确认' },
]

export const CLASSIFICATION_STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: '已确认', type: 'success' },
  { value: 'PENDING', label: '待确认', type: 'warning' },
  { value: 'REJECTED', label: '已驳回', type: 'danger' },
]

export const SOURCE_TYPE_OPTIONS = [
  { value: 'EXCEL', label: 'Excel 导入', type: 'success' },
  { value: 'WEAVER_OA', label: '泛微 OA', type: 'primary' },
  { value: 'OA', label: 'OA 推送', type: 'primary' },
  { value: 'MOCK_OA', label: '模拟 OA', type: 'warning' },
  { value: 'MANUAL', label: '手工录入', type: 'info' },
  { value: 'TECH', label: '技术补充', type: 'warning' },
  { value: 'LEGACY', label: '历史数据', type: 'info' },
]

export const BOM_STATUS_OPTIONS = [
  { value: 'NOT_CHECKED', label: '未检查', type: 'info' },
  { value: 'SYNCING', label: '同步中', type: 'warning' },
  { value: 'SYNCED', label: '已同步', type: 'success' },
  { value: 'REUSED_CURRENT_MONTH', label: '已沿用', type: 'success' },
  { value: 'NO_BOM', label: '无 BOM', type: 'danger' },
  { value: 'ENTRY_PENDING', label: '待技术补录', type: 'warning' },
  { value: 'ENTRY_IN_PROGRESS', label: '技术录入中', type: 'warning' },
  { value: 'MANUAL_ENTERED', label: '已手工录入', type: 'success' },
  { value: 'EXPIRED', label: '手工 BOM 已过期', type: 'warning' },
  { value: 'CHECK_FAILED', label: '检查异常', type: 'danger' },
]

export const PRODUCT_TYPE_OPTIONS = [
  { value: 'NON_BARE', label: '非裸品', type: 'success' },
  { value: 'BARE', label: '裸品', type: 'warning' },
  { value: 'UNKNOWN', label: '未识别', type: 'info' },
]

export const REVIEW_STATUS_OPTIONS = [
  { value: 'NOT_SUBMITTED', label: '未提交', type: 'info' },
  { value: 'PENDING', label: '待审核', type: 'warning' },
  { value: 'APPROVED', label: '已通过', type: 'success' },
  { value: 'RETURNED', label: '已退回', type: 'danger' },
  { value: 'REJECTED', label: '已驳回', type: 'danger' },
]

export const PREPARATION_STATUS_OPTIONS = [
  { value: 'INIT', label: '待准备', type: 'info' },
  { value: 'READY', label: '已准备', type: 'success' },
  { value: 'NEED_TECH', label: '需技术处理', type: 'warning' },
  { value: 'TECH_SUBMITTED', label: '技术已提交', type: 'warning' },
  { value: 'CONFIRMED', label: '已确认', type: 'success' },
  { value: 'REJECTED', label: '已退回', type: 'danger' },
]

export const OA_TODO_PUSH_STATUS_OPTIONS = [
  { value: 'NOT_CREATED', label: '未创建', type: 'info' },
  { value: 'NOT_PUSHED', label: '未推送', type: 'info' },
  { value: 'PUSHED', label: '已推送', type: 'success' },
  { value: 'FAILED', label: '推送失败', type: 'danger' },
  { value: 'CLOSED', label: '已关闭', type: 'info' },
  { value: 'DONE', label: '已完成', type: 'success' },
]

export const INGEST_STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '已收到', type: 'info' },
  { value: 'VALIDATING', label: '校验中', type: 'warning' },
  { value: 'REJECTED', label: '校验失败', type: 'danger' },
  { value: 'CLASSIFY_PENDING', label: '分类待确认', type: 'warning' },
  { value: 'IMPORTED', label: '已导入', type: 'success' },
  { value: 'FAILED', label: '系统异常', type: 'danger' },
]

export const CALC_STATUS_OPTIONS = [
  { value: '未核算', label: '未核算', type: 'info' },
  { value: '试算中', label: '试算中', type: 'warning' },
  { value: '已核算', label: '已核算', type: 'success' },
]

const calcStatusAliases = {
  CALCULATED: '已核算',
  DONE: '已核算',
  SUCCESS: '已核算',
  CALCULATING: '试算中',
  RUNNING: '试算中',
  PENDING: '未核算',
  NOT_CALCULATED: '未核算',
}

const optionGroups = {
  quoteScenario: QUOTE_SCENARIO_OPTIONS,
  sourceType: SOURCE_TYPE_OPTIONS,
  classificationStatus: CLASSIFICATION_STATUS_OPTIONS,
  bomStatus: BOM_STATUS_OPTIONS,
  productType: PRODUCT_TYPE_OPTIONS,
  reviewStatus: REVIEW_STATUS_OPTIONS,
  preparationStatus: PREPARATION_STATUS_OPTIONS,
  oaTodoPushStatus: OA_TODO_PUSH_STATUS_OPTIONS,
  ingestStatus: INGEST_STATUS_OPTIONS,
  calcStatus: CALC_STATUS_OPTIONS,
}

const normalizeText = (value) => String(value ?? '').trim()

const includesText = (value, keyword) =>
  !normalizeText(keyword) || normalizeText(value).toLowerCase().includes(normalizeText(keyword).toLowerCase())

function normalizeCalcStatus(value) {
  const normalized = normalizeText(value || '未核算')
  return calcStatusAliases[normalized] || normalized
}

const optionOf = (group, value) => {
  const normalizedValue = group === 'calcStatus' ? normalizeCalcStatus(value) : value
  return optionGroups[group]?.find((item) => item.value === normalizedValue) || null
}

export function statusLabel(group, value) {
  if (!value) return '-'
  return optionOf(group, value)?.label || value
}

export function statusTagType(group, value) {
  return optionOf(group, value)?.type || 'info'
}

export function normalizeQuoteRequestPage(data) {
  return {
    list: Array.isArray(data?.list) ? data.list : [],
    total: Number(data?.total || 0),
  }
}

export function filterQuoteRequestRows(rows, filters = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!includesText(row.oaNo, filters.oaNo)) return false
    if (!includesText(row.processCode, filters.processCode)) return false
    if (!includesText(row.customer, filters.customer)) return false
    if (filters.sourceType && row.sourceType !== filters.sourceType) return false
    if (filters.quoteScenario && row.quoteScenario !== filters.quoteScenario) return false
    if (filters.classificationStatus && row.classificationStatus !== filters.classificationStatus) return false
    if (filters.bomAggregateStatus && row.bomAggregateStatus !== filters.bomAggregateStatus) return false
    if (filters.calcStatus && normalizeCalcStatus(row.calcStatus) !== filters.calcStatus) return false
    return true
  })
}

export function canConfirmClassification(row) {
  return row?.classificationStatus === 'PENDING'
}

export function hasNoBom(row) {
  if (!row) return false
  if (row.bomAggregateStatus === 'NO_BOM' || row.bomAggregateStatus === 'ENTRY_PENDING') return true
  const items = Array.isArray(row.items) ? row.items : []
  return items.some((item) => ['NO_BOM', 'ENTRY_PENDING'].includes(item?.bomStatus?.bomStatus))
}

export function mergeBomStatusToDetail(detail, bomStatusResponse) {
  if (!detail || !bomStatusResponse) return detail
  const statusByItemId = new Map()
  ;(bomStatusResponse.items || []).forEach((item) => {
    if (item.oaFormItemId != null) {
      statusByItemId.set(item.oaFormItemId, item)
    }
  })
  return {
    ...detail,
    bomAggregateStatus: aggregateBomStatus(bomStatusResponse.items || []),
    items: (detail.items || []).map((item) => ({
      ...item,
      bomStatus: statusByItemId.get(item.id) || item.bomStatus,
    })),
  }
}

function aggregateBomStatus(items) {
  const statuses = items.map((item) => item.bomStatus).filter(Boolean)
  if (statuses.length === 0) return 'NOT_CHECKED'
  if (statuses.includes('CHECK_FAILED')) return 'CHECK_FAILED'
  if (statuses.includes('SYNCING')) return 'SYNCING'
  if (statuses.includes('ENTRY_IN_PROGRESS')) return 'ENTRY_IN_PROGRESS'
  if (statuses.includes('ENTRY_PENDING')) return 'ENTRY_PENDING'
  if (statuses.includes('NO_BOM')) return 'NO_BOM'
  if (statuses.includes('EXPIRED')) return 'EXPIRED'
  if (statuses.every((status) => status === 'SYNCED')) return 'SYNCED'
  if (statuses.every((status) => status === 'REUSED_CURRENT_MONTH')) return 'REUSED_CURRENT_MONTH'
  if (statuses.every((status) => status === 'MANUAL_ENTERED')) return 'MANUAL_ENTERED'
  // 前端聚合只负责展示；成本试算最终仍以后端检查为准。
  if (statuses.every((status) => isCostReadyBomStatus(status))) return 'SYNCED'
  return 'NOT_CHECKED'
}

export function isCostReadyBomStatus(status) {
  return ['SYNCED', 'REUSED_CURRENT_MONTH', 'MANUAL_ENTERED'].includes(status)
}

export function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}
