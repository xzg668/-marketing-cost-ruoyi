import { TECHNICAL_DATA_MODULES, findModule, modulePresentation, unassignedModulePresentation, isCompleteBomCovered } from './technicalDataWorkbench.js'

// BOM is a presentation group. Assignment, ownership and submitted version IDs remain per module.
export const BOM_MODULE_CODES = Object.freeze(['DRAWING_BOM', 'MANUFACTURING'])
export const TECHNICAL_WORKBENCH_COLUMNS = Object.freeze(TECHNICAL_DATA_MODULES
  .filter(module => module.code !== 'MANUFACTURING')
  .map(module => module.code === 'DRAWING_BOM' ? { code: 'BOM', label: 'BOM补录' } : module))
export const isBomModule = code => code === 'BOM' || BOM_MODULE_CODES.includes(code)
export const bomGroup = codes => [...new Set(codes.map(code => isBomModule(code) ? 'BOM' : code))]

export function hasCompleteBom(product) {
  return Boolean(product?.supplementContent?.technicalBom || isCompleteBomCovered(findModule(product, 'MANUFACTURING')))
}

export function bomEntryModule(row, canViewAll = false) {
  const assigned = row.assignedModules || []
  const editable = row.editableModules || []
  return BOM_MODULE_CODES.find(code => editable.includes(code) && findModule(row.product, code)?.required)
    || BOM_MODULE_CODES.find(code => (canViewAll || assigned.includes(code)) && findModule(row.product, code)?.required)
    || BOM_MODULE_CODES.find(code => canViewAll || assigned.includes(code))
    || null
}

export function bomModuleStates(row, canViewAll = false) {
  return BOM_MODULE_CODES.filter(code => code !== 'MANUFACTURING' || !hasCompleteBom(row.product)).map(code => ({ code, module: findModule(row.product, code),
    label: code === 'DRAWING_BOM' ? 'BOM明细' : '图库制造件',
    state: !canViewAll && !(row.assignedModules || []).includes(code)
      ? unassignedModulePresentation(row.product, code)
      : modulePresentation(row.product, code, row.taskStatus),
  }))
}

// Compare node identities as strings; material codes can occur under different parents.
export function manufacturingNodeRows(rows, sourceNodeId) {
  return sourceNodeId == null ? rows : rows.filter(row => String(row.sourceNodeId) === String(sourceNodeId))
}
