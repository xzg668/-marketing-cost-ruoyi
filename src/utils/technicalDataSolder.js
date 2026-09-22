export const emptySolder = () => ({ reference: null, items: [] })

export function solderQuantityText(value) {
  if (value == null || value === '') return ''
  return typeof value === 'number' ? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 11 }) : String(value)
}

export function solderRow(item = {}) {
  const material = item.evidence?.material
  return { uiId: crypto.randomUUID(), itemKey: item.itemKey ?? null, materialNo: item.materialNo || '',
    name: item.name || '', drawingNo: item.drawingNo || '', quantityPerProduct: solderQuantityText(item.quantityPerProduct),
    evidence: item.evidence ?? null, materialFingerprint: material?.fingerprint ?? null,
    lookupStatus: material ? (material.drawingNo ? 'FOUND' : 'NO_DRAWING') : 'EMPTY',
    lookupMessage: material ? (material.drawingNo ? '料品档案自动带出' : '料品档案未维护图号') : '输入料号后自动带出' }
}

export function solderPayload(mode, form, expectedVersion) {
  if (!['REFERENCE', 'MANUAL'].includes(mode)) throw new Error('请选择焊料录入方式')
  if (mode === 'REFERENCE' && !form.reference?.fingerprint) throw new Error('请选择参考成品')
  if (form.items.length > 500) throw new Error('焊料明细最多 500 行')
  const seen = new Set()
  const items = form.items.map((row, index) => {
    const quantity = String(row.quantityPerProduct).trim()
    if (quantity && (!/^\d{1,12}(\.\d{1,11})?$/.test(quantity) || !/[1-9]/.test(quantity))) {
      throw new Error(`第 ${index + 1} 行用量须大于 0，整数不超过 12 位、小数不超过 11 位`)
    }
    if (mode === 'REFERENCE') {
      if (!row.itemKey || seen.has(row.itemKey)) throw new Error('参考焊料来源行无效或重复，请重新查询')
      seen.add(row.itemKey)
      return { itemKey: row.itemKey, quantityPerProduct: quantity || null }
    }
    if (!row.materialNo.trim() || !['FOUND', 'NO_DRAWING'].includes(row.lookupStatus) || !row.materialFingerprint) {
      throw new Error(`第 ${index + 1} 行：${row.lookupMessage || '请先查询有效焊料档案'}`)
    }
    const key = row.materialNo.trim().toUpperCase()
    if (seen.has(key)) throw new Error('焊料料号重复，请合并用量')
    seen.add(key)
    return { materialNo: row.materialNo.trim(), materialFingerprint: row.materialFingerprint, quantityPerProduct: quantity || null }
  })
  return { expectedVersion, entryMode: mode,
    ...(mode === 'REFERENCE' ? { referenceMaterialNo: form.reference.materialNo, referenceFingerprint: form.reference.fingerprint } : {}), items }
}
