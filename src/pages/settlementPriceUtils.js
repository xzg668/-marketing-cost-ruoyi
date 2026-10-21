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
export const baseChange = (form, month, current) => ({
  priceMonth: month, copperPrice: decimalInput(form.copper), zincPrice: decimalInput(form.zinc),
  unit: form.unit, reason: reason(form.reason), expectedRevision: current?.priceMonth === month ? current.revisionNo : 0,
})
