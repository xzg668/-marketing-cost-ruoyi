export const auxiliaryAmountText = value => value == null ? '' : typeof value === 'number'
  ? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 8 }) : String(value)

export const emptyAuxiliary = () => ({ reference: null, upload: null, items: [] })

export function auxiliaryFromCms(source) {
  return { reference: source, upload: null, items: source.items.map(item => ({
    itemKey: `CMS:${item.sourceId}`, name: item.subjectName, sourceAmount: item.sourceAmount,
    amount: auxiliaryAmountText(item.sourceAmount), source: { cms: { materialNo: source.materialNo, name: source.name, model: source.model, fingerprint: source.fingerprint, item } },
  })) }
}

export function auxiliaryFromUpload(upload) {
  return { reference: null, upload, items: upload.items.map(item => ({
    itemKey: item.itemKey, name: item.name, sourceAmount: item.amountPerProduct,
    amount: auxiliaryAmountText(item.amountPerProduct), source: { upload: { fileName: upload.fileName, fileSha256: upload.fileSha256, sheetName: upload.sheetName, item } },
  })) }
}

export function auxiliaryPayload(mode, form, expectedVersion) {
  if (!form.items.length) throw new Error('请选择参考成品或上传完整辅料表')
  const items = form.items.map(row => {
    const value = String(row.amount ?? '').trim()
    if (value && !/^\d{1,12}(\.\d{1,8})?$/.test(value)) throw new Error(`${row.name}：本次金额须大于等于 0，最多 12 位整数和 8 位小数`)
    return { itemKey: row.itemKey, amount: value || null }
  })
  return { expectedVersion, entryMode: mode, items,
    ...(mode === 'REFERENCE' ? { referenceMaterialNo: form.reference?.materialNo, referenceFingerprint: form.reference?.fingerprint }
      : { fileSha256: form.upload?.fileSha256 }) }
}

export function auxiliaryTotal(items) {
  if (!items.length) return '—'
  let total = 0n
  for (const row of items) {
    const value = String(row.amount ?? '').trim()
    if (!/^\d{1,12}(\.\d{1,8})?$/.test(value)) return '待填完整'
    const [integer, fraction = ''] = value.split('.')
    total += BigInt(integer) * 100000000n + BigInt(fraction.padEnd(8, '0'))
  }
  return `${total / 100000000n}.${String(total % 100000000n).padStart(8, '0')}`.replace(/\.?0+$/, '')
}
