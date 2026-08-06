export const POLICY_MODE_FIXED = 'FIXED'
export const POLICY_MODE_SUPPLIER_RATIO = 'SUPPLIER_RATIO'

export const POLICY_MODE_OPTIONS = [
  { value: POLICY_MODE_FIXED, label: '固定报价形态' },
  { value: POLICY_MODE_SUPPLIER_RATIO, label: '特殊物料：按主供应商' },
]

export const MATERIAL_SHAPE_OPTIONS = [
  { value: 'MANUFACTURE', label: '制造件' },
  { value: 'PURCHASE', label: '采购件' },
  { value: 'OUTSOURCE', label: '委外加工件' },
]

export const MATERIAL_ORG_OPTIONS = [
  { value: 'COMMERCIAL', label: '商用制冷（210）' },
  { value: 'PLATE', label: '板换（220）' },
]

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

const text = (value) => String(value ?? '').trim()

const uniqueText = (values) => {
  const result = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = text(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

const parseObject = (value, fieldName) => {
  if (!text(value)) return {}
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch (_error) {
    throw new Error(`${fieldName}不是有效 JSON`)
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${fieldName}必须是 JSON 对象`)
  }
  return parsed
}

export function nextMonthValue(reference = new Date()) {
  const year = reference.getFullYear()
  const month = reference.getMonth() + 1
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  return `${next.year}-${String(next.month).padStart(2, '0')}`
}

export function createEmptyPolicyForm(reference = new Date()) {
  return {
    materialOrgCode: 'COMMERCIAL',
    materialCode: '',
    materialName: '',
    materialSpec: '',
    materialModel: '',
    policyMode: POLICY_MODE_FIXED,
    fixedTargetShape: 'PURCHASE',
    excludedDirectChildMaterialCodes: [],
    effectiveFromMonth: nextMonthValue(reference),
    effectiveToMonth: '',
    enabled: 1,
    remark: '',
  }
}

export function normalizePolicyList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.list)) return response.list
  if (Array.isArray(response?.records)) return response.records
  return []
}

export function normalizeAuditPage(response) {
  const source = response || {}
  const list = Array.isArray(source.records)
    ? source.records
    : (Array.isArray(source.list) ? source.list : [])
  return {
    list,
    total: Number(source.total || list.length || 0),
  }
}

export function buildPolicyQuery(filters = {}) {
  return {
    materialOrgCode: text(filters.materialOrgCode),
    materialCode: text(filters.materialCode),
    materialName: text(filters.materialName),
    materialSpec: text(filters.materialSpec),
    materialModel: text(filters.materialModel),
    policyMode: text(filters.policyMode),
    enabled: filters.enabled === 0 || filters.enabled === 1 ? filters.enabled : undefined,
    effectiveMonth: text(filters.effectiveMonth),
  }
}

export function policyToForm(policy, reference = new Date()) {
  const form = createEmptyPolicyForm(reference)
  if (!policy) return form
  Object.assign(form, {
    materialOrgCode: text(policy.materialOrgCode) || form.materialOrgCode,
    materialCode: text(policy.materialCode),
    materialName: text(policy.materialName),
    materialSpec: text(policy.materialSpec),
    materialModel: text(policy.materialModel),
    policyMode: text(policy.policyMode) || POLICY_MODE_FIXED,
    fixedTargetShape: text(policy.fixedTargetShape),
    effectiveFromMonth: text(policy.effectiveFromMonth),
    effectiveToMonth: text(policy.effectiveToMonth),
    enabled: Number(policy.enabled) === 0 ? 0 : 1,
    remark: text(policy.remark),
  })
  if (form.policyMode === POLICY_MODE_SUPPLIER_RATIO) {
    const action = parseObject(policy.actionConfigJson, '形态动作配置')
    form.fixedTargetShape = ''
    form.excludedDirectChildMaterialCodes = uniqueText(
      action.excludedDirectChildMaterialCodes
    )
  }
  return form
}

export function switchPolicyMode(form, policyMode) {
  const next = { ...form, policyMode }
  if (policyMode === POLICY_MODE_FIXED) {
    next.fixedTargetShape = text(next.fixedTargetShape) || 'PURCHASE'
    next.excludedDirectChildMaterialCodes = []
  } else {
    next.fixedTargetShape = ''
  }
  return next
}

export function validatePolicyForm(form) {
  const errors = []
  if (!text(form.materialOrgCode)) errors.push('请选择料品组织')
  if (!text(form.materialCode)) errors.push('请输入料号')
  if (!POLICY_MODE_OPTIONS.some((item) => item.value === form.policyMode)) {
    errors.push('请选择规则模式')
  }
  const from = text(form.effectiveFromMonth)
  const to = text(form.effectiveToMonth)
  if (!MONTH_PATTERN.test(from)) errors.push('请选择正确的生效开始月')
  if (to && !MONTH_PATTERN.test(to)) errors.push('请选择正确的生效结束月')
  if (MONTH_PATTERN.test(from) && MONTH_PATTERN.test(to) && to < from) {
    errors.push('生效结束月不能早于开始月')
  }
  if (form.policyMode === POLICY_MODE_FIXED) {
    if (!MATERIAL_SHAPE_OPTIONS.some((item) => item.value === form.fixedTargetShape)) {
      errors.push('请选择固定目标形态')
    }
  }
  if (form.policyMode === POLICY_MODE_SUPPLIER_RATIO) {
    if ((form.excludedDirectChildMaterialCodes || []).some((code) => !text(code))) {
      errors.push('排除直接子件料号不能为空')
    }
  }
  return errors
}

export function buildPolicyRequest(form) {
  const errors = validatePolicyForm(form)
  if (errors.length) throw new Error(errors[0])
  const excludedCodes = uniqueText(form.excludedDirectChildMaterialCodes)
  const fixed = form.policyMode === POLICY_MODE_FIXED
  return {
    materialOrgCode: text(form.materialOrgCode),
    materialCode: text(form.materialCode),
    materialName: text(form.materialName) || null,
    materialSpec: text(form.materialSpec) || null,
    materialModel: text(form.materialModel) || null,
    policyMode: form.policyMode,
    fixedTargetShape: fixed ? text(form.fixedTargetShape) : null,
    conditionConfigJson: null,
    actionConfigJson: fixed || !excludedCodes.length
      ? null
      : JSON.stringify({ excludedDirectChildMaterialCodes: excludedCodes }),
    effectiveFromMonth: text(form.effectiveFromMonth),
    effectiveToMonth: text(form.effectiveToMonth) || null,
    enabled: Number(form.enabled) === 0 ? 0 : 1,
    remark: text(form.remark) || null,
  }
}

export function quoteShapeFromSupplyRelationship(value) {
  const normalized = text(value).toUpperCase()
  if (['MANUFACTURE', 'MANUFACTURED', '制造', '制造件', '自制', '自制件', '内部', '内部供应商'].includes(normalized)) {
    return 'MANUFACTURE'
  }
  if (['PURCHASE', 'PURCHASED', '采购', '采购件', 'OUTSOURCE', 'OUTSOURCED', '委外', '委外件', '委外加工', '委外加工件', '外部', '外部供应商'].includes(normalized)) {
    return 'OUTSOURCE'
  }
  return ''
}

export function simulateSupplierRatioPolicy(form, candidates = []) {
  if (form.policyMode !== POLICY_MODE_SUPPLIER_RATIO) {
    return {
      status: 'NOT_APPLICABLE',
      message: '固定形态规则不需要供应商比例模拟',
      targetShape: text(form.fixedTargetShape),
    }
  }
  const validationErrors = validatePolicyForm(form)
  if (validationErrors.length) {
    return { status: 'INVALID_CONFIG', message: validationErrors[0] }
  }
  const normalized = (Array.isArray(candidates) ? candidates : [])
    .map((item) => ({
      supplierCode: text(item?.supplierCode),
      supplierName: text(item?.supplierName),
      materialShape: text(item?.materialShape),
      supplyRatio: Number(item?.supplyRatio),
    }))
    .filter((item) => item.supplierCode || item.supplierName)
  const counts = new Map()
  normalized.forEach((item) => {
    const key = item.supplierCode || item.supplierName
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code)
  if (duplicates.length) {
    return {
      status: 'BLOCKED_DUPLICATE_SUPPLIER',
      message: `同一月份存在重复供应商比例：${duplicates.join('、')}`,
    }
  }
  const valid = normalized.filter(
    (item) => Number.isFinite(item.supplyRatio) && item.supplyRatio > 0
  )
  if (!valid.length) {
    return {
      status: 'BLOCKED_NO_RATIO',
      message: '没有有效的正数供货比例，报价时将被阻断',
    }
  }
  const maxRatio = Math.max(...valid.map((item) => item.supplyRatio))
  const winners = valid.filter((item) => item.supplyRatio === maxRatio)
  if (winners.length > 1) {
    return {
      status: 'BLOCKED_TIED_MAX',
      message: `最大供货比例并列：${winners.map((item) => item.supplierCode).join('、')}`,
      maxRatio,
    }
  }
  const winner = winners[0]
  const targetShape = quoteShapeFromSupplyRelationship(winner.materialShape)
  if (!targetShape) {
    return {
      status: 'BLOCKED_INVALID_RELATIONSHIP_SHAPE',
      message: `主供应商供货关系缺少有效形态属性：${winner.materialShape || '空'}`,
    }
  }
  const internal = targetShape === 'MANUFACTURE'
  return {
    status: 'RESOLVED',
    message: `主供应商 ${winner.supplierName || winner.supplierCode}，供货关系为${internal ? '内部' : '外部'}`,
    supplierCode: winner.supplierCode,
    supplierName: winner.supplierName,
    maxRatio,
    internalSupplier: internal,
    targetShape,
    excludedDirectChildMaterialCodes:
      targetShape === 'OUTSOURCE'
        ? uniqueText(form.excludedDirectChildMaterialCodes)
        : [],
  }
}

export const optionLabel = (options, value) =>
  options.find((item) => item.value === value)?.label || text(value) || '-'

export const policyTargetSummary = (policy) => {
  if (policy?.policyMode === POLICY_MODE_FIXED) {
    if (policy.fixedTargetShape === 'VIRTUAL') return '虚拟件（历史配置）'
    return optionLabel(MATERIAL_SHAPE_OPTIONS, policy.fixedTargetShape)
  }
  return '内部主供→制造件；外部主供→委外件并排除配置子件'
}
