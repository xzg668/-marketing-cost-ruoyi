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
export function decimalInput(value) {
  const text = String(value ?? '').trim()
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(text)) throw new Error('请填写非负数，最多12位小数；空白不表示零')
  return text
}
const reason = (value) => {
  const text = String(value || '').trim()
  if (!text) throw new Error('请填写财务确认依据')
  return text
}
export const weightChange = (form, revision) => ({
  copperWeightG: decimalInput(form.copper), zincWeightG: decimalInput(form.zinc),
  reason: reason(form.reason), expectedRevision: revision,
})
export function importWeightStatus(rule) {
  if (rule.priceType !== 'SETTLE_LINKED') return '固定价无需重量'
  if (rule.formula?.version !== 'SETTLEMENT_CU_ZN_ROUND4_V2' || rule.weights?.originalCopperG == null) return '待确认完整重量'
  return rule.weights.originalZincG == null ? '原稿锌重空白，按0计算' : '采用本次原稿重量'
}
export function settlementFinanceScheme(base) {
  const scheme = base?.financial?.scope?.schemeCode
  return scheme?.startsWith('CU_') ? `Cu ${scheme.slice(3).replace('_', '.')} 元/吨方案` : scheme || '未使用'
}
