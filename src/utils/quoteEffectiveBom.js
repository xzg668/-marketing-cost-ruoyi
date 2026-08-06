const STATE_META = Object.freeze({
  DRAFT: { label: '已就绪', type: 'success' },
  FROZEN: { label: '本月已确定', type: 'success' },
  REUSED: { label: '本月已沿用', type: 'success' },
  BLOCKED: { label: '需处理', type: 'danger' },
  ERROR: { label: '加载失败', type: 'danger' },
})

const SHAPE_META = Object.freeze({
  MANUFACTURE: { label: '制造件', type: 'primary' },
  PURCHASE: { label: '采购件', type: 'success' },
  OUTSOURCE: { label: '委外加工件', type: 'warning' },
  VIRTUAL: { label: '虚拟件', type: 'info' },
})

const SHAPE_SOURCE_LABELS = Object.freeze({
  U9: 'U9 料品档案',
  STRUCTURE_ROOT: '产品结构根',
  FIXED_POLICY: '固定形态规则',
  SUPPLIER_RATIO: '供货比例规则',
})

const ALTERNATIVE_META = Object.freeze({
  STANDARD: { label: '标准料', type: 'primary' },
  ALTERNATIVE: { label: '替代料', type: 'warning' },
})

const EXCLUSION_REASON_LABELS = Object.freeze({
  PURCHASE_DESCENDANT_CUT: '采购件截断子树',
  POLICY_DIRECT_CHILD_EXCLUSION: '形态规则排除直接子件',
  ALTERNATIVE_UNSELECTED: '未选中的标准/替代分支',
  PURCHASE_SUBTREE_CUT: '采购件截断子树',
  OUTSOURCE_CHILD_EXCLUDED: '形态规则排除直接子件',
  ALTERNATIVE_BRANCH_NOT_SELECTED: '未选中的标准/替代分支',
  VIRTUAL_NODE_PASSTHROUGH: '虚拟节点透传',
})

export function emptyQuoteEffectiveBom(state = '') {
  return {
    state,
    nodes: [],
    alternativeSelections: [],
    exclusionSummary: { available: true, excludedNodeCount: 0, reasonCounts: {} },
    blockIssues: [],
    warnings: [],
  }
}

export function normalizeQuoteEffectiveBom(value) {
  const source = value && typeof value === 'object' ? value : {}
  const exclusionSummary = source.exclusionSummary && typeof source.exclusionSummary === 'object'
    ? source.exclusionSummary
    : {}
  return {
    ...emptyQuoteEffectiveBom(),
    ...source,
    state: normalizeCode(source.state),
    nodes: Array.isArray(source.nodes) ? source.nodes : [],
    alternativeSelections: Array.isArray(source.alternativeSelections) ? source.alternativeSelections : [],
    exclusionSummary: {
      available: exclusionSummary.available !== false,
      excludedNodeCount: exclusionSummary.excludedNodeCount ?? 0,
      reasonCounts: exclusionSummary.reasonCounts && typeof exclusionSummary.reasonCounts === 'object'
        ? exclusionSummary.reasonCounts
        : {},
    },
    blockIssues: Array.isArray(source.blockIssues) ? source.blockIssues : [],
    warnings: Array.isArray(source.warnings) ? source.warnings : [],
  }
}

export function buildQuoteEffectiveBomTree(nodes) {
  const rows = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node && node.nodeKey)
    .map((node) => ({ ...node, children: [] }))
  const byKey = new Map(rows.map((node) => [String(node.nodeKey), node]))
  const roots = []

  rows.forEach((node) => {
    const parentKey = String(node.parentNodeKey || '')
    const parent = parentKey ? byKey.get(parentKey) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  })

  const compare = (left, right) => {
    const bySort = Number(left.sortSeq ?? 0) - Number(right.sortSeq ?? 0)
    return bySort || String(left.nodePath || left.nodeKey).localeCompare(String(right.nodePath || right.nodeKey))
  }
  const sortChildren = (list) => {
    list.sort(compare)
    list.forEach((node) => sortChildren(node.children))
  }
  sortChildren(roots)
  return roots
}

export function effectiveBomStateMeta(state) {
  return STATE_META[normalizeCode(state)] || { label: '待加载', type: 'info' }
}

export function effectiveBomIsReadOnly(state) {
  return ['FROZEN', 'REUSED'].includes(normalizeCode(state))
}

export function effectiveBomStepCompleted(state) {
  return effectiveBomIsReadOnly(state)
}

export function effectiveBomCanConfirm(response) {
  const value = normalizeQuoteEffectiveBom(response)
  return value.state === 'DRAFT' && value.nodes.length > 0 && value.blockIssues.length === 0
}

/** 只有后端校验为当前规则版本的构建与工作台明细一致，才可直接进入第 2 步。 */
export function effectiveBomMatchesCostingBuild(effectiveBom, workbench) {
  const effectiveBuildBatchId = String(effectiveBom?.buildBatchId || '').trim()
  const workbenchBuildBatchId = String(workbench?.buildBatchId || '').trim()
  const rows = Array.isArray(workbench?.bomRows) ? workbench.bomRows : []
  return Boolean(
    effectiveBuildBatchId
    && workbenchBuildBatchId === effectiveBuildBatchId
    && rows.length > 0
  )
}

/** 进入第2步后，以本次暂存接口返回的构建编号核对工作台，不能拿 DRAFT 预览的空编号误判。 */
export function costingBomMatchesPreparedBuild(prepared, workbench) {
  const preparedBuildBatchId = String(prepared?.buildBatchId || '').trim()
  const workbenchBuildBatchId = String(workbench?.buildBatchId || '').trim()
  const rows = Array.isArray(workbench?.bomRows) ? workbench.bomRows : []
  return Boolean(
    preparedBuildBatchId
    && workbenchBuildBatchId === preparedBuildBatchId
    && rows.length > 0
  )
}

export function effectiveShapeMeta(shape) {
  const code = normalizeCode(shape)
  return SHAPE_META[code] || { label: shape || '形态未知', type: 'info' }
}

export function effectiveShapeSourceLabel(source) {
  const code = normalizeCode(source)
  return SHAPE_SOURCE_LABELS[code] || source || '来源未知'
}

export function effectiveAlternativeMeta(childType) {
  return ALTERNATIVE_META[normalizeCode(childType)] || null
}

export function effectiveAlternativeNodeMeta(node, activeGroupKeys = []) {
  const childType = normalizeCode(node?.alternativeChildType)
  const groupKey = String(node?.alternativeGroupKey || '').trim()
  const activeKeys = activeGroupKeys instanceof Set ? activeGroupKeys : new Set(activeGroupKeys)
  if (childType === 'STANDARD' && (!groupKey || !activeKeys.has(groupKey))) return null
  return effectiveAlternativeMeta(childType)
}

export function effectiveNodeEvidenceVisible(node) {
  const source = normalizeCode(node?.shapeResolutionSource)
  if (source && !['U9', 'STRUCTURE_ROOT'].includes(source)) return true
  return Boolean(effectiveSupplierEvidence(node))
}

export function formatSupplyRatio(value) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  const percent = Math.abs(number) <= 1 ? number * 100 : number
  return `${Number(percent.toFixed(4))}%`
}

export function effectiveSupplierEvidence(node) {
  const supplier = String(node?.selectedSupplierName || node?.selectedSupplierCode || '').trim()
  if (!supplier) return ''
  const ratio = formatSupplyRatio(node?.selectedSupplyRatio)
  return ratio ? `主供应商：${supplier}（${ratio}）` : `主供应商：${supplier}`
}

export function effectiveBomExclusionItems(summary) {
  const value = summary && typeof summary === 'object' ? summary : {}
  const counts = value.reasonCounts && typeof value.reasonCounts === 'object' ? value.reasonCounts : {}
  return Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .map(([reason, count]) => ({
      reason,
      label: EXCLUSION_REASON_LABELS[normalizeCode(reason)] || reason,
      count: Number(count),
    }))
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}
