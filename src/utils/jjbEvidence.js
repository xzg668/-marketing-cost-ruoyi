// A clicked row is more specific than the parent part shared by explanation rows.
export function selectEvidenceRow(rows, trace) {
  if (!trace) return rows[0]
  if (trace.rowKey) return rows.find(row => row.key === trace.rowKey)
  return rows.find(row => trace.partItemId && row.partItemIds?.includes(trace.partItemId))
    || rows.find(row => trace.costItemId && row.costItemIds?.includes(trace.costItemId))
    || rows.find(row => trace.costCode && row.code === trace.costCode)
}

export function selectAmountComposition(row, costRunNo) {
  if (!costRunNo || !row) return null
  if (['OTHER_EXP_PACKAGE','BOM_BUCKET_PACKAGE'].includes(row.code)) {
    const id = /^COST:(\d+)$/.exec(row.key || '')?.[1]
    if (id && row.costItemIds?.some(value => String(value) === id)) return { costItemId: id }
    return row.costItemIds?.length === 1 ? { costItemId: row.costItemIds[0] } : null
  }
  if ((row.code?.startsWith('AUX_') || ['DIRECT_LABOR','INDIRECT_LABOR','OVERHAUL','TOOLING_REPAIR','WATER_POWER','DEPT_OTHER'].includes(row.code)) && row.costItemIds?.length === 1)
    return { costItemId: row.costItemIds[0] }
  if (['PART','HOUSEHOLD'].includes(row.kind) && row.partItemIds?.length === 1) return { partItemId: row.partItemIds[0] }
  return null
}
