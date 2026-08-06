import XLSX from 'xlsx'
import {
  buildRangeType1ImportRequest,
  collectRangeFormulaCells,
  collectRangeMergedCellValues,
  detectRangeWorkbookRoute,
  matchRangeType1Rows,
  parseRangeBaseSheet,
  parseRangeType1Sheet,
} from '../src/pages/priceRangeImportUtils.js'

export const RPI1_TYPE1_REAL_FILE_SHA256 =
  'a3f44d77e904724de2479924f76b8ec9cf0c8ed8ea1c129b8328b2ab25cc80bf'

export const workbookSheetEntries = (workbook) =>
  workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      defval: '',
      raw: false,
    }),
  }))

export const parseRangeType1Workbook = (workbook, options = {}) => {
  const route = detectRangeWorkbookRoute(workbookSheetEntries(workbook), {
    fileName: options.fileName || 'range-type1.xlsx',
  })
  if (!route.ok) {
    return { ok: false, route }
  }

  const base = parseRangeBaseSheet(route.baseSheet.rows, {
    headerRowIndex: route.baseSheet.headerRowIndex,
    sheetName: route.baseSheet.name,
  })
  const formulaCells = collectRangeFormulaCells(workbook.Sheets[route.rangeSheet.name])
  const range = parseRangeType1Sheet(route.rangeSheet.rows, {
    headerRowIndex: route.rangeSheet.headerRowIndex,
    subHeaderRowIndex: route.rangeSheet.subHeaderRowIndex,
    factor: route.factor,
    formulaCells,
    mergedCellValues: collectRangeMergedCellValues(workbook.Sheets[route.rangeSheet.name]),
    sheetName: route.rangeSheet.name,
  })
  const match = base.ok && range.ok
    ? matchRangeType1Rows(base.rows, range.rows, { sheetName: route.rangeSheet.name })
    : null
  const request = match
    ? buildRangeType1ImportRequest(match, {
        factor: range.factor,
        fileName: options.fileName || 'range-type1.xlsx',
        sheetName: route.rangeSheet.name,
        importBatchNo: options.importBatchNo || 'RPI1-12-E2E',
      })
    : null

  return {
    ok: Boolean(base.ok && range.ok && match?.ok && request?.ok),
    route,
    base,
    range,
    match,
    request,
    formulaCells,
  }
}

const sanitizedDefinitions = [
  ['MAT-001', 'SPEC-001', '供应商甲', 'TEST-A', '测试供应商甲有限公司'],
  ['MAT-002', 'SPEC-002', '供应商甲', 'TEST-A', '测试供应商甲有限公司'],
  ['MAT-003', 'SPEC-003-A', '供应商甲', 'TEST-A', '测试供应商甲有限公司'],
  ['MAT-004', 'SPEC-004-A', '供应商甲', 'TEST-A', '测试供应商甲有限公司'],
  ['MAT-001', 'SPEC-001', '供应商乙', 'TEST-B', '测试供应商乙有限公司'],
  ['MAT-002', 'SPEC-002', '供应商乙', 'TEST-B', '测试供应商乙有限公司'],
  ['MAT-005', 'SPEC-005-B', '供应商乙', 'TEST-B', '测试供应商乙有限公司'],
  ['MAT-006', 'SPEC-006-B', '供应商乙', 'TEST-B', '测试供应商乙有限公司'],
]

export const buildSanitizedRangeType1Workbook = () => {
  const baseRows = [[
    '组织', '来源', '供应商名称', '供应商代码', '采购分类', '物料名称', '物料代码',
    '规格型号', '单位', '联动公式', '下料重', '净重', '加工费', '代理费', '单价',
    '是否含税', '生效日期', '失效日期', '订单类型',
  ]]
  sanitizedDefinitions.forEach(([
    materialCode,
    specModel,
    _supplierShortName,
    supplierCode,
    supplierName,
  ]) => {
    baseRows.push([
      'TEST-ORG', '脱敏夹具', supplierName, supplierCode, '部品固定', '测试气门芯',
      materialCode, specModel, '只', '', '', '', '', '', '1.0000', false,
      '2025-11-01', '2025-11-30', 'VMI采购',
    ])
  })

  const rangeHeader = ['名称', '规格', '供方']
  const rangeSubHeader = ['', '', '']
  for (let intervalIndex = 0; intervalIndex < 10; intervalIndex += 1) {
    const low = 57001 + intervalIndex * 3000
    const high = 60000 + intervalIndex * 3000
    rangeHeader.push(`CU：${low}-${high}`, '')
    rangeSubHeader.push('不含税', '含税')
  }
  rangeHeader.push('备注')
  rangeSubHeader.push('')
  const rangeRows = [
    ['脱敏区间价格夹具'],
    rangeHeader,
    rangeSubHeader,
  ]
  sanitizedDefinitions.forEach(([_materialCode, specModel, supplierShortName], rowIndex) => {
    const row = ['测试气门芯', specModel, supplierShortName]
    for (let intervalIndex = 0; intervalIndex < 10; intervalIndex += 1) {
      const priceInclTax = Number((1.13 + rowIndex / 10 + intervalIndex / 100).toFixed(6))
      row.push(Number((priceInclTax / 1.13).toFixed(12)), priceInclTax)
    }
    row.push('脱敏测试数据')
    rangeRows.push(row)
  })

  const workbook = XLSX.utils.book_new()
  const baseSheet = XLSX.utils.aoa_to_sheet(baseRows)
  const rangeSheet = XLSX.utils.aoa_to_sheet(rangeRows)
  rangeSheet['!merges'] = []
  for (let intervalIndex = 0; intervalIndex < 10; intervalIndex += 1) {
    const exclColumn = 3 + intervalIndex * 2
    const inclColumn = exclColumn + 1
    rangeSheet['!merges'].push({
      s: { r: 1, c: exclColumn },
      e: { r: 1, c: inclColumn },
    })
    for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
      const sheetRow = rowIndex + 3
      const exclAddress = XLSX.utils.encode_cell({ r: sheetRow, c: exclColumn })
      const inclAddress = XLSX.utils.encode_cell({ r: sheetRow, c: inclColumn })
      const cachedValue = rangeRows[sheetRow][exclColumn]
      rangeSheet[exclAddress] = {
        t: 'n',
        f: `${inclAddress}/1.13`,
        v: cachedValue,
        w: cachedValue.toFixed(4),
      }
    }
  }
  XLSX.utils.book_append_sheet(workbook, baseSheet, '气门芯价格')
  XLSX.utils.book_append_sheet(workbook, rangeSheet, 'Sheet1')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['']]), 'Sheet2')
  return workbook
}
