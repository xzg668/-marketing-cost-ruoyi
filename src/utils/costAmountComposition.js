import * as XLSX from 'xlsx'

export const compositionColumns = Object.freeze([
  ['period', '来源期间'], ['parentCode', '父件料号'], ['parentName', '父件名称'],
  ['subjectCode', '科目代码'], ['subjectName', '科目名称'],
  ['materialCode', '部品料号'], ['materialName', '部品名称'],
  ['originalCent', 'CMS原金额（分）'], ['amountYuan', '明细金额（元）'],
  ['quantity', '用量'], ['unitPrice', '采用单价'],
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
  return compositionColumns.filter(column => view?.composition?.rows?.some(row => row[column.key] != null && row[column.key] !== ''))
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
  return (view.composition.rows || []).flatMap(row => String(row.path || '').split(/[;；]/).map(path => path.trim()).filter(Boolean).map(path => {
    const cents = /\((-?\d+(?:\.\d+)?)\)$/.exec(path)?.[1]
    const excluded = String(view.composition.note || '').includes(`CMS #${row.sourceId}：${path}`)
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
  const columns = visibleCompositionColumns(view)
  const numeric = new Set(['originalCent','amountYuan','quantity','unitPrice','workingHours','funding',
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
    ...(view.composition.rows || []).map(row => columns.map(column => cell(column.key, row[column.key])))])
  // Monetary columns can be summed. Codes/IDs and decimals beyond Excel precision remain text.
  detail['!cols'] = columns.map(column => ({ wch: column.key === 'path' ? 100 : 24 }))
  if (columns.length) detail['!autofilter'] = { ref: detail['!ref'] }
  XLSX.utils.book_append_sheet(book, detail, '来源明细')
  const sources = XLSX.utils.aoa_to_sheet([
    ['来源期间', '父件料号', '科目代码', '生效来源合计（元）', '原始来源表', '原始记录ID'],
    ...(view.composition.sources || []).map(row => [row.period, row.parentCode, row.subjectCode, row.amountYuan, row.table, row.rowIds])])
  sources['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 38 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(book, sources, '采用来源')
  const paths = compositionPaths(view)
  if (paths.length) {
    const pathSheet = XLSX.utils.aoa_to_sheet([
      ['原始记录ID', '来源期间', '父件料号', '来源路径', '路径金额（分）', '路径金额（元，未按原始行舍入）', '处理说明'],
      ...paths.map(row => [row.sourceId, row.period, row.parentCode, row.path, row.originalCent, row.amountYuan, row.treatment])])
    pathSheet['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 110 }, { wch: 26 }, { wch: 32 }, { wch: 48 }]
    XLSX.utils.book_append_sheet(book, pathSheet, '路径分项')
  }
  return book
}
export function downloadComposition(view) {
  const filename = `${view.productCode}_${view.versionId}_${view.costCode}_金额来源明细.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(compositionWorkbook(view), filename)
}
