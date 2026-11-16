import * as XLSX from 'xlsx'

export const compositionColumns = Object.freeze([
  ['period', '来源期间'], ['parentCode', '父件料号'], ['parentName', '父件名称'],
  ['subjectCode', '科目代码'], ['subjectName', '科目名称'],
  ['materialCode', '部品料号'], ['materialName', '部品名称'],
  ['originalCent', 'CMS原金额（分）'], ['amountYuan', '明细金额（元）'],
  ['originalAmountYuan', '该来源原金额（元）'], ['excludedAmountYuan', '本单剔除金额（元）'], ['adoptedAmountYuan', '实际计入金额（元）'],
  ['quantity', '用量'], ['unitPrice', '采用单价'],
  ['parentBaseQty', '包装母件底数'], ['childBaseQty', '子件底数（旧算法用）'],
  ['packageQuantity', '本次包装组件BOM用量'], ['effectiveQuantity', '折算后子件用量'],
  ['childAmount', '子件金额合计／分项小计'], ['coefficient', '包装系数'], ['coefficientBasis', '系数依据'],
  ['quantityBasis', '用量算法'], ['calculation', '代入计算'],
  ['workshopCode', '车间代码'], ['workshopName', '车间名称'],
  ['workingHours', 'CMS工时'], ['funding', 'CMS经费'],
  ['division', '事业部'], ['directLabor', '直接人工（元）'], ['indirectLabor', '辅助人工（元）'], ['laborTotal', '人工合计（元）'], ['manhourRate', '工时工资率'],
  ['baseAmount', '工时基数'], ['rate', '有效费率'], ['quoteRatio', '报价费率'],
  ['upliftRatio', '上浮系数'], ['calculationMode', '费率计算方式'],
  ['budgetAmount', '年度预算'], ['totalWorkMinutes', '年度总工时'], ['planRate', '计划费率'],
  ['path', 'CMS原始路径（括号末尾金额为分，已含路径用量）'], ['priceSource', '价格来源'],
  ['sourceTable', '来源表'], ['sourceId', '来源记录ID'], ['sourceBatch', '来源批次'],
  ['sourceRow', '导入行号'], ['cmsRowId', 'CMS原行标识'], ['note', '核对说明'],
].map(([key, label]) => ({ key, label })))

export function visibleCompositionColumns(view) {
  const packaging = ['OTHER_EXP_PACKAGE','BOM_BUCKET_PACKAGE'].includes(view?.costCode)
  const columns = compositionColumns.filter(column => view?.composition?.rows?.some(row => row[column.key] != null && row[column.key] !== ''))
    .map(column => packaging && column.key === 'path' ? { ...column, label: '保存的包装BOM路径' }
      : packaging && column.key === 'baseAmount' ? { ...column, label: '包装金额基数' }
      : isLabor(view) && column.key === 'path' ? { ...column, label: 'CMS原始工资分摊路径（末尾数值为来源分摊值）' }
      : isLabor(view) && column.key === 'amountYuan' ? { ...column, label: '来源原金额（元）' } : column)
  if (!packaging) return columns
  const first = ['materialCode','materialName','unitPrice','quantity','parentBaseQty','packageQuantity','amountYuan','calculation']
  return columns.sort((a,b) => (first.includes(a.key) ? first.indexOf(a.key) : first.length) - (first.includes(b.key) ? first.indexOf(b.key) : first.length))
}

const isLabor = view => ['DIRECT_LABOR', 'INDIRECT_LABOR'].includes(view?.costCode)
const hasExclusion = row => row.excludedAmountYuan != null && row.excludedAmountYuan !== ''
const sourceKey = row => JSON.stringify([row.sourceTable, row.sourceId, row.period, row.parentCode])
// Saved amounts are decimal strings. Never round money through binary floating point.
function decimalSum(values) {
  const parts = values.map(value => /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value)))
  if (parts.some(part => !part)) return ''
  const scale = Math.max(6, ...parts.map(part => (part[3] || '').length))
  const sum = parts.reduce((total, [, sign, whole, fraction = '']) => total + BigInt(sign + whole + fraction.padEnd(scale, '0')), 0n)
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0')
  return `${sum < 0n ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}
export function compositionExclusionRows(view) {
  if (!isLabor(view)) return []
  const rows = view?.composition?.rows || []
  const sources = new Map(rows.filter(row => !hasExclusion(row)).map(row => [sourceKey(row), row]))
  return rows.filter(hasExclusion).map(row => ({
    workshopCode: sources.get(sourceKey(row))?.workshopCode,
    workshopName: sources.get(sourceKey(row))?.workshopName,
    ...row,
  }))
}
export function compositionDetailRows(view) {
  const rows = view?.composition?.rows || []
  if (['OTHER_EXP_PACKAGE', 'BOM_BUCKET_PACKAGE'].includes(view?.costCode)) return rows.filter(row => row.kind === 'PACKAGE_COMPONENT')
  if (!isLabor(view) || !rows.some(hasExclusion)) return rows
  const exclusions = new Map()
  for (const row of rows.filter(hasExclusion)) {
    const key = sourceKey(row)
    exclusions.set(key, [...(exclusions.get(key) || []), row.excludedAmountYuan])
  }
  return rows.filter(row => !hasExclusion(row)).map(row => {
    if (row.amountYuan == null || row.amountYuan === '') return row
    const excludedAmountYuan = decimalSum(exclusions.get(sourceKey(row)) || ['0'])
    const negative = excludedAmountYuan.startsWith('-') ? excludedAmountYuan.slice(1) : `-${excludedAmountYuan}`
    return { ...row, excludedAmountYuan, adoptedAmountYuan: decimalSum([row.amountYuan, negative]) }
  })
}
export function compositionSummary(view) {
  const evidence = view.composition
  return [
    ['保存版本', view.versionNo], ['成本版本ID', String(view.versionId)], ['核算单号', view.costRunNo],
    ['产品料号', view.productCode], ['核算月份', view.pricingMonth], ['核算项目', `${view.costName} ${view.costCode}`],
    ['资料口径', evidence.origin === 'CURRENT_REFERENCE' ? '当前来源核对资料（旧版本未保存当时分项）' : '本次核算保存依据'],
    ['保存金额（元）', view.amount], ['保存基数', view.baseAmount], ['保存系数／有效费率', view.rate],
    ['来源合计（元）', evidence.sourceAmount], ['剔除金额（元）', evidence.excludedAmount],
    ['按来源核对金额（元）', view.referenceAmount], ['核对金额减保存金额（元）', view.difference],
    ['计算方法', evidence.formula], ['代入计算', view.calculation], ['核对说明', evidence.note],
  ].map(([label, value]) => [label, value ?? ''])
}

// Decimal shift only, so a CMS path value never loses digits through a JS floating point sum.
function centsToYuan(cents) {
  const [, sign, whole, fraction = ''] = /^(-?)(\d+)(?:\.(\d+))?$/.exec(cents)
  const digits = whole.padStart(3, '0')
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}${fraction}`
}
export function compositionPaths(view) {
  const labor = isLabor(view), exclusions = compositionExclusionRows(view)
  return (view.composition.rows || []).filter(row => !row.kind?.startsWith('PACKAGE') && !(labor && hasExclusion(row))).flatMap(row => String(row.path || '').split(/[;；]/).map(path => path.trim()).filter(Boolean).map(path => {
    const cents = /\((-?\d+(?:\.\d+)?)\)$/.exec(path)?.[1]
    const excluded = String(view.composition.note || '').includes(`CMS #${row.sourceId}：${path}`)
    if (labor) return { sourceId: row.sourceId, period: row.period, parentCode: row.parentCode, path,
      originalCent: '', amountYuan: '', pathBasis: cents ?? '',
      treatment: exclusions.some(exclusion => sourceKey(exclusion) === sourceKey(row) && String(exclusion.path || '').split(/[;；]/).map(value => value.trim()).includes(path))
        ? '已剔除：本单形态切换，金额见剔除明细；路径分摊值不是工资金额'
        : '工资按原始行金额及保存的剔除额核对；路径分摊值不是工资金额' }
    return { sourceId: row.sourceId, period: row.period, parentCode: row.parentCode,
      path, originalCent: cents ?? '', amountYuan: cents == null ? '' : centsToYuan(cents),
      treatment: excluded ? '已剔除：烧结基座表面处理' : '来源路径分项（转元后按原始行汇总及舍入）' }
  }))
}

export function compositionWorkbook(view) {
  const book = XLSX.utils.book_new()
  const summary = XLSX.utils.aoa_to_sheet([['核对项目', '内容'], ...compositionSummary(view)])
  summary['!cols'] = [{ wch: 30 }, { wch: 110 }]
  XLSX.utils.book_append_sheet(book, summary, '金额及计算方法')
  const packaging = ['OTHER_EXP_PACKAGE','BOM_BUCKET_PACKAGE'].includes(view.costCode)
  const detailRows = compositionDetailRows(view)
  const columns = visibleCompositionColumns({ ...view, composition: { ...view.composition, rows: detailRows } })
  const numeric = new Set(['originalCent','amountYuan','originalAmountYuan','excludedAmountYuan','adoptedAmountYuan','quantity','unitPrice','workingHours','funding',
    'parentBaseQty','childBaseQty','packageQuantity','effectiveQuantity','childAmount','coefficient',
    'directLabor','indirectLabor','laborTotal','manhourRate','baseAmount','rate','quoteRatio','upliftRatio',
    'budgetAmount','totalWorkMinutes','planRate'])
  function cell(key, value) {
    const text = String(value ?? '')
    if (!numeric.has(key) || !/^-?\d+(?:\.\d+)?$/.test(text)) return value ?? ''
    const significant = text.replace(/^-/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
    if (significant.length > 15) return text
    const scale = text.split('.')[1]?.length || 0
    return { t: 'n', v: Number(text), z: scale ? `0.${'0'.repeat(scale)}` : '0' }
  }
  const detail = XLSX.utils.aoa_to_sheet([columns.map(column => column.label),
    ...(detailRows || []).map(row => columns.map(column => cell(column.key, row[column.key])))])
  // Monetary columns can be summed. Codes/IDs and decimals beyond Excel precision remain text.
  detail['!cols'] = columns.map(column => ({ wch: column.key === 'path' ? 100 : 24 }))
  if (columns.length) detail['!autofilter'] = { ref: detail['!ref'] }
  XLSX.utils.book_append_sheet(book, detail, '来源明细')
  const exclusions = compositionExclusionRows(view)
  if (exclusions.length) {
    const columns = visibleCompositionColumns({ ...view, composition: { ...view.composition, rows: exclusions } })
    const sheet = XLSX.utils.aoa_to_sheet([columns.map(column => column.label),
      ...exclusions.map(row => columns.map(column => cell(column.key, row[column.key])))])
    sheet['!cols'] = columns.map(column => ({ wch: column.key === 'path' ? 100 : 26 }))
    sheet['!autofilter'] = { ref: sheet['!ref'] }
    XLSX.utils.book_append_sheet(book, sheet, '剔除明细')
  }
  if (packaging) {
    const rows = view.composition.rows.filter(row => row.kind !== 'PACKAGE_COMPONENT')
    const columns = visibleCompositionColumns({ ...view, composition: { ...view.composition, rows } })
    const labels = { PACKAGE_FEE_PARAMETERS: '保存的包装系数参数', PACKAGE_PARENT: '包装组件合计', PACKAGE_TOTAL: '最终包装费用' }
    const sheet = XLSX.utils.aoa_to_sheet([
      ['项目', ...columns.map(column => column.label)],
      ...rows.map(row => [labels[row.kind] || row.kind, ...columns.map(column => cell(column.key, row[column.key]))]),
    ])
    sheet['!cols'] = [{ wch: 26 }, ...columns.map(column => ({ wch: column.key === 'calculation' ? 110 : 26 }))]
    XLSX.utils.book_append_sheet(book, sheet, '包装汇总及系数')
  }
  const sources = XLSX.utils.aoa_to_sheet([
    ['来源期间', '父件料号', '科目代码', '生效来源合计（元）', '原始来源表', '原始记录ID'],
    ...(view.composition.sources || []).map(row => [row.period, row.parentCode, row.subjectCode, row.amountYuan, row.table, row.rowIds])])
  sources['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 38 }, { wch: 80 }]
  if (!packaging || view.composition.sources?.length) XLSX.utils.book_append_sheet(book, sources, '采用来源')
  const paths = compositionPaths(view)
  if (paths.length) {
    const labor = isLabor(view)
    const pathSheet = XLSX.utils.aoa_to_sheet([
      ['原始记录ID', '来源期间', '父件料号', '来源路径', ...(labor ? ['路径分摊值（非工资金额）'] : ['路径金额（分）', '路径金额（元，未按原始行舍入）']), '处理说明'],
      ...paths.map(row => [row.sourceId, row.period, row.parentCode, row.path, ...(labor ? [row.pathBasis] : [row.originalCent, row.amountYuan]), row.treatment])])
    pathSheet['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 110 }, { wch: 26 }, { wch: 32 }, { wch: 48 }]
    XLSX.utils.book_append_sheet(book, pathSheet, '路径分项')
  }
  return book
}
export function downloadComposition(view) {
  const filename = `${view.productCode}_${view.versionId}_${view.costCode}_金额来源明细.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(compositionWorkbook(view), filename)
}
