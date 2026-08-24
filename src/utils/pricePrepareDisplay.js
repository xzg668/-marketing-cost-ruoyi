function positiveInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

function text(value) {
  return String(value ?? '').trim()
}

export function carriedForwardPriceCount(value) {
  return positiveInteger(value)
}

export function priceReadyLabel(value) {
  const count = carriedForwardPriceCount(value)
  return count > 0 ? `价格齐全 · ${count}项沿用历史价` : '价格齐全'
}

export function isCarriedForwardPrice(row) {
  return row?.carriedForward === true || Number(row?.carriedForward) === 1
}

export function countCarriedForwardPrices(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isCarriedForwardPrice).length
}

export function priceValidityText(row) {
  const warning = text(row?.warningMessage)
  if (isCarriedForwardPrice(row)) {
    if (warning) return warning
    const effectiveTo = text(row?.sourceEffectiveTo)
    return effectiveTo
      ? `审批有效期至 ${effectiveTo}，本次继续报价`
      : '沿用最近一次已审批价格，本次继续报价'
  }
  const effectiveFrom = text(row?.sourceEffectiveFrom)
  const effectiveTo = text(row?.sourceEffectiveTo)
  if (effectiveFrom || effectiveTo) {
    return `有效期：${effectiveFrom || '未记录'} 至 ${effectiveTo || '长期'}`
  }
  return '当前价格'
}
