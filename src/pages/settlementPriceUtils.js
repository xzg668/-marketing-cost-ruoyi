export const modeLabel = (mode) => ({ FIXED_GIVEN: '固定给定价', LINKED_GIVEN: '联动给定价', LINKED_FORMULA: '联动公式价' }[mode] || '待检查')
export const typeLabel = (type) => type === 'SETTLE_LINKED' ? '结算联动价' : '结算固定价'
export const displayDecimal = (value) => value == null ? '未填写' : String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
export function settlementMonth(query = {}) {
  const value = query.priceMonth || query.pricingMonth || query.periodMonth
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') ? value : '2026-10'
}
export function settlementReturnTo(value) {
  return typeof value === 'string' && /^\/(quote|cost|ingest\/quote-requests)\//.test(value) && !/[\\\r\n]/.test(value) ? value : ''
}
export function importWeightStatus(rule) {
  if (rule.priceType !== 'SETTLE_LINKED') return '固定价无需重量'
  if (rule.formula?.version !== 'SETTLEMENT_CU_ZN_ROUND4_V2' || rule.weights?.originalCopperG == null) return '原稿重量待补齐'
  return rule.weights.originalZincG == null ? '原稿锌重空白，按0计算' : '采用本次原稿重量'
}
export function settlementFinanceScheme(base) {
  const scheme = base?.financial?.scope?.schemeCode
  return scheme?.startsWith('CU_') ? `Cu ${scheme.slice(3).replace('_', '.')} 元/吨方案` : scheme || '未使用'
}
