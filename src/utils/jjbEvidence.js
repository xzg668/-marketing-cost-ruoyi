// A clicked row is more specific than the parent part shared by explanation rows.
export function selectEvidenceRow(rows, trace) {
  if (!trace) return rows[0]
  if (trace.rowKey) return rows.find(row => row.key === trace.rowKey)
  return rows.find(row => trace.partItemId && row.partItemIds?.includes(trace.partItemId))
    || rows.find(row => trace.costItemId && row.costItemIds?.includes(trace.costItemId))
    || rows.find(row => trace.costCode && row.code === trace.costCode)
}
