import { utils } from 'xlsx'

const requiredHeaders = ['物料代码', '物料名称', '供应商', '供货比例']
const aliases = {
  料号: '物料代码', 物料编码: '物料代码', 品名: '物料名称',
  供应商名称: '供应商', 比例: '供货比例', 供货比率: '供货比例', 供货比利: '供货比例',
}

// Match the backend's first 21 rows. Sheet names and optional columns do not identify the data.
export function findSupplierRatioSheets(workbook) {
  return workbook.SheetNames.filter((name) => {
    const sheet = workbook.Sheets[name]
    if (!sheet?.['!ref']) return false
    const range = utils.decode_range(sheet['!ref'])
    const rows = utils.sheet_to_json(sheet, {
      header: 1, raw: false,
      range: { s: { r: 0, c: 0 }, e: { r: Math.min(20, range.e.r), c: range.e.c } },
    })
    return rows.some((row) => {
      const headers = new Set(row.map((value) => {
        const text = String(value ?? '').replace(/[\s\u3000]+/g, '').replace(/\*$/, '')
        return aliases[text] || text
      }))
      return requiredHeaders.every((header) => headers.has(header))
    })
  })
}
