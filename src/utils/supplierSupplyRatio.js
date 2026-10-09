// 比例留空与明确填写 0% 的供应关系必须区分，展示和编辑都不能补零。
function isBlank(value) {
  return value === null || value === undefined || value === ''
}

export function decimalToPercent(value) {
  if (isBlank(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? Number((number * 100).toFixed(2)) : null
}

export function percentToDecimal(value) {
  if (isBlank(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? Number((number / 100).toFixed(6)) : null
}

export function formatPercent(value) {
  if (isBlank(value)) return '未填写'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '未填写'
}
