export const RANGE_FACTOR_OPTIONS = [
  { code: 'CU', label: '铜价区间', factorName: '电解铜', factorUnit: '元/吨' },
  { code: 'ZN', label: '锌价区间', factorName: '电解锌', factorUnit: '元/吨' },
  { code: 'AL', label: '铝价区间', factorName: '电解铝', factorUnit: '元/吨' },
  { code: 'GOLD', label: '黄金区间', factorName: '黄金', factorUnit: '元/克' },
  { code: 'SILVER', label: '白银区间', factorName: '白银', factorUnit: '元/千克' },
  { code: 'SUS304', label: '不锈钢304区间', factorName: '不锈钢304', factorUnit: '元/吨' },
  { code: 'SUS316L', label: '不锈钢316L区间', factorName: '不锈钢316L', factorUnit: '元/吨' },
]

export const RANGE_IMPORT_TYPE_OPTIONS = [
  ...RANGE_FACTOR_OPTIONS.map((option) => ({ ...option, rangeBasis: 'FACTOR' })),
  { code: 'QTY', label: '数量区间', rangeBasis: 'QTY' },
]

const FACTOR_ALIASES = [
  { code: 'CU', aliases: ['区间铜价', '铜价区间', '电解铜', '铜价'] },
  { code: 'ZN', aliases: ['区间锌价', '锌价区间', '电解锌', '锌价'] },
  { code: 'AL', aliases: ['区间铝价', '铝价区间', '电解铝', '铝价'] },
  { code: 'GOLD', aliases: ['镀金区间价', '黄金区间', '黄金价', '金价'] },
  { code: 'SILVER', aliases: ['白银区间价', '白银区间', '白银价', '银价'] },
  { code: 'SUS304', aliases: ['sus304', '不锈钢304', '304不锈钢'] },
  { code: 'SUS316L', aliases: ['sus316l', '不锈钢316l', '316l不锈钢'] },
]

export const normalizeRangeText = (value) =>
  String(value ?? '').replace(/[\s\u3000_\-—~～]+/g, '').toLowerCase()

export const findRangeFactorOption = (code) => {
  const normalized = String(code ?? '').trim().toUpperCase()
  return RANGE_FACTOR_OPTIONS.find((option) => option.code === normalized) || null
}

export const detectRangeFactorBySheetName = (sheetName) => {
  const normalized = normalizeRangeText(sheetName)
  if (!normalized) return null
  const matched = FACTOR_ALIASES.find((item) =>
    item.aliases.some((alias) => normalized.includes(normalizeRangeText(alias)))
  )
  return matched ? findRangeFactorOption(matched.code) : null
}

export const isQuantityRangeSheetName = (sheetName) => {
  const normalized = normalizeRangeText(sheetName)
  return normalized.includes(normalizeRangeText('数量区间'))
}

export const formatRangeType = (row) => {
  const basis = String(row?.rangeBasis ?? '').trim().toUpperCase()
  if (basis === 'FACTOR') {
    return findRangeFactorOption(row?.factorCode)?.label || '行情区间'
  }
  return '数量区间'
}

export const formatCurrentStatus = (row) => (
  Number(row?.currentFlag ?? 1) === 0 ? '历史' : '当前'
)

export const buildRangeImportBatchNo = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())
  return `RANGE${year}${month}${day}${hour}${minute}${second}`
}

export const buildRangeImportPayload = (rows, options = {}) => {
  const factor = options.factor ? findRangeFactorOption(options.factor.code || options.factor) : null
  const rangeBasis = factor ? 'FACTOR' : 'QTY'
  const importRows = Array.isArray(rows) ? rows : []
  const firstUnitRow = importRows.find((row) => row?.unit)
  return {
    rangeBasis,
    factorCode: factor?.code || '',
    factorName: factor?.factorName || '',
    factorUnit: factor?.factorUnit || '',
    priceUnit: firstUnitRow?.unit || '',
    sourceFile: options.fileName || '',
    sourceSheet: options.sheetName || '',
    importBatchNo: options.importBatchNo || buildRangeImportBatchNo(),
    rows: importRows.map((row) => ({
      ...row,
      rangeBasis,
      factorCode: factor?.code || row.factorCode || '',
    })),
  }
}

export const buildRangePriceTypeApplyPayload = (conflicts, options = {}) => ({
  rows: (Array.isArray(conflicts) ? conflicts : [])
    .filter((item) => item?.materialCode)
    .map((item) => ({
      materialCode: item.materialCode,
      materialName: item.materialName || '',
      businessUnitType: item.businessUnitType || '',
      period: item.period || '',
      effectiveFrom: item.effectiveFrom || '',
      source: options.source || 'range-price-import',
    })),
})
