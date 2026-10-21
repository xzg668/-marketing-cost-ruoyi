// Match the backend's boundary-space rule; do not alter case, internal spaces or suffixes.
export function mappingPayload(form, record, options) {
  const model = String(form.model ?? '').replace(/^ +| +$/g, '')
  if (!model || [...model].length > 255) throw new Error('请输入 1～255 个字符的完整型号')
  if (!options.includes(form.plateMaterial)) throw new Error('请选择板片材质')
  return {
    model,
    plateMaterial: form.plateMaterial,
    ...(record ? { expectedVersion: record.rowVersion } : {}),
  }
}

export function canConfirmMappingImport(preview, file, previewedFile, busy) {
  return Boolean(!busy && file && file === previewedFile && preview?.canConfirm &&
    preview.fingerprint && preview.changes?.length && preview.errors?.length === 0)
}

export const mappingActionLabel = (action) => ({ INSERT: '新增', UPDATE: '更新', UNCHANGED: '未变' })[action] || action
