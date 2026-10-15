export const businessUnitLabel = (value) => ({ COMMERCIAL: '商用', PLATE: '板换', HOUSEHOLD: '家用' })[value] || value || '未选择业务单元'
export const originalActionLabel = (value) => ({ NEW: '新增', REVISION: '修订', UNCHANGED: '未变' })[value] || '待检查'
export const originalFormulaText = (value) => {
  if (value == null) return '该版本未保存中文公式'
  return value.trim() ? value : '原稿未填写中文公式'
}
export const priceText = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && !value.trim()) return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 6 }) : '—'
}
export const originalSummary = (rows = [], errors = []) => ({
  newCount: rows.filter(row => row.action === 'NEW').length,
  revisedCount: rows.filter(row => row.action === 'REVISION').length,
  unchangedCount: rows.filter(row => row.action === 'UNCHANGED').length,
  errorCount: errors.length,
})
export const financeCopperPerTon = (context) => {
  const copper = context?.financial?.factors?.['AVG|1#CU']
  if (copper?.price == null) return null
  if (['CNY_TON', 'CNY/TON'].includes(copper.unit)) return Number(copper.price)
  if (['CNY_KG', 'CNY/KG'].includes(copper.unit)) return Number(copper.price) * 1000
  return null
}
export const rangeText = (range) => range ? `${range.lowerInclusive ? '[' : '('}${priceText(range.low)}, ${priceText(range.high)}${range.upperInclusive ? ']' : ')'}` : '—'

export const effectivePriceStatusLabel = (status) => ({ READY: '已就绪', WAIT_FINANCE_BASE: '待基价', NOT_APPLICABLE: '不适用', ERROR: '待处理' })[status] || '读取中'

export const originalPublicationMessage = (result, kind) => {
  const generated = result?.effectivePrices?.generated ?? result?.effectivePriceGeneratedCount ?? 0
  const waiting = result?.effectivePrices?.waitingRules ?? result?.effectivePriceWaitingCount ?? 0
  if (waiting > 0 || result?.effectivePriceStatus === 'WAIT_FINANCE_BASE') return `${kind}原稿已保存，待发布适用财务基价`
  return `${kind}原稿已确认，财务有效价已就绪${generated > 0 ? `（本次生成 ${generated} 条）` : ''}`
}

export const financePublicationMessage = (result) => {
  const prices = result?.effectivePrices
  const generated = prices?.generated ?? 0, reused = prices?.reused ?? 0
  if (generated + reused === 0) return '财务基价已发布，尚无可生成有效价的适用原稿'
  return `财务基价已发布，有效价已就绪（本次生成 ${generated} 条，已有 ${reused} 条）`
}
