const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/
const MONTHLY_REPRICE_OPERATE_PERMISSION = 'price:monthly-reprice:operate'
const MONTHLY_REPRICE_OPERATOR_ROLES = new Set([
  'ADMIN',
  'ROLE_ADMIN',
  'BU_DIRECTOR',
  'ROLE_BU_DIRECTOR',
])

export const formatSnapshotDecimal = (value, maximumFractionDigits = 8) => {
  if (value === null || value === undefined || value === '') return '—'
  const text = String(value).trim()
  const matched = DECIMAL_PATTERN.exec(text)
  if (!matched) return text

  const [, sign, integerText, fractionText = ''] = matched
  const integer = integerText.replace(/^0+(?=\d)/, '')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = fractionText
    .slice(0, Math.max(0, maximumFractionDigits))
    .replace(/0+$/, '')
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`
}

export const differenceAmountClass = (value) => {
  const normalized = String(value ?? '').trim()
  if (!normalized || /^[-+]?0+(?:\.0+)?$/.test(normalized)) return 'difference-zero'
  return normalized.startsWith('-') ? 'difference-negative' : 'difference-positive'
}

export const canOperateMonthlyReprice = ({ permissions, roles } = {}) => {
  const permissionValues = Array.isArray(permissions) ? permissions : []
  if (
    permissionValues.includes('*:*:*')
    || permissionValues.includes(MONTHLY_REPRICE_OPERATE_PERMISSION)
  ) {
    return true
  }
  const roleValues = Array.isArray(roles) ? roles : []
  return roleValues.some((role) => MONTHLY_REPRICE_OPERATOR_ROLES.has(String(role || '').trim().toUpperCase()))
}

export const isCostRunLockedByMonthlyReprice = (lock, user = {}) =>
  Boolean(lock?.locked) && !canOperateMonthlyReprice(user)
