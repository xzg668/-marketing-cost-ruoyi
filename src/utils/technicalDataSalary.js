export const salaryAmountText = value => value == null ? '—' : String(value)

export function salaryReferencePayload(reference, expectedVersion) {
  if (!reference || reference.issues?.length || !reference.direct || !reference.indirect) {
    throw new Error('请选择同时具有直接人工和辅助人员工资的参考成品')
  }
  return { entryMode: 'REFERENCE', expectedVersion, referenceMaterialNo: reference.materialNo,
    referenceFingerprint: reference.fingerprint }
}

export function salaryUploadPayload(upload, reference, expectedVersion) {
  if (!upload?.fileSha256 || upload.issues?.length || !upload.items?.length || upload.amountYuan == null) {
    throw new Error('请上传校验通过的工时表')
  }
  if (!reference?.indirect || reference.direct || reference.issues?.length) {
    throw new Error('请选择有效的辅助人员工资参考')
  }
  return { entryMode: 'UPLOAD', expectedVersion, fileSha256: upload.fileSha256,
    referenceMaterialNo: reference.materialNo, referenceFingerprint: reference.fingerprint }
}

export function salaryTotal(direct, indirect) {
  if (direct == null || indirect == null) return '—'
  const fixed = value => {
    const [integer, fraction = ''] = String(value).split('.')
    if (!/^\d+$/.test(integer) || !/^\d{0,8}$/.test(fraction)) return null
    return BigInt(integer) * 100000000n + BigInt(fraction.padEnd(8, '0'))
  }
  const a = fixed(direct), b = fixed(indirect)
  if (a == null || b == null) return '—'
  const total = a + b
  const fraction = String(total % 100000000n).padStart(8, '0').replace(/0+$/, '').padEnd(6, '0')
  return `${total / 100000000n}.${fraction}`
}
