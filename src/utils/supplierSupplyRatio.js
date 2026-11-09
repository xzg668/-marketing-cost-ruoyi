// 未填写、明确零值和没有旧版本分别展示，不能相互补齐。
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '未填写'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(4).replace(/(\.\d{2})0{2}$/, '$1').replace(/(\.\d{3})0$/, '$1')}%` : '未填写'
}

export function supplierRatioPercentInput(value) {
  return value === null || value === undefined || value === '' ? ''
    : (Number(value) * 100).toFixed(4).replace(/\.?0+$/, '')
}

export function supplierRatioFromPercent(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!/^\d+(?:\.\d{1,4})?$/.test(text) || Number(text) > 100) {
    throw new Error('供货比例请输入0到100之间的数字，最多4位小数；未填写请留空')
  }
  return (Number(text) / 100).toFixed(6)
}

function savedValue(value) {
  if (!value) return null
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null }
}

export function normalizeSupplierRatioChange(change) {
  return { ...change, before: savedValue(change.beforeValue), after: savedValue(change.afterValue) }
}

export function supplierRatioChangeFields(change) {
  return [
    ['materialName', '物料名称'], ['specModel', '型号'], ['unit', '单位'],
    ['selectionRule', '取价规则'], ['materialShape', '形态属性'], ['supplierName', '供应商名称'], ['supplyRatio', '供货比例'],
  ].map(([key, label]) => ({
    label,
    before: !change.before ? '无原记录' : key === 'supplyRatio' ? formatPercent(change.before[key]) : (change.before[key] ?? '—'),
    after: change.after?.isActive === 0 ? '已移出当前集合'
      : key === 'supplyRatio' ? formatPercent(change.after?.[key]) : (change.after?.[key] ?? '—'),
  }))
}
