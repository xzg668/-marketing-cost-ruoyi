export { netLossPercent } from './netLossRate.js'

export function netLossPayload(mode, reference, percent, expectedVersion) {
  if (mode === 'REFERENCE') {
    const rate = Number(reference?.source?.rate)
    if (reference?.source?.status !== 'AVAILABLE' || !Number.isFinite(rate) || rate <= 0 || rate >= 1 || !reference.fingerprint) {
      throw new Error('请选择有净损失率的参考成品')
    }
    return { expectedVersion, entryMode: mode, referenceMaterialNo: reference.source.materialNo,
      referenceFingerprint: reference.fingerprint }
  }
  if (mode !== 'MANUAL') throw new Error('请选择参考或直接填写')
  const value = String(percent ?? '').trim()
  if (value && !/^[0-9]{1,2}(\.[0-9]{1,3})?$/.test(value)) throw new Error('请输入 0 至 100（不含）的百分数，最多三位小数')
  return { expectedVersion, entryMode: mode, percent: value || null }
}
