const PRICE_TYPES = {
  LINKED: '联动价',
  SETTLE_LINKED: '结算联动价',
  RANGE: '区间价',
  SETTLE_FIXED: '结算固定价',
  FIXED: '固定价',
}

export const priceTypeLabel = type => ({ ODS_ORDER: '订单价', ODS_TIER: '阶梯价' }[type] || PRICE_TYPES[type] || type)

export function businessPricingMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
  }).formatToParts(date)
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`
}

export const priceTypeOptions = Object.entries(PRICE_TYPES).map(([value, label]) => ({ value, label }))

// Existing storage has five rows; its first manual type now expresses an exclusive finance choice.
export function financePriceOrder(type) {
  if (!Object.hasOwn(PRICE_TYPES, type)) throw new Error('请选择有效的价格类型')
  return [type, ...Object.keys(PRICE_TYPES).filter(value => value !== type)]
}
