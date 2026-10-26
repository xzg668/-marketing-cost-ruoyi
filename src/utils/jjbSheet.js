// Values are already rounded by the saved-version reader. Never calculate a formal amount here.
export const jjbColumns = Object.freeze([
  ['code', '子件编码'], ['name', '部品名'], ['drawingNo', '部品图号'], ['unitPrice', '部品单价'],
  ['quantity', '部品用量'], ['amount', '部品价格'], ['grossWeight', '毛重'], ['netWeight', '净重'],
  ['rawUnitPrice', '原材料\n单价'], ['scrapUnitPrice', '废料\n单价'], ['material', '材质'],
  ['shape', '形态属性'], ['priceSource', '价格来源'], ['remark', '备注\n（手填）'], ['basis', '备注-CMS\n来源信息'],
])
// Exact relative column widths from the supplied 见机表3, A:O.
export const jjbColumnWidths = Object.freeze([15.9166666667, 19, 20.4166666667, 14.5, 17.5, 15.75, 17.8333333333, 13.5833333333, 13.25, 18.4166666667, 19.0833333333, 14.8333333333, 21.25, 13.4166666667, 13.5833333333])

export function sheetHeaderRows(sheet) {
  const h = sheet.header || {}, q = h.quotation || {}, id = sheet.identity || {}
  const values = [
    ['OA单号', id.oaNo, null, '报价员', q.applicantName, '申请部门', q.applicantDept, '申请处室', q.applicantOffice, '不锈钢-316L\n（元/吨）', savedMoney(q.sus316lPrice), '电解铜\n（元/吨）', savedMoney(q.copperPrice), '电解铝\n（元/吨）', savedMoney(q.aluminumPrice)],
    ['客户名称', h.customerName, null, '客户编号', h.customerCode, '是否通过海外\n仓库发终端客户', q.overseasSalesMode, '销售价格\n是否联动', q.priceLinkMode, '不锈钢-304\n（元/吨）', savedMoney(q.sus304Price), '电解锌\n（元/吨）', savedMoney(q.zincPrice), '/', ''],
    ['父件名称', h.productName, null, '父件型号', h.productModel, '业务类型', q.businessType, '事业部', q.division, '美国柜装黄铜', '', 'H65黄铜边料', '', '/', ''],
    ['一级编码', id.productCode, null, '父件规格', q.spec, '客户图号', h.customerDrawing, '客户Cu\n（元/公斤）', savedMoney(q.customerCuPrice), '白银', savedMoney(q.silverPrice), '黄金', savedMoney(q.goldPrice), '/', ''],
  ]
  return values.map((row, index) => ({ height: [48, 64, 57, 60][index], cells: row.flatMap((value, column) => column === 2 ? [] : [{ column, colspan: column === 1 ? 2 : 1, value: value ?? '', label: [0, 3, 5, 7, 9, 11, 13].includes(column) }]) }))
}

export function sheetRowCells(row, group, index) {
  const part = ['PART', 'HOUSEHOLD', 'EXPLANATION'].includes(row.kind)
  const grouped = ['THREE_EXPENSES', 'PRODUCT_FEES'].includes(group.code)
  const cells = jjbColumns.map(([key], column) => ({ column, key, value: '', colspan: 1, rowspan: 1 }))
  if (part) {
    for (const c of cells) c.value = row[c.key] ?? ''
  } else {
    cells[grouped || row.kind === 'SUBTOTAL' ? 2 : 1].value = row.name || ''
    cells[grouped || row.kind === 'SUBTOTAL' ? 2 : 1].key = 'name'
    for (let c = 3; c <= 9; c++) cells[c].value = row[jjbColumns[c][0]] ?? ''
  }
  if (grouped) {
    if (index === 0) Object.assign(cells[0], { value: group.label, rowspan: group.rows.length, label: true })
    else cells[0].omit = true
  }
  if (row.code === 'MANUFACTURE_COST') {
    Object.assign(cells[0], { value: row.name, colspan: 3, label: true, key: 'name' })
    cells[1].omit = cells[2].omit = true
  }
  if (row.kind === 'PROPERTY') {
    cells[0].value = '产品属性'; cells[0].label = true
    cells[1].value = ''; cells[2].value = row.name === '产品属性' ? row.remark || '' : row.name || ''
    cells[5].value = row.coefficient ?? ''; cells[5].key = 'coefficient'
  }
  if (row.kind === 'HOUSEHOLD') cells[12].value = '家用部件含二项费用询价'
  if (['LOSS', 'MANUFACTURE'].includes(row.code)) {
    cells[3].value = ratePercent(row.rate); cells[3].key = 'rate'
  }
  cells[13].value = row.remark || ''
  // Detailed source identities remain available through the existing trace action and tooltips.
  cells[14].value = (row.rate != null && !['LOSS', 'MANUFACTURE'].includes(row.code)) || ['HOUSEHOLD', 'FEE'].includes(row.kind) ? rowBasis(row) : ''
  return cells.filter(c => !c.omit)
}
export const sectionLabels = Object.freeze({
  ORDINARY_PARTS: '普通部品', MATERIAL_DETAIL: '辅料、焊料、包装及其他费用', ORDINARY: '普通成本',
  THREE_EXPENSES: '三项费用', HOUSEHOLD: '家用询价部件', PRODUCT_FEES: '新品费用',
  PROPERTY: '产品属性', HISTORICAL_DETAIL: '历史费用原始明细',
})
export function sheetGroups(sheet) {
  const groups = []
  for (const row of sheet?.rows || []) {
    let group = groups.at(-1)
    if (group?.code !== row.section) {
      group = { code: row.section, label: sectionLabels[row.section] || row.section, rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}
export function savedMoney(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string' || !/^-?\d+\.\d{6}$/.test(value)) throw new Error('保存金额必须为六位十进制文本')
  return value
}
// Move the decimal point for a rate label. This does not compute any monetary value.
export function ratePercent(value) {
  if (value == null || value === '') return ''
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value))
  if (!match) return ''
  const decimals = (match[3] || '').padEnd(2, '0')
  const whole = `${match[2]}${decimals.slice(0, 2)}`.replace(/^0+(?=\d)/, '')
  const fraction = decimals.slice(2).replace(/0+$/, '')
  return `${match[1]}${whole}${fraction ? `.${fraction}` : ''}%`
}
export function rowBasis(row) {
  if (row.kind === 'HOUSEHOLD') return `H=${ratePercent(row.householdRate)}；S=${ratePercent(row.salesRate)}`
  if (row.kind === 'PROPERTY') return row.coefficient == null ? '' : `系数 ${row.coefficient}（已在保存金额中应用）`
  if (row.kind === 'FEE') return ({ MISSING: '未填写', EXPLICIT_NONE: '明确无费用', EXPLICIT_AMOUNT: '有效填写金额', LEGACY: '历史保存值' })[row.feeState] || ''
  if (row.code === 'ADJUSTED_MANUFACTURE_COST') return row.rate == null ? '' : `系数 ${row.rate}`
  if (row.rate != null) return ratePercent(row.rate)
  return row.sources?.map(s => [s.table, s.id].filter(v => v != null).join(' #')).filter(Boolean).join('；') || ''
}
export function sheetTotals(sheet) {
  return [
    { key: 'TOTAL_1', name: '不含税总成本1', amount: sheet?.totals?.totalCost ?? null },
    { key: 'CU_DIFFERENCE', name: '材料成本差异', amount: sheet?.totals?.cuMaterialAdjustment ?? null },
    { key: 'TOTAL_2', name: '不含税总成本2', amount: sheet?.totals?.finalQuoteAmount ?? null },
  ]
}
