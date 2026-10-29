// 未填写、明确零值和没有旧版本分别展示，不能相互补齐。
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '未填写'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(4).replace(/(\.\d{2})0{2}$/, '$1').replace(/(\.\d{3})0$/, '$1')}%` : '未填写'
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
    ['materialShape', '形态属性'], ['supplierName', '供应商名称'], ['supplyRatio', '供货比例'],
  ].map(([key, label]) => ({
    label,
    before: !change.before ? '无原记录' : key === 'supplyRatio' ? formatPercent(change.before[key]) : (change.before[key] ?? '—'),
    after: key === 'supplyRatio' ? formatPercent(change.after?.[key]) : (change.after?.[key] ?? '—'),
  }))
}
