export const PRICE_MODES = { REFERENCE: '参考已有公式', MANUAL: '自行填写公式', FIXED: '固定不含税价' }

export function priceDraft(item = {}) {
  return { entryMode: item.entryMode || 'REFERENCE', unitPrice: item.unitPrice ?? '', formula: item.formula || '',
    parameters: { blankWeight: '', netWeight: '', weightUnit: '', processFee: '', agentFee: '', feeUnit: '', ...item.parameters },
    reference: item.reference || null, notes: item.notes || '' }
}

// Switching entry methods must not discard the user's other unfinished method.
export function switchPriceDraft(current, mode, buffers) {
  buffers[current.entryMode] = current
  return buffers[mode] ||= priceDraft({ entryMode: mode })
}

const decimal = value => {
  if (value === '' || value == null) return null
  const text = String(value).trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('金额和参数请填写普通十进制数字')
  return text
}

export function pricePayload(drafts, requirements, expectedVersion, requirementsFingerprint) {
  const items = requirements.filter(row => row.status === 'MISSING').map(row => {
    const value = drafts[row.itemKey] || priceDraft()
    const item = { itemKey: row.itemKey, entryMode: value.entryMode, notes: value.notes.trim() || null }
    if (value.entryMode === 'FIXED') return { ...item, unitPrice: decimal(value.unitPrice) }
    const p = value.parameters
    item.parameters = { blankWeight: decimal(p.blankWeight), netWeight: decimal(p.netWeight),
      weightUnit: p.weightUnit || null, processFee: decimal(p.processFee), agentFee: decimal(p.agentFee), feeUnit: p.feeUnit || null }
    if (value.entryMode === 'REFERENCE') {
      item.referenceId = value.reference?.id ?? null
      item.referenceFingerprint = value.reference?.fingerprint ?? null
    } else if (value.entryMode === 'MANUAL') item.formula = value.formula.trim() || null
    else throw new Error('请选择一种补价方式')
    return item
  })
  return { expectedVersion, requirementsFingerprint, items }
}
