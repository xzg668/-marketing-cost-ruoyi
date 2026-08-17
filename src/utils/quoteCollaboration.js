export const STARTABLE_COLLABORATION_ACTIONS = new Set([
  'START_BOM_SUPPLEMENT',
  'START_PACKAGE_SUPPLEMENT',
  'START_PRICE_SUPPLEMENT',
  'LINK_EXISTING_TASK',
  'APPLY_APPROVED_RESULT',
])

export const ASSIGN_TECHNICIAN_ACTION = 'ASSIGN_TECHNICIAN'

export function mergeCollaborationSummary(detail, summary) {
  const projections = new Map((summary?.items || []).map((item) => [String(item.itemId), item]))
  return {
    ...(detail || {}),
    collaborationSummaryVersion: summary?.summaryVersion || '',
    items: (detail?.items || []).map((item) => ({
      ...item,
      collaboration: projections.get(String(item.id)) || null,
    })),
  }
}

export function canBatchStartCollaboration(row) {
  return Boolean(row?.id && row?.collaboration?.batchSelectable
    && (STARTABLE_COLLABORATION_ACTIONS.has(row.collaboration.nextAction)
      || row.collaboration.nextAction === ASSIGN_TECHNICIAN_ACTION))
}

export function buildCollaborationBatchStartItems(rows, technicianUserId = null) {
  return (rows || []).filter(canBatchStartCollaboration).map((row) => ({
    itemId: row.id,
    technicianUserId: row.collaboration?.nextAction === ASSIGN_TECHNICIAN_ACTION
      ? technicianUserId
      : undefined,
    expectedProjectionVersion: row.collaboration?.projectionVersion,
  }))
}

export function collaborationTagType(code) {
  const value = String(code || '')
  if (['AVAILABLE', 'READY_FOR_COSTING', 'COMPLETED'].includes(value)) return 'success'
  if (['NO_BOM', 'MISSING_BOM', 'MISSING_PACKAGE', 'MISSING_PRICE', 'RETURNED_TO_TECH', 'TECH_VALIDATION_FAILED'].includes(value)) return 'danger'
  if (['TECHNICIAN_UNASSIGNED', 'WAIT_TECH', 'BOM_IN_PROGRESS', 'PACKAGE_IN_PROGRESS', 'PRICE_IN_PROGRESS', 'TECH_SUBMITTED', 'WAIT_FINANCE', 'REUSABLE'].includes(value)) return 'warning'
  return 'info'
}
