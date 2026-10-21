export { displayFactorPrice as displayPrice } from './financeFactorPublicationUtils.js'

export const scrapFactors = [
  { value: 'AVG|1#CU', label: '铜' },
  { value: 'AVG|美国柜装黄铜', label: '美国柜装黄铜' },
  { value: 'AVG|A00', label: '长江现货 A00（铝）' },
]
export const typeLabel = (type) => ({ FIXED: '固定价', LINKED: '联动价' }[type] || type)
export const calcStatusLabel = (status) => ({ READY: '已就绪', WAITING_BASE: '待基价', ERROR: '计算错误' }[status] || '状态异常')
export const actionLabel = (action) => ({ INSERT: '新增', UPDATE: '更新', UNCHANGED: '未变' }[action] || action)
export const currentPriceMonth = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const importCanConfirm = (preview, file, month, busy) => Boolean(
  !busy && file && preview?.canConfirm && preview.previewFingerprint
  && preview.priceMonth === month && preview.rows?.length && !preview.errors?.length,
)

export const scrapEditForm = (row) => ({
  materialCode: row.materialCode,
  materialName: row.materialName,
  specification: row.specification || '',
  unit: row.unit,
  supplierCode: row.supplierCode || '',
  supplierName: row.supplierName || '',
  priceType: row.priceType,
  fixedPrice: row.fixedPrice ?? '',
  expression: row.expression || '',
  bindings: Object.entries(JSON.parse(row.factorBindingsJson || '{}'))
    .map(([variable, factor]) => ({ variable, factor })),
})

export const scrapEditPayload = (row, form) => {
  const required = (value, label, length) => {
    const text = String(value ?? '').trim()
    if (!text || text.length > length) throw new Error(`${label}必填，最多 ${length} 字`)
    return text
  }
  const optional = (value, label, length) => String(value ?? '').trim()
    ? required(value, label, length) : null
  const rule = {
    materialCode: row.materialCode,
    materialName: required(form.materialName, '名称', 255),
    specification: optional(form.specification, '规格', 512) || '',
    unit: row.unit,
    supplierCode: optional(form.supplierCode, '供应商代码', 64),
    supplierName: optional(form.supplierName, '供应商名称', 255),
    priceType: form.priceType,
    fixedPrice: null,
    sourceFormula: null,
    expression: null,
    factorBindings: {},
  }
  if (form.priceType === 'FIXED') {
    const price = String(form.fixedPrice ?? '').trim()
    if (!/^\d+(\.\d+)?$/.test(price)) throw new Error('请输入不小于 0 的固定金额')
    const [whole, fraction = ''] = price.split('.')
    if (whole.replace(/^0+/, '').length > 20 || fraction.replace(/0+$/, '').length > 18) {
      throw new Error('固定金额最多 20 位整数、18 位小数')
    }
    rule.fixedPrice = price
  } else if (form.priceType === 'LINKED') {
    rule.expression = required(form.expression, '计算公式', 16000).replace(/\s+/g, '')
    rule.sourceFormula = rule.expression === row.expression ? row.sourceFormula : rule.expression
    for (const binding of form.bindings) {
      const variable = required(binding.variable, '变量名称', 64)
      if (Object.hasOwn(rule.factorBindings, variable)) throw new Error(`变量 ${variable} 重复`)
      if (!scrapFactors.some((factor) => factor.value === binding.factor)) throw new Error(`请选择 ${variable} 的商用基价`)
      Object.defineProperty(rule.factorBindings, variable, { value: binding.factor, enumerable: true })
    }
    const used = new Set([...rule.expression.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]))
    const bound = Object.keys(rule.factorBindings)
    if (!used.size || used.size !== bound.length || !bound.every((key) => used.has(key))) {
      throw new Error('公式中的每个变量都需要对应一项商用基价，请核对方括号内的名称')
    }
  } else throw new Error('请选择固定价或联动价')
  return { expectedVersion: row.rowVersion, rule }
}

export const scrapFactorDetails = (row) => {
  if (!row?.calculationJson) return []
  const calculation = JSON.parse(row.calculationJson)
  const factors = calculation.factors?.financial?.factors || {}
  const bindings = JSON.parse(row.factorBindingsJson || '{}')
  return Object.entries(bindings).map(([variable, key]) => ({
    variable,
    name: scrapFactors.find((factor) => factor.value === key)?.label || key,
    // 财务快照的价格是十进制字符串，避免解析计算变量中的浮点数丢失精度。
    price: factors[key]?.price ?? null,
  }))
}
