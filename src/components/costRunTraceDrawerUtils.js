const RANGE_FACTOR_NAMES = {
  CU: '铜价',
  ZN: '锌价',
  AL: '铝价',
  GOLD: '黄金',
  SILVER: '白银',
  SUS304: '不锈钢304',
  SUS316L: '不锈钢316L',
}

export function parseTraceJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function rangeFactorDisplayName(code, fallback = '') {
  const normalized = String(code ?? '').trim().toUpperCase()
  if (RANGE_FACTOR_NAMES[normalized]) return RANGE_FACTOR_NAMES[normalized]
  const text = String(fallback ?? '').trim()
  if (text.includes('铜')) return '铜价'
  if (text.includes('锌')) return '锌价'
  if (text.includes('铝')) return '铝价'
  if (text.includes('黄金') || text.includes('金价')) return '黄金'
  if (text.includes('白银') || text.includes('银价')) return '白银'
  if (text.includes('316')) return '不锈钢316L'
  if (text.includes('304')) return '不锈钢304'
  return text.replace(/区间价?$/, '').replace(/区间$/, '') || '行情'
}

export function rangeTraceMeta(detail) {
  const source = parseTraceJson(detail?.sourceSnapshotJson) || parseTraceJson(detail?.sourceSnapshot) || {}
  const variables = parseTraceJson(detail?.variablesJson) || parseTraceJson(detail?.variables) || {}
  const rangeItem = source.rangePriceItem || {}
  const conclusion = source.priceConclusion || {}
  const rangeBasis = firstText(
    rangeItem.rangeBasis,
    rangeItem.range_basis,
    conclusion.rangeBasis,
    conclusion.range_basis,
    variables.rangeBasis,
    variables.range_basis
  )
  const rangeType = firstText(
    rangeItem.rangeType,
    rangeItem.range_type,
    conclusion.rangeType,
    conclusion.range_type,
    variables.rangeType,
    variables.range_type
  )
  const factorCode = firstText(
    rangeItem.factorCode,
    rangeItem.factor_code,
    conclusion.factorCode,
    conclusion.factor_code,
    variables.factorCode,
    variables.factor_code
  )
  const isFactorRange = String(rangeBasis ?? '').trim().toUpperCase() === 'FACTOR' || Boolean(factorCode)
  return {
    isFactorRange,
    factorCode,
    factorName: rangeFactorDisplayName(factorCode, rangeType),
    rangeType,
  }
}

export function rangeTraceExplanation(detail) {
  const meta = rangeTraceMeta(detail)
  if (meta.isFactorRange) {
    return `该部品为采购件，按报价单${meta.factorName}命中区间，取命中单价，再按 BOM 用量计算本次金额。`
  }
  return `该部品为采购件，按 BOM 用量命中区间，取该区间单价，再计算本次金额。`
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}
