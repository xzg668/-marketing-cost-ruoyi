/** 跨报价、电子图库和协作页面共用的业务状态标签颜色。 */
export function workflowStatusTagType(code) {
  const value = String(code || '')
  if (['AVAILABLE', 'READY_FOR_COSTING', 'COMPLETED', 'E_DRAWING_READY', 'E_DRAWING_COMPOSED'].includes(value)) return 'success'
  if (['NO_BOM', 'MISSING_BOM', 'MISSING_PACKAGE', 'MISSING_PRICE', 'RETURNED_TO_TECH', 'TECH_VALIDATION_FAILED', 'E_DRAWING_NOT_FOUND'].includes(value)) return 'danger'
  if (['MISSING_TECH_DATA', 'TECHNICIAN_UNASSIGNED', 'WAIT_TECH', 'BOM_IN_PROGRESS', 'PACKAGE_IN_PROGRESS', 'PRICE_IN_PROGRESS', 'TECH_SUBMITTED', 'WAIT_FINANCE', 'REUSABLE', 'MAPPING_PENDING', 'E_DRAWING_RETRY', 'VALIDATION_FAILED'].includes(value)) return 'warning'
  return 'info'
}
