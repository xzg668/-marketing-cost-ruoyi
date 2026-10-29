/** 缺口按实际取价类型统计；供货比率审核和结构问题不冒充缺少单价。 */
export function isSupplierRatioGap(row, reviews = []) {
  if (row?.reasonCode === 'SUPPLIER_RATIO_REVIEW_REQUIRED') return true
  const materialCode = row?.gapMaterialCode || row?.materialCode
  if (materialCode && reviews.some(review => review.status !== 'FALLBACK_HIGH'
    && review.scope?.materialCode === materialCode)) return true
  // 旧包装缺口没有保存结构化原因，仅用于兼容展示已有批次。
  return row?.sourceTable === 'lp_package_component_price_detail'
    && String(row?.message || '').includes('供货比率不足，请确认是否有新增审核')
}

export function isMissingScrapMappingGap(row) {
  const message = String(row?.message || '')
  return row?.gapType === 'MISSING_SCRAP_MAPPING'
    || row?.actionType === 'SUPPLEMENT_SCRAP_MAPPING'
    || row?.actionType === 'CONFIRM_NO_SCRAP'
    || row?.canConfirmNoScrap === true
    || row?.sourceTable === 'lp_material_scrap_ref'
    || message.includes('缺废料映射')
    || message.includes('MISSING_SCRAP_MAPPING')
}

export function priceSourceGapKind(row) {
  if (isMissingScrapMappingGap(row)) return 'SCRAP_MAPPING'
  if (['MISSING_RAW_PRICE', 'RAW_PRICE_ERROR'].includes(row?.reasonCode)) return 'RAW_PRICE'
  if (['MISSING_SCRAP_PRICE', 'SCRAP_PRICE_ERROR'].includes(row?.reasonCode)) return 'SCRAP_PRICE'
  const type = String(row?.priceType || '').trim()
  const upper = type.toUpperCase()
  if (upper === 'SETTLE_LINKED' || type.includes('结算联动')) return 'SETTLE_LINKED'
  if (['SETTLE_FIXED', '结算固定', '固定结算', '家用结算', '结算价']
    .some((token) => type.includes(token))) return 'SETTLE_FIXED'
  if (['FIXED', 'PURCHASE_FIXED'].includes(upper) || type.includes('固定')) return 'FIXED'
  if (upper === 'LINKED' || type.includes('联动')) return 'LINKED'
  if (upper === 'RANGE' || type.includes('区间')) return 'RANGE'
  if (upper === 'MAKE' || type.includes('自制')) return 'MAKE'
  // 历史失败批次可能没有价格准备明细，无法靠料号反查价格类型。
  if (row?.reasonCode === 'LINKED_RULE_ERROR') return 'LINKED'
  if (row?.itemType === 'MAKE_PART') return 'MAKE'
  return 'UNRESOLVED'
}

export function summarizePriceSourceGaps(gaps, reviews = []) {
  const rows = Array.isArray(gaps) ? gaps : []
  const summary = {
    all: rows.length,
    total: 0,
    ratioReview: 0,
    fixed: 0,
    settleFixed: 0,
    settleLinked: 0,
    linked: 0,
    range: 0,
    make: 0,
    raw: 0,
    scrap: 0,
    scrapMapping: 0,
    unresolved: 0,
  }
  for (const row of rows) {
    if (isSupplierRatioGap(row, reviews)) {
      summary.ratioReview += 1
      continue
    }
    summary.total += 1
    const key = {
      FIXED: 'fixed',
      SETTLE_FIXED: 'settleFixed',
      SETTLE_LINKED: 'settleLinked',
      LINKED: 'linked',
      RANGE: 'range',
      MAKE: 'make',
      RAW_PRICE: 'raw',
      SCRAP_PRICE: 'scrap',
      SCRAP_MAPPING: 'scrapMapping',
      UNRESOLVED: 'unresolved',
    }[priceSourceGapKind(row)]
    summary[key] += 1
  }
  return summary
}

/** 母件只提供 BOM 上下文；补价、统计始终针对实际缺价料号。
 * 同一缺价料出现在多个母件下时保留各处上下文，不猜测它属于哪一处。
 */
export function buildPriceSourceGapTree(gaps, bomRows = []) {
  const byCode = new Map(), byNodeKey = new Map()
  function visit(rows, parent = null) {
    for (const row of rows || []) {
      const code = row.materialCode || row.childCode
      if (code) {
        const node = { ...row, materialCode: code, parentCode: row.parentCode || parent?.materialCode,
          parentNodeKey: row.parentNodeKey || parent?.nodeKey }
        const matches = byCode.get(code) || []
        matches.push(node); byCode.set(code, matches)
        if (node.nodeKey) byNodeKey.set(node.nodeKey, node)
        visit(row.children, node)
      } else visit(row.children, parent)
    }
  }
  visit(bomRows)
  const result = [], parents = new Map()
  function parentNodes(gap) {
    const code = gap.gapMaterialCode || gap.materialCode
    if (gap.materialCode && gap.materialCode !== code) {
      return byCode.get(gap.materialCode) || [{ materialCode: gap.materialCode }]
    }
    return (byCode.get(code) || []).flatMap(node => {
      if (node.parentNodeKey) {
        const parent = byNodeKey.get(node.parentNodeKey)
        return parent && parent.materialCode !== code ? [parent] : []
      }
      if (!node.parentCode || node.parentCode === code) return []
      const matches = byCode.get(node.parentCode) || []
      // Flat costing rows carry a path. Resolve the parent by that path when possible.
      const path = node.path || node.nodePath
      const ancestors = path ? matches.filter(parent => {
        const parentPath = parent.path || parent.nodePath
        return parentPath && path.startsWith(parentPath) && parentPath !== path
      }) : []
      if (ancestors.length) return ancestors.sort((a, b) => (b.path || b.nodePath).length - (a.path || a.nodePath).length).slice(0, 1)
      return matches.length === 1 ? matches : []
    })
  }
  for (const [index, gap] of (gaps || []).entries()) {
    const contexts = parentNodes(gap)
    if (!contexts.length) {
      result.push({ ...gap, gapTreeKey: `gap:${index}` })
      continue
    }
    for (const parent of contexts) {
      const key = parent.nodeKey || parent.path || parent.nodePath || parent.materialCode
      let context = parents.get(key)
      if (!context) {
        context = { gapTreeKey: `parent:${key}`, isGapContext: true,
          gapMaterialCode: parent.materialCode, materialName: parent.materialName || parent.childName || '',
          priceType: parent.priceType || (gap.itemType === 'MAKE_PART' ? '自制件' : ''), children: [] }
        parents.set(key, context); result.push(context)
      }
      if (!context.children.some(child => child.gapTreeKey === `gap:${index}:${key}`)) {
        context.children.push({ ...gap, gapTreeKey: `gap:${index}:${key}` })
      }
    }
  }
  return result
}
