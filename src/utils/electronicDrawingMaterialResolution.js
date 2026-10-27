export const ELECTRONIC_DRAWING_SEARCH_TYPES = [
  { value: 'DRAWING_NO', label: '图号' },
  { value: 'MATERIAL_CODE', label: 'U9 料号' },
  { value: 'MATERIAL_NAME', label: '物料名称' },
]

// 成品根节点仅用于展示报价产品；图库行仍使用已保存的父子关系和相对用量。
export function buildDrawingSourceTree(items = [], product = {}) {
  if (!items.length) return []
  const bySequence = new Map(items.map(item => [item.sourceSequence, { ...item, children: [] }]))
  const roots = []
  for (const row of bySequence.values()) {
    const parent = row.parentSourceSequence && bySequence.get(row.parentSourceSequence)
    if (parent) parent.children.push(row)
    else roots.push(row)
  }
  return [{
    sourceSequence: 'QUOTE_PRODUCT',
    isProductRoot: true,
    materialNo: product.materialNo,
    productName: product.productName,
    sunlModel: product.sunlModel,
    customerDrawing: product.customerDrawing,
    children: roots,
  }]
}

export function pendingElectronicDrawingItems(state) {
  return (state?.items || []).filter((item) => item?.requiresAction)
}

export function sourceSearchKeyword(item, searchType) {
  if (!item) return ''
  if (searchType === 'DRAWING_NO') return item.drawingCode || ''
  if (searchType === 'MATERIAL_NAME') return item.sourceName || ''
  return ''
}

export function buildElectronicDrawingResolutionRequest(state, selections) {
  const pendingIds = new Set(
    (state?.items || []).filter(item => item.requiresAction || item.canModify)
      .map((item) => String(item.sourceNodeId)),
  )
  const values = Object.entries(selections || {})
    .filter(([sourceNodeId, option]) => pendingIds.has(String(sourceNodeId)) && option?.materialCode)
    .map(([sourceNodeId, option]) => ({
      sourceNodeId: Number(sourceNodeId),
      materialCode: String(option.materialCode).trim(),
    }))
  return {
    expectedTaskVersion: state?.taskVersion,
    expectedSourceVersionId: state?.sourceVersionId,
    selections: values,
  }
}

export function nextUnselectedElectronicDrawingItem(items, selections, currentId) {
  const rows = items || []
  if (!rows.length) return null
  const currentIndex = Math.max(0, rows.findIndex(
    (item) => String(item.sourceNodeId) === String(currentId),
  ))
  for (let offset = 1; offset <= rows.length; offset += 1) {
    const candidate = rows[(currentIndex + offset) % rows.length]
    if (!selections?.[candidate.sourceNodeId]) return candidate
  }
  return rows[currentIndex] || rows[0]
}

export function isElectronicDrawingVersionConflict(error) {
  return error?.resultCode === 409
    || error?.domainCode === 'TASK_VERSION_CONFLICT'
    || String(error?.message || '').includes('TASK_VERSION_CONFLICT')
}
