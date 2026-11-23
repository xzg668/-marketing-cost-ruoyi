export const formatRangeType = (row) => {
  if (String(row?.rangeBasis ?? '').toUpperCase() !== 'FACTOR') return '数量区间'
  const factor = String(row?.factorCode ?? '').toUpperCase()
  if (factor === 'CU' || factor === 'AVG|1#CU') return '铜价区间'
  if (factor === 'GOLD' || factor === 'AVG|黄金AU9999') return '黄金区间'
  return '行情区间'
}

export const formatCurrentStatus = (row) => row?.rangeBasis === 'FACTOR' && row?.sourceCellRef ? '已发布' : Number(row?.currentFlag ?? 1) === 0 ? '历史' : '当前'

export const formatRange = (row) => {
  if (row?.rangeLow == null || row?.rangeHigh == null) return ''
  const interval = `${row.lowerInclusive === 0 ? '(' : '['}${row.rangeLow}, ${row.rangeHigh}${row.upperInclusive === 0 ? ')' : ']'}`
  if (row.rangeBasis !== 'FACTOR') return `${interval}（采购数量）`
  const unit = ({ CNY_TON: '元/吨', CNY_KG: '元/公斤', CNY_G: '元/克', '元/吨': '元/吨', '元/公斤': '元/公斤', '元/克': '元/克' })[row.factorUnit]
  return `${interval}${unit ? ` ${unit}` : ''}`
}
