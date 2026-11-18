export const amount = (value, digits = 6) => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: digits, useGrouping: false })
}
export const signedAmount = (value) => Number(value) > 0 ? `+${amount(value, 8)}` : amount(value, 8)
export const differenceClass = (value) => Number(value) > 0 ? 'price-up' : Number(value) < 0 ? 'price-down' : ''
export const differenceSentence = (value) => Number(value) > 0 ? `增加 ${amount(value, 8)} 元` : Number(value) < 0 ? `减少 ${amount(String(value).replace(/^-/, ''), 8)} 元` : '价格不变'
export const copperTrialPayload = (baseline, value) => {
  const copper = String(value ?? '').trim()
  if (!/^\d+(?:\.\d+)?$/.test(copper) || Number(copper) <= 0 || Number(copper) > 1000000000) throw new Error('请输入大于0且不超过1000000000的Cu价格（元/吨）')
  return { expectedBasis: baseline.basis, copperPerTon: copper }
}
