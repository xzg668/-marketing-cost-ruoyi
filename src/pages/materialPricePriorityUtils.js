const PRICE_TYPES = {
  LINKED: '联动价',
  SETTLE_LINKED: '结算联动价',
  RANGE: '区间价',
  SETTLE_FIXED: '结算固定价',
  FIXED: '固定价',
}

export const priceTypeLabel = type => PRICE_TYPES[type] || type

export function businessPricingMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
  }).formatToParts(date)
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`
}

export function validatePricePriority(order) {
  if (!Array.isArray(order) || order.length !== 5 || new Set(order).size !== 5
      || order.some(type => !Object.hasOwn(PRICE_TYPES, type))) {
    return '请完整排列五种取价类型，不能重复或遗漏'
  }
  return ''
}

export function movePricePriority(order, index, direction) {
  const moved = [...order]
  const target = index + direction
  if (!Number.isInteger(index) || ![-1, 1].includes(direction)
      || index < 0 || index >= moved.length || target < 0 || target >= moved.length) return moved
  const current = moved[index]
  moved[index] = moved[target]
  moved[target] = current
  return moved
}
