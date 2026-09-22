export const TECHNICAL_DATA_MODULES = Object.freeze([
  { code: 'PROFILE', label: '产品资料' },
  { code: 'DRAWING_BOM', label: '电子图库明细表' },
  { code: 'MANUFACTURING', label: '制造件原材料' },
  { code: 'PACKAGE', label: '包装' },
  { code: 'AUXILIARY', label: '辅料' },
  { code: 'SOLDER', label: '焊料' },
  { code: 'SALARY', label: '工资' },
  { code: 'NET_LOSS', label: '净损失率' },
  { code: 'PRICE', label: '价格' },
])

export const PRODUCT_PROPERTY_OPTIONS = Object.freeze(['标准品', '非标品'])

export function validateTechnicalDataProfile(profile) {
  if (!PRODUCT_PROPERTY_OPTIONS.includes(profile?.productProperty)) return '请选择产品属性'
  if (typeof profile?.hasAdditionalFees !== 'boolean') return '请选择是否含新增工装模具认证费'
  for (const [field, label] of [['unitMouldFee', '模具费'], ['unitToolingFee', '工装费'], ['unitCertificationFee', '认证费']]) {
    const text = String(profile?.[field] ?? '').trim()
    if (text === '/' || (!text && !profile.hasAdditionalFees)) continue
    if (!text) return `${label}请填写单件金额或 /`
    if (!/^[0-9]{1,12}(\.[0-9]{1,6})?$/.test(text) || Number(text) <= 0) {
      return `${label}须为正金额或 /，最多 12 位整数、6 位小数`
    }
  }
  if (!Number.isInteger(profile?.expectedVersion) || profile.expectedVersion < 0) return '当前数据版本无效，请刷新后重试'
  return ''
}

export function findModule(product, moduleType) {
  return product?.modules?.find((module) => module.moduleType === moduleType) || null
}

export function moduleName(code) {
  return TECHNICAL_DATA_MODULES.find(module => module.code === code)?.label || code
}

// 公共来源已满足本项时只展示结论；已填草稿和审批资料仍可进入查看。
export function isTechnicalModuleStatusOnly(product, code) {
  const module = findModule(product, code)
  return module?.moduleStatus === 'NOT_REQUIRED' && module.sourceAvailability === 'AVAILABLE'
}

export function modulePresentation(product, moduleType) {
  const module = findModule(product, moduleType)
  if (!module) return { label: '待检查', type: 'warning' }
  const states = {
    FROZEN: { label: '提交待确认', type: 'warning' },
    SUBMITTED: { label: '审批中', type: 'warning' },
    APPROVED: { label: '已通过', type: 'success' },
    RETURNED: { label: '已退回', type: 'danger' },
  }
  if (states[module.moduleStatus]) return states[module.moduleStatus]
  if (module.sourceAvailability === 'ERROR') return { label: '检查失败', type: 'danger' }
  if (module.sourceAvailability === 'UNCONFIRMED') return { label: '待检查', type: 'warning' }
  if (module.moduleStatus === 'NOT_REQUIRED') return {
    label: module.sourceAvailability === 'AVAILABLE' && module.requirementReasonCode !== 'U9_ORIGINAL_AVAILABLE' ? '已有资料' : '无需补录', type: 'info',
  }
  if (module.moduleStatus === 'READY') return { label: '已填完整', type: 'success' }
  if (module.moduleStatus === 'EDITING') return { label: '草稿', type: 'warning' }
  return { label: '待补录', type: 'warning' }
}

export function technicalModuleSummary(product, code) {
  const module = findModule(product, code)
  if (!module) return '尚未检查本项资料'
  if (module.sourceAvailability === 'ERROR') return module.requirementReason || '查询失败，请核实后重查'
  if (module.sourceAvailability === 'UNCONFIRMED') return module.requirementReason || '资料来源待确认'
  if (!module.required) return ({
    U9_ORIGINAL_AVAILABLE: 'U9 已有 BOM，本次无需补录',
    MANUFACTURING_U9_SOURCE: '沿用已有原材料关系',
    SALARY_SOURCE_AVAILABLE: '沿用 CMS 工资',
    PACKAGE_SOURCE_AVAILABLE: '沿用已有包装',
    NET_LOSS_SOURCE_AVAILABLE: '沿用已有净损失率',
    PRICE_SOURCE_AVAILABLE: '已有可用价格',
  })[module.requirementReasonCode] || '本次无需补录'
  const count = module.itemCount > 0 ? ` ${module.itemCount} 项` : ''
  return ({ PROFILE: '产品属性与单件费用', DRAWING_BOM: '取得有效图库明细',
    MANUFACTURING: `制造件${count} · 原材料、净长、毛重`, PACKAGE: `包装子件${count} · 母子用量`,
    AUXILIARY: `辅料明细${count} · 参考 / 上传`, SOLDER: `焊料${count} · 单件用量`,
    SALARY: '直接人工 / 辅助人员工资', NET_LOSS: '参考产品 / 填写费率', PRICE: `价格${count} · 公式 / 固定价` })[code] || moduleName(code)
}

export function technicalEntryProgress(product, scope) {
  const modules = TECHNICAL_DATA_MODULES.map(({ code }) => findModule(product, code))
    .filter(module => module?.required && scope.includes(module.moduleType))
  const complete = modules.filter(module => ['READY', 'APPROVED', 'SUBMITTED', 'FROZEN'].includes(module.moduleStatus)).length
  return { total: modules.length, complete, remaining: modules.length - complete }
}

// 顺序只来自九模块定义；本人权限和本次实际缺口均由服务端返回。
export function nextTechnicalModule(product, workflow, currentCode = null, scope = workflow?.editableModules || []) {
  const candidates = TECHNICAL_DATA_MODULES.filter(({ code }) => {
    const module = findModule(product, code)
    return module?.required && scope.includes(code)
      && canEditTechnicalModule(workflow, code, module.moduleStatus)
      && ['PENDING', 'EDITING', 'RETURNED'].includes(module.moduleStatus)
  })
  const currentIndex = TECHNICAL_DATA_MODULES.findIndex(module => module.code === currentCode)
  return candidates.find(module => TECHNICAL_DATA_MODULES.indexOf(module) > currentIndex)?.code
    || candidates.find(module => module.code !== currentCode)?.code || null
}

export function taskStatusLabel(status) {
  return ({
    UNASSIGNED: '待分派',
    PENDING: '待处理',
    IN_PROGRESS: '处理中',
    PREPARED: '待发送审批',
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

// 使用服务端当前人员权限，并再次约束已冻结模块的页面操作。
export function canEditTechnicalModule(workflow, moduleType, moduleStatus) {
  return Boolean(workflow?.editableModules?.includes(moduleType)
    && ['PENDING', 'EDITING', 'READY', 'RETURNED'].includes(moduleStatus))
}

// 未分派行只有报价产品身份；不能把它作为技术任务 ID 打开或提交。
export function workbenchRowKey(row) {
  return row.taskId ? `task:${row.taskId}` : `quote:${row.product.oaFormItemId}:${row.accountingMonth}`
}

export function canDispatchWorkbenchRow(row) {
  return Boolean(row && row.taskStatus === 'UNASSIGNED'
    && row.product.modules.some(module => module.required)
    && !row.sourceCheck?.sharedModules?.length)
}

export function firstRequiredTechnicalModule(product) {
  return TECHNICAL_DATA_MODULES.find(({ code }) => findModule(product, code)?.required)?.code || null
}

export function workbenchDispatchRow(row) {
  return { id: row.product.oaFormItemId, oaNo: row.oaNo, materialNo: row.product.materialNo,
    productName: row.product.productName, sunlModel: row.product.sourceModel,
    costingWorkspace: { periodMonth: row.accountingMonth } }
}
