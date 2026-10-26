import { reactive, watch } from 'vue'

/** A read belongs to its selection, account and permission; stale responses cannot restore cleared data. */
export function createMonthlyRead({ fetch, scope, allowed }) {
  const state = reactive({ data: null, loading: false, error: '' })
  let epoch = 0, disposed = false
  function clear() { epoch++; state.data = null; state.loading = false; state.error = '' }
  const stop = watch([scope, allowed], clear, { flush: 'sync' })
  async function load(input) {
    clear()
    const ticket = epoch, owner = scope()
    const active = () => !disposed && ticket === epoch && !!owner && owner === scope() && allowed()
    if (!active()) return
    state.loading = true
    try { const value = await fetch(input); if (active()) state.data = value }
    catch (error) { if (active()) state.error = error?.message || '月价读取失败，请重试' }
    finally { if (active()) state.loading = false }
  }
  return { state, load, clear, dispose() { disposed = true; stop(); clear() } }
}

export const monthlyType = value => ({ NORMAL: '普通物料', HOUSEHOLD_INQUIRY: '家用询价' }[value] || value)
export const monthlySource = value => ({ ODS_ORDER: '订单价', ODS_TIER: '阶梯价', PURCHASE_FIXED: '采购固定价', HOUSEHOLD_INQUIRY: '家用部件询价', SETTLE_FIXED: '结算固定价', SETTLE_LINKED: '结算联动价', LINKED_ORIGINAL: '联动价', RANGE_ORIGINAL: '区间价', RANGE_LEGACY_FACTOR: '因素区间价', RANGE_QUANTITY: '数量区间价', SCRAP: '废料价', SUPPLEMENTAL_FIXED: '有效补录固定价' }[value] || value)
export function monthlyQuantity(range) {
  if (range.lower == null && range.upper == null) return '不限数量'
  return `${range.lowerInclusive ? '[' : '('}${range.lower ?? '不限'}, ${range.upper ?? '不限'}${range.upperInclusive ? ']' : ')'}`
}
export function monthlyAnnualUsage(domain) {
  if (!domain) return '不限年用量'
  if (!domain.quantities) return '未提供年用量'
  if (domain.includesUnknown && domain.quantities.lower == null && domain.quantities.upper == null) return '不限年用量'
  const range = monthlyQuantity(domain.quantities)
  return `${range}${domain.includesUnknown ? '（含未提供年用量）' : ''}`
}
export function monthlyCondition(domain) {
  if (domain.mode === 'ANY') return '通用条件'
  const values = domain.values.map(value => value.boardTerms ? `304钢价 ${value.boardTerms.sus304PricePerTon}；316L钢价 ${value.boardTerms.sus316lPricePerTon}；${value.boardTerms.finalTender ? '最终投标' : '非最终投标'}` : '无板片特定条件')
  return `${domain.mode === 'EXACT' ? '仅适用' : '排除'}：${values.join(' / ')}`
}
export function monthlyFilter(query, defaultMonth) {
  const result = {}
  for (const key of ['materialCode', 'organization', 'pricingType', 'specification', 'unit', 'currency', 'taxBasis', 'supplier']) result[key] = typeof query[key] === 'string' ? query[key] : ''
  result.month = typeof query.month === 'string' ? query.month : defaultMonth
  for (const [key, fallback, max] of [['page', 1, 1000000], ['size', 20, 100]]) {
    const n = Number(query[key]); result[key] = Number.isInteger(n) && n >= 1 && n <= max ? n : fallback
  }
  return result
}
