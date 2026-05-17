export function displayCmsSource(source) {
  const value = String(source || '').trim()
  if (!value) return '手工'
  if (value === 'CMS') return 'CMS'
  if (value === 'MANUAL') return '手工'
  return value
}

export function cmsSourceTagType(source) {
  return String(source || '').trim() === 'CMS' ? 'success' : 'info'
}

export function displayCmsLockStatus(lockStatus, source) {
  const value = String(lockStatus || '').trim()
  if (value === 'LOCKED') return '首月锁定'
  if (value === 'SKIPPED') return '已跳过'
  if (value === 'BLOCKED') return '已阻断'
  if (value === 'UNLOCKED') return '未锁定'
  return String(source || '').trim() === 'CMS' ? '首月锁定' : '未锁定'
}

export function cmsLockStatusTagType(lockStatus, source) {
  const text = displayCmsLockStatus(lockStatus, source)
  if (text === '首月锁定') return 'warning'
  if (text === '已阻断') return 'danger'
  if (text === '已跳过') return 'info'
  return 'info'
}

export function displayCmsAmountCalcMode(amountCalcMode, source) {
  const value = String(amountCalcMode || '').trim()
  if (value === 'DIRECT') return '直接金额'
  if (value === 'RATE') return '上浮率'
  if (value === 'UNIT_PRICE') return '单价'
  return String(source || '').trim() === 'CMS' ? '直接金额' : '上浮率'
}

export function cmsAmountCalcModeTagType(amountCalcMode, source) {
  return displayCmsAmountCalcMode(amountCalcMode, source) === '直接金额'
    ? 'success'
    : 'info'
}

export function displayNullable(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}
