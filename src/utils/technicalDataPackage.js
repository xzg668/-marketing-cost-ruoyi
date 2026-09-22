// 两种填写方式各自保存页面输入；只把当前方式交给后端。
export const emptyPackage = () => ({ parentQuantity: '', source: null, items: [] })

export function packageRow(source = {}) {
  const evidence = source.evidence
  return {
    componentMaterialNo: source.componentMaterialNo || '',
    componentName: source.componentName || '',
    componentModel: source.componentModel || '',
    componentSpec: source.componentSpec || '',
    quantity: source.quantity == null ? '' : String(source.quantity),
    unit: source.unit || '', remark: source.remark || '',
    sourceParentNodeId: evidence?.parentNodeId ?? null,
    sourceNodeId: evidence?.sourceNodeId ?? null,
    sourceFingerprint: evidence?.sourceFingerprint ?? null,
  }
}

export function packageSourceRow(source, child) {
  return packageRow({ componentMaterialNo: child.materialNo, componentName: child.name,
    componentModel: child.model, componentSpec: child.specification, quantity: child.quantity, unit: child.unit,
    evidence: { parentNodeId: source.parentNodeId, sourceNodeId: child.sourceNodeId, sourceFingerprint: source.fingerprint } })
}

export function packagePayload(mode, form, expectedVersion) {
  return {
    expectedVersion, entryMode: mode, parentQuantity: form.parentQuantity === '' ? null : form.parentQuantity,
    referenceParentNodeId: mode === 'REFERENCE' ? form.source?.parentNodeId ?? null : null,
    referenceFingerprint: mode === 'REFERENCE' ? form.source?.fingerprint ?? null : null,
    items: form.items.map(row => ({
      sourceParentNodeId: row.sourceParentNodeId, sourceNodeId: row.sourceNodeId, sourceFingerprint: row.sourceFingerprint,
      componentModel: row.componentModel, componentName: row.componentName, componentSpec: row.componentSpec,
      quantity: row.quantity === '' ? null : row.quantity, unit: row.unit, remark: row.remark,
    })),
  }
}
