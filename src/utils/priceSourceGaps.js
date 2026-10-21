/** 缺口按实际取价类型统计；供货比率审核和结构问题不冒充缺少单价。 */
export function isSupplierRatioGap(row) {
  if (row?.reasonCode === 'SUPPLIER_RATIO_REVIEW_REQUIRED') return true
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

export function summarizePriceSourceGaps(gaps) {
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
    scrapMapping: 0,
    unresolved: 0,
  }
  for (const row of rows) {
    if (isSupplierRatioGap(row)) {
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
      SCRAP_MAPPING: 'scrapMapping',
      UNRESOLVED: 'unresolved',
    }[priceSourceGapKind(row)]
    summary[key] += 1
  }
  return summary
}
