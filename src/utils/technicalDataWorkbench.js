export const TECHNICAL_DATA_COLUMNS = Object.freeze([
  '选择',
  '层级',
  '产品料号',
  '产品名称',
  '产品型号',
  '产品规格',
  '产品属性',
  '关联报价单',
  '新品',
  '包装组件',
  '辅料信息',
  '工资信息',
])

export const PRODUCT_PROPERTY_OPTIONS = Object.freeze(['标准品', '非标品'])
export const NEW_PRODUCT_OPTIONS = Object.freeze([
  { label: '是', value: true },
  { label: '否', value: false },
])

export const PACKAGE_UNIT_OPTIONS = Object.freeze(['只', '套', '片', '张', '个', '箱', '米', 'kg'])
export const PACKAGE_PRICE_BASIS_OPTIONS = Object.freeze([
  { label: '历史价格', value: 'HISTORICAL_PRICE' },
  { label: '供应商报价', value: 'SUPPLIER_QUOTE' },
  { label: '待询价', value: 'PENDING_INQUIRY' },
])

export const AUXILIARY_PRICING_METHOD_OPTIONS = Object.freeze([
  { label: '按用量计价', value: 'UNIT_PRICE' },
  { label: '固定每件', value: 'FIXED_AMOUNT' },
])
export const AUXILIARY_UNIT_OPTIONS = Object.freeze(['kg', 'g', '件'])
export const AUXILIARY_PRICE_UNIT_OPTIONS = Object.freeze(['元/kg', '元/g', '元/件'])

export const SALARY_LABOR_TYPE_OPTIONS = Object.freeze([
  { label: '直接人工', value: 'DIRECT' },
  { label: '间接人工', value: 'INDIRECT' },
])
export const SALARY_TIME_UNIT_OPTIONS = Object.freeze(['小时/件', '分钟/件'])
export const SALARY_RATE_UNIT_OPTIONS = Object.freeze(['元/小时', '元/分钟'])

const AUXILIARY_COMPATIBLE_UNITS = new Set([
  'kg|元/kg', 'g|元/kg', 'g|元/g', 'kg|元/g', '件|元/件',
])

export function validateTechnicalDataProfile(profile) {
  if (!String(profile?.productModel || '').trim()) return '产品型号不能为空'
  if (!PRODUCT_PROPERTY_OPTIONS.includes(profile?.productProperty)) {
    return '产品属性只能为标准品或非标品'
  }
  if (typeof profile?.newProduct !== 'boolean') return '新品只能为是或否'
  if (!Number.isInteger(profile?.expectedVersion) || profile.expectedVersion < 0) {
    return '当前数据版本无效，请刷新后重试'
  }
  return ''
}

export function findModule(product, moduleType) {
  return product?.modules?.find((module) => module.moduleType === moduleType) || null
}

export function modulePresentation(product, moduleType) {
  const module = findModule(product, moduleType)
  if (!module || module.moduleStatus === 'PENDING') {
    return { label: '待补充', type: 'warning' }
  }
  if (module.moduleStatus === 'NOT_REQUIRED') {
    return { label: '无需补充', type: 'info' }
  }
  if (module.entryMode === 'REFERENCE') {
    return { label: `已参照 ${Number(module.itemCount || 0)}项`, type: 'success' }
  }
  if (['READY', 'EDITING', 'RETURNED'].includes(module.moduleStatus)) {
    return {
      label: `已录入 ${Number(module.itemCount || 0)}项`,
      type: module.moduleStatus === 'RETURNED' ? 'danger' : 'success',
    }
  }
  if (['SUBMITTED', 'APPROVED'].includes(module.moduleStatus)) {
    return { label: module.moduleStatus === 'APPROVED' ? '已通过' : '已提交', type: 'success' }
  }
  return { label: module.moduleStatus, type: 'info' }
}

export function validatePackageRows(rows) {
  const values = (rows || []).filter((row) => Object.values(row || {}).some((value) => String(value ?? '').trim()))
  if (!values.length) return '请至少录入一条包装明细'
  const materialNos = new Set()
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index]
    const line = index + 1
    if (!String(row.componentMaterialNo || '').trim()) return `第${line}行包装组件料号不能为空`
    if (!String(row.componentName || '').trim()) return `第${line}行名称不能为空`
    if (!(Number(row.quantity) > 0)) return `第${line}行用量必须大于0`
    if (!PACKAGE_UNIT_OPTIONS.includes(row.unit)) return `第${line}行单位无效`
    if (!PACKAGE_PRICE_BASIS_OPTIONS.some((option) => option.value === row.priceBasisType)) {
      return `第${line}行价格依据无效`
    }
    const key = String(row.componentMaterialNo).trim().toUpperCase()
    if (materialNos.has(key)) return `包装组件料号重复：${String(row.componentMaterialNo).trim()}`
    materialNos.add(key)
  }
  return ''
}

export function validateAuxiliaryRows(rows) {
  const values = (rows || []).filter((row) => Object.values(row || {})
    .some((value) => String(value ?? '').trim()))
  if (!values.length) return '请至少录入一条辅料明细'
  const materialNos = new Set()
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index]
    const line = index + 1
    if (!String(row.subjectCode || '').trim()) return `第${line}行辅料科目不能为空`
    if (!String(row.auxiliaryMaterialNo || '').trim()) return `第${line}行辅料料号不能为空`
    if (!String(row.auxiliaryName || '').trim()) return `第${line}行辅料名称不能为空`
    if (!AUXILIARY_PRICING_METHOD_OPTIONS.some((option) => option.value === row.pricingMethod)) {
      return `第${line}行计价方式无效`
    }
    if (!(Number(row.quantity) > 0)) return `第${line}行用量必须大于0`
    if (!(Number(row.referenceUnitPrice) > 0)) return `第${line}行参考单价必须大于0`
    if (!AUXILIARY_COMPATIBLE_UNITS.has(`${row.unit}|${row.priceUnit}`)) {
      return `第${line}行用量单位与计价单位不兼容`
    }
    if (Number(row.lossRate || 0) < 0 || Number(row.lossRate || 0) > 1) {
      return `第${line}行损耗率必须在0到1之间`
    }
    const key = String(row.auxiliaryMaterialNo).trim().toUpperCase()
    if (materialNos.has(key)) return `辅料料号重复：${String(row.auxiliaryMaterialNo).trim()}`
    materialNos.add(key)
  }
  return ''
}

export function validateSalaryRows(rows) {
  const values = (rows || []).filter((row) => Object.values(row || {})
    .some((value) => String(value ?? '').trim()))
  if (!values.length) return '请至少录入一条工资明细'
  const processKeys = new Set()
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index]
    const line = index + 1
    if (!String(row.processCode || '').trim()) return `第${line}行工序编码不能为空`
    if (!String(row.processName || '').trim()) return `第${line}行工序名称不能为空`
    if (!SALARY_LABOR_TYPE_OPTIONS.some((option) => option.value === row.laborType)) {
      return `第${line}行人工类型无效`
    }
    if (!(Number(row.workingHours) > 0)) return `第${line}行标准工时必须大于0`
    if (!SALARY_TIME_UNIT_OPTIONS.includes(row.timeUnit)) return `第${line}行工时单位无效`
    if (!(Number(row.wageRate) > 0)) return `第${line}行工资率必须大于0`
    if (!SALARY_RATE_UNIT_OPTIONS.includes(row.rateUnit)) return `第${line}行计价单位无效`
    if (!(Number(row.personCoefficient) > 0)) return `第${line}行人数/系数必须大于0`
    const key = `${String(row.processCode).trim().toUpperCase()}|${row.laborType}`
    if (processKeys.has(key)) return `工序和人工类型重复：${String(row.processCode).trim()}`
    processKeys.add(key)
  }
  return ''
}

export function taskStatusLabel(status) {
  return ({
    PENDING: '待处理',
    IN_PROGRESS: '处理中',
    SUBMITTED: '已提交',
    PARTIALLY_RETURNED: '部分退回',
    APPROVED: '已通过',
    CANCELLED: '已作废',
  })[status] || status || '-'
}

export function taskStatusType(status) {
  if (status === 'APPROVED') return 'success'
  if (status === 'PARTIALLY_RETURNED') return 'danger'
  if (status === 'CANCELLED') return 'info'
  if (status === 'IN_PROGRESS') return 'primary'
  return 'warning'
}
