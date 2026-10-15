const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '')

// 行情原稿由服务端读取完整文件。此入口只保留当前业务需要的数量区间模板。
export const detectQuantityRangeWorkbookRoute = (sheets) => {
  const candidates = []
  for (const sheet of sheets || []) {
    const rows = sheet.rows || []
    const title = `${sheet.name} ${rows.slice(0, 25).flat().join(' ')}`
    if (/铜价|黄金|电解铜|锌价|铝价|白银|SUS304|SUS316|元\s*\/\s*(吨|KG|公斤|克)|CU\s*[:：]/i.test(title)) {
      return { ok: false, message: '行情价格请使用“导入区间原稿”，上传完整文件进行预检。' }
    }
    for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
      const header = rows[index].map(normalize)
      const hasMaterial = header.some((cell) => ['物料代码', 'U9代码', '料号'].includes(cell))
      const hasBounds = header.some((cell) => ['区间下限', '区间开始'].includes(cell))
        && header.some((cell) => ['区间上限', '区间结束'].includes(cell))
      const hasMatrix = header.some((cell) => /^\d+(?:\.\d+)?[-—~～]+\d+(?:\.\d+)?$/.test(cell))
      if (hasMaterial && (hasBounds || hasMatrix)) {
        const next = rows[index + 1] || []
        candidates.push({ ...sheet, headerRowIndex: index,
          subHeaderRowIndex: next.some((cell) => /含税|未税/.test(String(cell))) ? index + 1 : null })
        break
      }
    }
  }
  if (candidates.length !== 1) return { ok: false, message: `需要唯一的数量区间表，实际识别到 ${candidates.length} 张。` }
  return { ok: true, standardSheet: candidates[0] }
}

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

// 精确表头优先，避免“含税价”误命中“不含税价”、“名称”误命中供应商名称。
export const findQuantityColumn = (header, aliases) => {
  const names = (header || []).map(normalize)
  for (const alias of aliases) {
    const exact = names.indexOf(alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const decorated = names.findIndex((name) => name.includes(alias)
      && !(alias === '含税价' && /不含税|未税/.test(name)))
    if (decorated >= 0) return decorated
  }
  return -1
}
