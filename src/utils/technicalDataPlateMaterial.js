// Fixed display choices; applicability and source revisions are supplied by the backend.
export const PLATE_MATERIAL_OPTIONS = Object.freeze([
  '水氟SUS304', '水氟316L', '氟氟SUS304', '氟氟316L', '水水SUS304', '水水316L',
])

export function profileDraft(profile) {
  return { ...profile, plateMaterial: profile?.plateMaterial ? { ...profile.plateMaterial } : null }
}

export function validatePlateMaterial(plate) {
  if (!plate?.revision || !['CONFIG_LOCKED', 'MANUAL_REQUIRED', 'HIDDEN'].includes(plate.mode)) {
    return '板片材质判定未取得，请重新读取资料后再保存'
  }
  if (plate.historical) return '当前为已冻结或已提交资料，不能修改'
  if (plate.mode !== 'HIDDEN' && !PLATE_MATERIAL_OPTIONS.includes(plate.value)) {
    return plate.mode === 'MANUAL_REQUIRED' ? '请选择板片材质（必填）' : '自动带出的板片材质无效，请重新读取资料'
  }
  return ''
}

export function technicalProfilePayload(profile) {
  const plate = profile.plateMaterial
  return {
    productProperty: profile.productProperty,
    hasAdditionalFees: profile.hasAdditionalFees,
    unitToolingFee: profile.unitToolingFee,
    unitMouldFee: profile.unitMouldFee,
    unitCertificationFee: profile.unitCertificationFee,
    unitDepreciationFee: profile.unitDepreciationFee,
    expectedVersion: profile.expectedVersion,
    plateMaterial: plate?.mode === 'HIDDEN' ? null : plate?.value,
    expectedPlateMaterialRevision: plate?.revision,
  }
}

/** Refresh source evidence only. Never overwrite the user's unsaved fees/property. */
export function refreshProfilePlateMaterial(draft, latest) {
  if (draft.expectedVersion !== latest?.expectedVersion) {
    throw new Error('产品草稿也已被其他会话修改。当前输入已保留，请通过“刷新资料”核对最新草稿后再保存')
  }
  const plate = latest?.plateMaterial
  if (!plate?.revision || plate.historical) throw new Error('当前资料不可继续编辑，请刷新任务状态；本次输入已保留')
  const refreshed = { ...plate }
  if (plate.mode === 'MANUAL_REQUIRED' && draft.plateMaterial?.mode === 'MANUAL_REQUIRED'
      && PLATE_MATERIAL_OPTIONS.includes(draft.plateMaterial.value)) {
    refreshed.value = draft.plateMaterial.value
  }
  return { ...draft, plateMaterial: refreshed }
}

export function plateMaterialSummary(plate) {
  if (!plate || plate.mode === 'HIDDEN') return ''
  return plate.value ? `板片材质：${plate.value}` : '板片材质待填写'
}
