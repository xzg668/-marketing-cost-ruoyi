// Workbook download is read-only. Import validation and publication remain in their original flows.
export function cellValue(row, field) {
  return typeof field === 'function' ? field(row) : String(field).split('.').reduce((value, key) => value?.[key], row)
}

export function normalizeExportPage(result) {
  if (Array.isArray(result)) return { rows: result, total: result.length, complete: true }
  const rows = result?.records ?? result?.list ?? result?.items ?? result?.rows
  if (!Array.isArray(rows)) throw new Error('导出数据格式异常，请刷新后重试')
  const total = Number(result.total ?? result.totalCount)
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('无法确定完整导出数量，请重试')
  return { rows, total, complete: false }
}

export async function collectExportRows(fetchPage, query = {}, options = {}) {
  const snapshot = structuredClone(query)
  const { pageKey = 'page', sizeKey = 'pageSize', pageSize = 200, normalize = normalizeExportPage, isCurrent = () => true, progress = () => {} } = options
  const all = [], signatures = new Set()
  let expected = null
  for (let page = 1; ; page++) {
    if (!isCurrent()) throw new Error('查询范围已变化，已取消本次导出')
    const result = normalize(await fetchPage({ ...snapshot, [pageKey]: page, [sizeKey]: pageSize }))
    if (!isCurrent()) throw new Error('查询范围已变化，已取消本次导出')
    if (expected != null && result.total !== expected) throw new Error('导出期间记录数量发生变化，请重新导出')
    expected = result.total
    if (expected > 1048575) throw new Error('数据超过 Excel 单表容量，请缩小查询范围后导出')
    const signature = JSON.stringify(result.rows)
    if (result.rows.length && signatures.has(signature)) throw new Error('分页未能取得完整数据，请重试')
    signatures.add(signature)
    for (const row of result.rows) all.push(row)
    progress(all.length, expected)
    if (all.length === expected || result.complete) return all
    if (!result.rows.length || all.length > expected) throw new Error('导出数量与查询结果不一致，请重新导出')
  }
}

export function excelCell(value, column = {}) {
  if (value == null || value === '') return { t: 's', v: '', z: column.format || '@' }
  if (column.type === 'boolean') return { t: 's', v: value === true || value === 1 ? '是' : '否', z: '@' }
  if (column.type === 'number' || column.type === 'percent') {
    const text = String(value), number = Number(text)
    // Excel keeps 15 significant digits; preserve more precise saved decimals as text.
    if (/^-?\d+(\.\d+)?$/.test(text) && Number.isFinite(number) && text.replace(/[-.]/g, '').replace(/^0+/, '').length <= 15)
      return { t: 'n', v: number, z: column.type === 'percent' ? '0.######%' : '0.##################' }
  }
  return { t: 's', v: String(value), z: '@' }
}

function appendTemplateExamples(XLSX, book, definition, columns) {
  const examples = definition.templateExamples
  const fields = [...columns, ...(definition.templateExampleColumns || [])]
    .map(column => ({ column, values: examples.map(example =>
      typeof column.field === 'function' ? column.field(example) : example[column.field]) }))
    .filter(({ values }) => values.some(value => value != null && value !== ''))
  // A vertical layout avoids introducing a second detectable import header into the workbook.
  const sheet = XLSX.utils.aoa_to_sheet([
    ['填写示例（仅供参考）'],
    ['请在对应填写表使用实际数据。'],
    ['字段', ...examples.map((example, index) => example.title || `示例${index + 1}`)],
    ...fields.map(({ column }) => [column.label]),
  ])
  fields.forEach(({ column, values }, index) => values.forEach((value, position) => {
    const cell = excelCell(value, column)
    if (cell.t === 'n') {
      if (column.type === 'percent') cell.z = Number.isInteger(cell.v * 100) ? '0%' : '0.0#####%'
      else if (Number.isInteger(cell.v)) cell.z = '0'
    }
    sheet[XLSX.utils.encode_cell({ r: index + 3, c: position + 1 })] = cell
  }))
  sheet['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: fields.length + 2, c: examples.length })
  const labelWidth = Math.min(64, Math.max(32, ...fields.map(({ column }) => column.label.length * 2 + 2)))
  sheet['!cols'] = [{ wch: labelWidth }, ...examples.map(() => ({ wch: 26 }))]
  XLSX.utils.book_append_sheet(book, sheet, '填写示例')
}

export function createWorkbook(XLSX, definition, rows, template = false) {
  const book = XLSX.utils.book_new()
  const columns = template ? definition.templateColumns || definition.columns : definition.columns
  const leading = template ? definition.leadingRows || [] : []
  const sheet = XLSX.utils.aoa_to_sheet([...leading, columns.map(column => column.label)])
  const offset = leading.length + 1
  const data = template ? [Object.create(null)] : rows
  data.forEach((row, index) => columns.forEach((column, position) => {
    sheet[XLSX.utils.encode_cell({ r: offset + index, c: position })] = excelCell(cellValue(row, column.field), column)
  }))
  sheet['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: offset + Math.max(1, data.length) - 1, c: columns.length - 1 })
  sheet['!cols'] = columns.map(column => ({ wch: column.width || Math.max(16, Math.min(38, column.label.length * 2 + 2)) }))
  if (!template) sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ r: leading.length, c: 0 }, { r: offset + data.length - 1, c: columns.length - 1 }) }
  XLSX.utils.book_append_sheet(book, sheet, definition.sheet || '数据')
  if (!template && definition.customizeExport) definition.customizeExport(book, XLSX, rows)
  if (template && definition.customizeTemplate) definition.customizeTemplate(book, XLSX)
  if (template && definition.templateExamples?.length) appendTemplateExamples(XLSX, book, definition, columns)
  const instructions = [
    ['说明', definition.title],
    ['用途', definition.purpose || (template ? '在第一个工作表填写实际数据后保存，再通过对应页面导入。' : '本文件包含当前筛选范围的系统数据；导入仍按原业务规则校验。')],
    ['编码', '料号、型号、供应商编码按文本保存，请保留前导零。'],
    ...((template ? definition.templateNotes ?? definition.notes : definition.notes) || [])
      .map(note => Array.isArray(note) ? note : ['填写要求', note]),
    ['字段', '填写说明', '示例（仅供参考）'],
    ...columns.map(column => [column.label, column.help || '', column.example == null ? '' : String(column.example)]),
  ]
  const help = XLSX.utils.aoa_to_sheet(instructions)
  help['!cols'] = [{ wch: 30 }, { wch: 95 }, { wch: 38 }]
  XLSX.utils.book_append_sheet(book, help, '填写说明')
  book.Workbook = { ...(book.Workbook || {}), CalcPr: { calcMode: 'auto', fullCalcOnLoad: true } }
  return book
}

export function saveWorkbook(XLSX, book, filename) {
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
