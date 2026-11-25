import { excelCell } from './workbookTransfer.js'

const copperMarketName = '1#电解铜'
const common = (specification, priceType) => ({ source: { rule: {
  materialCode: '', materialName: '示例零件', specification, supplierName: '', supplierCode: '', unit: '件', priceType,
} } })

export function inquiryTemplateRows() {
  const fixed = common('示例-固定', '固定价')
  fixed.source.rule.originalPrice = '2.25'
  const linked = common('示例-联动', '联动价')
  Object.assign(linked.source.rule, { originalPrice: (90 * 0.02 + 1) / 1.13,
    compiled: { expression: '(factor_0*0.02+1)/1.13', sourceInputs: { factor_0: 90 } },
    factors: { factor_0: copperMarketName } })
  const ranged = common('示例-区间', '区间价')
  ranged.source.rule.range = { factorKey: copperMarketName, marketUnit: '元/吨', bands: [
    { lower: 90000, upper: 100000, price: 2 },
    { lower: 100000, upper: 110000, price: 2.4 },
    { lower: 110000, upper: null, price: 2.8 },
  ] }
  return [fixed, linked, ranged]
}

// Rebuild editable originals from saved rules, never replace an original formula with today's price.
export function writeInquiryWorkbook(book, XLSX, definition, rows) {
  const columns = definition.columns
  const sheet = XLSX.utils.aoa_to_sheet([columns.map(column => column.label)])
  const factors = [['行情因素', '原稿参考价']]
  let outputRow = 1
  for (const entry of rows) {
    const rule = entry.source.rule
    for (const band of rule.range?.bands || [null]) {
      const values = [rule.materialCode, rule.materialName, rule.specification, rule.supplierName,
        rule.unit, rule.priceType, rule.priceType === '固定价' ? rule.originalPrice : '',
        rule.priceType === '固定价' ? rule.originalPrice : '', rule.formula || '', rule.supplierCode || '',
        rule.range?.factorKey || '', rule.range?.marketUnit || '', band?.lower ?? '', band?.upper ?? '', band?.price ?? '']
      values.forEach((value, index) => { sheet[XLSX.utils.encode_cell({ r: outputRow, c: index })] = excelCell(value, columns[index]) })
      if (rule.priceType === '联动价') {
        if (!rule.compiled?.expression) throw new Error('此询价缺少保存的公式，请下载原件核对')
        let formula = rule.compiled.expression
        for (const [variable, value] of Object.entries(rule.compiled.sourceInputs || {})) {
          const key = rule.factors?.[variable]
          if (!key) throw new Error('此询价缺少保存的因素绑定，请下载原件核对')
          factors.push([key, Number(value)])
          const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          formula = formula.replace(new RegExp(`\\[${escaped}\\]|\\b${escaped}\\b`, 'g'), `'影响因素'!$B$${factors.length}`)
        }
        sheet[`H${outputRow + 1}`] = { t: 'n', f: formula, v: Number(rule.originalPrice), z: '0.##################' }
        sheet[`I${outputRow + 1}`] = { t: 's', v: formula }
      }
      outputRow++
    }
  }
  sheet['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: Math.max(1, outputRow - 1), c: columns.length - 1 })
  sheet['!cols'] = columns.map(() => ({ wch: 22 }))
  book.Sheets[definition.sheet] = sheet
  if (factors.length > 1) {
    const values = XLSX.utils.aoa_to_sheet(factors)
    values['!cols'] = [{ wch: 32 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(book, values, '影响因素')
  }
}
