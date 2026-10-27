export const priceUnitLabel = (unit) => ({
  'CNY/KG': '元/公斤',
  'CNY/TON': '元/吨',
  'CNY/G': '元/克',
}[unit] || unit)

export function financePreviousMonthExport(scope) {
  if (!['210', '220'].includes(scope?.priceOrgCode)) throw new Error('请选择商用或板换')
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(scope?.priceMonth || '')) throw new Error('请选择有效月份')
  let [year, month] = scope.priceMonth.split('-').map(Number)
  if (--month === 0) { year--; month = 12 }
  if (year < 1) throw new Error('请选择有效月份')
  const sourceMonth = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  const organization = scope.priceOrgCode === '210' ? '商用' : '板换'
  return { priceMonth: scope.priceMonth, priceOrgCode: scope.priceOrgCode, sourceMonth,
    filename: `${organization}财务基价_${sourceMonth}_用于${scope.priceMonth}.xlsx` }
}

export const factorPricePerTon = (factor) => {
  if (!factor || factor.price == null) return ''
  const value = String(factor.price)
  if (factor.unit === 'CNY/TON') return value
  if (factor.unit !== 'CNY/KG' || !/^\d+(\.\d+)?$/.test(value)) return ''
  // 展示及编辑预填按十进制移动小数点，不让JavaScript浮点改变财务输入精度。
  const [whole, fractional = ''] = value.split('.')
  const padded = fractional.padEnd(3, '0')
  const integer = `${whole}${padded.slice(0, 3)}`.replace(/^0+(?=\d)/, '')
  const remainder = padded.slice(3).replace(/0+$/, '')
  return remainder ? `${integer}.${remainder}` : integer
}

export const validateCopperAdjustment = ({ pricePerTon, changeReason }) => {
  const value = String(pricePerTon ?? '').trim()
  if (!/^\d+(\.\d+)?$/.test(value) || !/[1-9]/.test(value)) return '请输入大于0的Cu基价（元/吨）'
  if (!String(changeReason || '').trim()) return '请填写调整原因'
  if (String(changeReason).trim().length > 512) return '调整原因不能超过512字'
  return ''
}

export const publicationCanConfirm = (preview, file, busy) =>
  Boolean(file && preview?.previewFingerprint && !busy && preview.workbook?.values?.length
    && !preview.workbook?.problems?.length)

export const displayFactorPrice = (price) => {
  if (price == null) return "—"
  return String(price).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}
