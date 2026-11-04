export const ELECTRONIC_DRAWING_SEARCH_TYPES = [
  { value: 'DRAWING_NO', label: '图号' },
  { value: 'MATERIAL_CODE', label: 'U9 料号' },
  { value: 'MATERIAL_NAME', label: '物料名称' },
]

// 图库负责成品结构；已采用的 U9 子 BOM 继续挂到对应制造节点，重复出现的分支各自保留。
export function buildDrawingSourceTree(items = [], product = {}) {
  if (!items.length) return []
  const bySequence = new Map(items
    .filter(item => item.processingState !== 'EXCLUDED')
    .map(item => [item.sourceSequence, { ...item, children: [], nodeOrigin: 'DRAWING' }]))
  const roots = []
  for (const row of bySequence.values()) {
    const parent = row.parentSourceSequence && bySequence.get(row.parentSourceSequence)
    if (parent) parent.children.push(row)
    else roots.push(row)
  }
  for (const row of bySequence.values()) {
    if (row.processingState === 'U9_READY') row.children.push(...buildU9Children(row))
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

function buildU9Children(anchor) {
  const rows = anchor.u9Children || []
  const key = nodeKey => JSON.stringify(['U9', anchor.sourceSequence, nodeKey])
  const nodes = new Map(rows.map(row => [row.nodeKey, {
    sourceSequence: key(row.nodeKey),
    parentSourceSequence: row.parentNodeKey == null ? anchor.sourceSequence : key(row.parentNodeKey),
    sourceName: row.materialName,
    resolvedMaterialCode: row.materialCode,
    resolvedMaterialName: row.materialName,
    resolvedMaterialSpec: row.materialSpec,
    resolvedMaterialNature: row.shapeAttr,
    resolvedUnit: row.unit,
    drawingCode: row.drawingNo,
    quantity: row.quantity,
    parentBaseQty: row.parentBaseQty,
    bomPurpose: row.bomPurpose,
    bomVersion: row.bomVersion,
    sourceU9BomId: row.sourceU9BomId,
    sourceRawHierarchyId: row.sourceRawHierarchyId,
    sortSeq: row.sortSeq,
    nodeOrigin: 'U9',
    canModify: false,
    children: [],
  }]))
  const roots = []
  for (const row of rows) {
    const node = nodes.get(row.nodeKey)
    if (row.parentNodeKey == null) roots.push(node)
    else nodes.get(row.parentNodeKey)?.children.push(node)
  }
  const sort = children => {
    children.sort((a, b) => (a.sortSeq ?? Number.MAX_SAFE_INTEGER) - (b.sortSeq ?? Number.MAX_SAFE_INTEGER))
    children.forEach(child => sort(child.children))
  }
  sort(roots)
  return roots
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
