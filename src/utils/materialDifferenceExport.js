import { excelCell } from './workbookTransfer.js'

const columns = [
  ['materialCode', '料号 / 图号'], ['materialName', '品名'], ['materialModel', '型号'], ['quantity', '数量'],
  ['financeUnitPrice', '财务单价'], ['oaUnitPrice', 'OA 单价'], ['unitPriceDifference', '单价差异'],
  ['financeAmount', '财务金额'], ['oaAmount', 'OA 金额'], ['amountDifference', '金额差异'], ['differenceRate', '差异率'],
]
const changes = new Set(['unitPriceDifference', 'amountDifference', 'differenceRate'])

// Excel stores direction colors in the number format. Percentages from this API
// are already percentage points (50 means 50%), so the % sign is literal.
function differenceFormat(value, percentage) {
  const suffix = percentage ? '"%"' : ''
  const decimals = percentage ? '0.####' : '0.########'
  const sign = Number(value)
  const textColor = sign > 0 ? '[Red]' : sign < 0 ? '[Green]' : ''
  return `[Red]+${decimals}${suffix};[Green]-${decimals}${suffix};${decimals}${suffix};${textColor}@`
}

export function materialDifferenceWorkbook(XLSX, data, { onlyDifferent = true } = {}) {
  const rows = (data.differences || []).filter(row => !onlyDifferent || row.different)
  if (!rows.length) throw new Error('当前筛选没有可导出的材料差异')
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([columns.map(([, label]) => label)])
  rows.forEach((row, index) => columns.forEach(([field], column) => {
    let value = row[field]
    if (field === 'materialCode' && /^DRAWING[:#]/.test(String(value || '')))
      value = `图号：${row.drawingNo || row.drawingCode || value.replace(/^DRAWING[:#]/, '')}`
    const cell = excelCell(value, { type: column < 3 ? 'text' : 'number' })
    if (changes.has(field) && value != null && value !== '') cell.z = differenceFormat(value, field === 'differenceRate')
    sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })] = cell
  }))
  sheet['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: rows.length, c: columns.length - 1 })
  sheet['!autofilter'] = { ref: sheet['!ref'] }
  sheet['!cols'] = columns.map((_, i) => ({ wch: i < 3 ? 28 : 20 }))
  XLSX.utils.book_append_sheet(book, sheet, '材料差异对比')
  const help = XLSX.utils.aoa_to_sheet([
    ['项目', '内容'], ['报价单号', data.oaNo || ''], ['产品料号', String(data.topProductCode || '')], ['核算月份', data.periodMonth || ''],
    ['导出范围', onlyDifferent ? '仅有差异的物料' : '全部对比物料'], ['导出条数', rows.length],
    ['差异口径', '同一料号、相同数量，OA − 财务；原保存数值直接导出，不重新核算。'],
    ['颜色说明', '红色正数表示增加，绿色负数表示减少，零保持普通颜色；空白表示未记录。'],
    ['差异率', '采用系统返回的百分数；财务金额为零、差异率无法计算时保持空白。'],
    ['精度', '超过 Excel 15 位有效数字的值以文本保留完整精度。'],
  ])
  help['!cols'] = [{ wch: 22 }, { wch: 95 }]
  XLSX.utils.book_append_sheet(book, help, '对比说明')
  return book
}

export function materialDifferenceFilename(data) {
  return ['材料差异对比', data.oaNo, data.topProductCode, data.periodMonth]
    .filter(Boolean).join('_').replace(/[\\/:*?"<>|]/g, '_') + '.xlsx'
}
