export const FINANCE_CU_DEFAULT_PRICE_PER_TON = 90000
export const FINANCE_CU_MAX_PRICE_PER_TON = 1000000

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const currentMonthText = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export const addMonths = (monthText, offset) => {
  if (!MONTH_PATTERN.test(String(monthText || '')) || !Number.isInteger(offset)) {
    return ''
  }
  const [year, month] = monthText.split('-').map(Number)
  const total = year * 12 + month - 1 + offset
  const targetYear = Math.floor(total / 12)
  const targetMonth = total - targetYear * 12 + 1
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`
}

export const validateMonthRange = (monthFrom, monthTo) => {
  if (!MONTH_PATTERN.test(String(monthFrom || ''))) return '开始月份必须为YYYY-MM格式'
  if (!MONTH_PATTERN.test(String(monthTo || ''))) return '结束月份必须为YYYY-MM格式'
  if (monthTo < monthFrom) return '结束月份不能早于开始月份'
  return ''
}

export const validatePricePerTon = (value) => {
  if (value == null || value === '') return 'Cu基准价格不能为空'
  const price = Number(value)
  if (!Number.isFinite(price)) return 'Cu基准价格必须是有效数字'
  if (price <= 0) return 'Cu基准价格必须大于0元/吨'
  if (price > FINANCE_CU_MAX_PRICE_PER_TON) {
    return `Cu基准价格不能超过${formatPricePerTon(FINANCE_CU_MAX_PRICE_PER_TON)}元/吨`
  }
  return ''
}

export const validateChangeReason = (value) =>
  String(value || '').trim() ? '' : '调整原因不能为空'

export const formatPricePerTon = (value) => {
  if (value == null || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const formatDateTime = (value) => {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 19)
}

export const hasFinanceCuEditPermission = (permissions) => {
  const values = Array.isArray(permissions) ? permissions : []
  return values.includes('*:*:*') || values.includes('cost:finance-cu-base:edit')
}

export const initializationResultMessage = (result) => {
  const created = Number(result?.createdCount || 0)
  const skipped = Number(result?.skippedCount || 0)
  return `初始化完成：新增${created}个月，跳过已存在${skipped}个月`
}
