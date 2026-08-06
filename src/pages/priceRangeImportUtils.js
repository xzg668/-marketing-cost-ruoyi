export const RANGE_FACTOR_OPTIONS = [
  { code: 'CU', label: '铜价区间', factorName: '电解铜', factorUnit: '元/吨' },
  { code: 'ZN', label: '锌价区间', factorName: '电解锌', factorUnit: '元/吨' },
  { code: 'AL', label: '铝价区间', factorName: '电解铝', factorUnit: '元/吨' },
  { code: 'GOLD', label: '黄金区间', factorName: '黄金', factorUnit: '元/克' },
  { code: 'SILVER', label: '白银区间', factorName: '白银', factorUnit: '元/千克' },
  { code: 'SUS304', label: '不锈钢304区间', factorName: '不锈钢304', factorUnit: '元/吨' },
  { code: 'SUS316L', label: '不锈钢316L区间', factorName: '不锈钢316L', factorUnit: '元/吨' },
]

export const RANGE_IMPORT_TYPE_OPTIONS = [
  ...RANGE_FACTOR_OPTIONS.map((option) => ({ ...option, rangeBasis: 'FACTOR' })),
  { code: 'QTY', label: '数量区间', rangeBasis: 'QTY' },
]

const FACTOR_ALIASES = [
  { code: 'CU', aliases: ['区间铜价', '铜价区间', '电解铜', '铜价'] },
  { code: 'ZN', aliases: ['区间锌价', '锌价区间', '电解锌', '锌价'] },
  { code: 'AL', aliases: ['区间铝价', '铝价区间', '电解铝', '铝价'] },
  { code: 'GOLD', aliases: ['镀金区间价', '黄金区间', '黄金价', '金价'] },
  { code: 'SILVER', aliases: ['白银区间价', '白银区间', '白银价', '银价'] },
  { code: 'SUS304', aliases: ['sus304', '不锈钢304', '304不锈钢'] },
  { code: 'SUS316L', aliases: ['sus316l', '不锈钢316l', '316l不锈钢'] },
]

export const normalizeRangeText = (value) =>
  String(value ?? '').replace(/[\s\u3000_\-—~～]+/g, '').toLowerCase()

export const findRangeFactorOption = (code) => {
  const normalized = String(code ?? '').trim().toUpperCase()
  return RANGE_FACTOR_OPTIONS.find((option) => option.code === normalized) || null
}

export const detectRangeFactorBySheetName = (sheetName) => {
  const normalized = normalizeRangeText(sheetName)
  if (!normalized) return null
  const matched = FACTOR_ALIASES.find((item) =>
    item.aliases.some((alias) => normalized.includes(normalizeRangeText(alias)))
  )
  return matched ? findRangeFactorOption(matched.code) : null
}

export const isQuantityRangeSheetName = (sheetName) => {
  const normalized = normalizeRangeText(sheetName)
  return normalized.includes(normalizeRangeText('数量区间'))
}

const BASE_REQUIRED_HEADERS = ['物料代码', '供应商名称', '供应商代码', '规格型号']
const TYPE1_REQUIRED_HEADERS = ['名称', '规格', '供方']
const MATERIAL_CODE_HEADERS = ['物料代码', 'U9代码']
const RANGE_LOW_HEADERS = ['区间下限', '区间开始']
const RANGE_HIGH_HEADERS = ['区间上限', '区间结束']
const PRICE_HEADERS = ['不含税价', '未税价', '含税价', '单价']
const BASE_FIELD_ALIASES = {
  orgCode: ['组织'],
  sourceName: ['来源'],
  supplierName: ['供应商名称'],
  supplierCode: ['供应商代码'],
  purchaseClass: ['采购分类'],
  materialName: ['物料名称'],
  materialCode: ['物料代码'],
  specModel: ['规格型号'],
  unit: ['单位'],
  taxIncluded: ['是否含税'],
  effectiveFrom: ['生效日期'],
  effectiveTo: ['失效日期'],
  orderType: ['订单类型'],
}

const normalizeWorkbookHeader = (value) =>
  String(value ?? '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .toLowerCase()

const isWorkbookCellEmpty = (value) => normalizeWorkbookHeader(value) === ''

const isSheetRowsEmpty = (rows) =>
  !Array.isArray(rows)
  || rows.length === 0
  || rows.every((row) => !Array.isArray(row) || row.every(isWorkbookCellEmpty))

const rowContainsHeader = (row, aliases) => {
  const normalizedAliases = aliases.map(normalizeWorkbookHeader)
  return (Array.isArray(row) ? row : []).some((cell) =>
    normalizedAliases.includes(normalizeWorkbookHeader(cell))
  )
}

const rowContainsAllHeaders = (row, headers) =>
  headers.every((header) => rowContainsHeader(row, [header]))

const findExactHeaderColumn = (headerRow, aliases) => {
  const normalizedAliases = aliases.map(normalizeWorkbookHeader)
  return (Array.isArray(headerRow) ? headerRow : []).findIndex((cell) =>
    normalizedAliases.includes(normalizeWorkbookHeader(cell))
  )
}

const normalizeUnicodeText = (value) =>
  String(value ?? '').normalize('NFKC')

export const normalizeRangeBaseSpec = (value) =>
  normalizeUnicodeText(value)
    .replace(/[\s\u3000]+/g, '')
    .replace(/[‐‑‒–—―−]/g, '-')
    .toUpperCase()

export const normalizeRangeBaseSupplierName = (value) =>
  normalizeUnicodeText(value)
    .replace(/[\s\u3000]+/g, '')
    .replace(/[()[\]{}【】<>《》·•,，.。'"]/g, '')
    .replace(/(集团股份有限公司|股份有限公司|集团有限公司|有限责任公司|股份公司|集团公司|有限公司|公司)$/g, '')
    .replace(/[省市]/g, '')
    .replace(/实业|汽配/g, '')
    .toUpperCase()

export const normalizeRangeBaseSupplierCode = (value) =>
  normalizeUnicodeText(value).trim().toUpperCase()

const toOriginalText = (value) => {
  if (value == null) return ''
  return value instanceof Date ? value : String(value)
}

const toTrimmedText = (value) =>
  value == null ? '' : String(value).trim()

const formatLocalDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseRangeBaseDate = (value) => {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    return formatLocalDate(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const wholeDays = Math.floor(value)
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + wholeDays * 24 * 60 * 60 * 1000)
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-')
  }

  const text = String(value).trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}T.*Z$/i.test(text)) {
    const parsedIsoDate = new Date(text)
    return formatLocalDate(parsedIsoDate)
  }
  const match = text.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }

  const excelDisplayMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!excelDisplayMatch) return ''
  const yearValue = Number(excelDisplayMatch[3])
  const year = excelDisplayMatch[3].length === 2
    ? yearValue >= 70 ? 1900 + yearValue : 2000 + yearValue
    : yearValue
  const month = Number(excelDisplayMatch[1])
  const day = Number(excelDisplayMatch[2])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return ''
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const parseRangeBaseBoolean = (value) => {
  if (value === true || value === false) return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  const text = String(value ?? '').trim().toLowerCase()
  if (['true', 'y', 'yes', '是', '含税', '含'].includes(text)) return true
  if (['false', 'n', 'no', '否', '未税', '不含税', '未含税'].includes(text)) return false
  return null
}

const readBaseCell = (row, columnIndex) => {
  if (!Array.isArray(row) || columnIndex < 0) return ''
  return row[columnIndex] ?? ''
}

const buildBaseColumns = (headerRow) =>
  Object.fromEntries(
    Object.entries(BASE_FIELD_ALIASES).map(([field, aliases]) => [
      field,
      findExactHeaderColumn(headerRow, aliases),
    ])
  )

const buildBaseError = (code, rowNumber, field, message, extra = {}) => ({
  code,
  rowNumber,
  field,
  message,
  ...extra,
})

const enrichRangeImportError = (error, context = {}) => ({
  ...error,
  sheetName: error?.sheetName || context.sheetName || '',
  materialCode: error?.materialCode || context.materialCode || '',
  specModel: error?.specModel || context.specModel || '',
  supplierName: error?.supplierName || context.supplierName || '',
  supplierShortName: error?.supplierShortName || context.supplierShortName || '',
  supplierCode: error?.supplierCode || context.supplierCode || '',
})

export const normalizeRangeImportErrors = (errors, context = {}) =>
  (Array.isArray(errors) ? errors : []).map((error) => ({
    code: error?.code || error?.errorCode || 'IMPORT_ERROR',
    sheetName: error?.sheetName || context.sheetName || '',
    rowNumber: Number.isInteger(error?.rowNumber) ? error.rowNumber : 0,
    materialCode: String(error?.materialCode || context.materialCode || '').trim(),
    specModel: String(error?.specModel || context.specModel || '').trim(),
    supplierName: String(
      error?.supplierName
      || error?.supplierShortName
      || context.supplierName
      || context.supplierShortName
      || ''
    ).trim(),
    supplierCode: String(error?.supplierCode || context.supplierCode || '').trim(),
    message: String(error?.message || context.message || '导入数据校验失败').trim(),
  }))

export const parseRangeBaseSheet = (rows, options = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : []
  const requestedHeaderRowIndex = Number.isInteger(options.headerRowIndex)
    ? options.headerRowIndex
    : null
  const detectedHeader = requestedHeaderRowIndex == null
    ? scanRangeWorkbookHeaderRows(sourceRows).find((match) => match.isBaseHeader)
    : null
  const headerRowIndex = requestedHeaderRowIndex ?? detectedHeader?.rowIndex ?? -1

  if (headerRowIndex < 0 || !Array.isArray(sourceRows[headerRowIndex])) {
    const error = buildBaseError(
      'MISSING_BASE_HEADER',
      0,
      'header',
      '未找到包含“物料代码、供应商名称、供应商代码、规格型号”的基础资料表头'
    )
    return {
      ok: false,
      headerRowIndex: -1,
      columns: {},
      rows: [],
      errors: [enrichRangeImportError(error, { sheetName: options.sheetName })],
      duplicates: [],
    }
  }

  const headerRow = sourceRows[headerRowIndex]
  const columns = buildBaseColumns(headerRow)
  const missingHeaders = BASE_REQUIRED_HEADERS.filter((header) =>
    findExactHeaderColumn(headerRow, [header]) < 0
  )
  if (missingHeaders.length > 0) {
    const error = buildBaseError(
      'MISSING_BASE_HEADER',
      headerRowIndex + 1,
      'header',
      `基础资料表缺少必填表头：${missingHeaders.join('、')}`
    )
    return {
      ok: false,
      headerRowIndex,
      columns,
      rows: [],
      errors: [enrichRangeImportError(error, { sheetName: options.sheetName })],
      duplicates: [],
    }
  }

  const parsedRows = []
  const errors = []
  const duplicates = []
  const firstRowByKey = new Map()

  for (let rowIndex = headerRowIndex + 1; rowIndex < sourceRows.length; rowIndex += 1) {
    const sourceRow = sourceRows[rowIndex]
    if (!Array.isArray(sourceRow)) continue

    const raw = Object.fromEntries(
      Object.entries(columns).map(([field, columnIndex]) => [
        field,
        readBaseCell(sourceRow, columnIndex),
      ])
    )
    const hasBusinessValue = [
      raw.materialCode,
      raw.materialName,
      raw.specModel,
      raw.supplierName,
      raw.supplierCode,
    ].some((value) => String(value ?? '').trim() !== '')
    if (!hasBusinessValue) continue

    const rowNumber = rowIndex + 1
    const supplierName = toOriginalText(raw.supplierName)
    const supplierCodeRaw = toOriginalText(raw.supplierCode)
    const supplierCode = toTrimmedText(raw.supplierCode)
    const materialCode = toTrimmedText(raw.materialCode)
    const specModel = toOriginalText(raw.specModel)
    const normalizedSpec = normalizeRangeBaseSpec(specModel)
    const normalizedSupplierName = normalizeRangeBaseSupplierName(supplierName)
    const normalizedSupplierCode = normalizeRangeBaseSupplierCode(supplierCode)
    const supplierIdentityKey = normalizedSupplierCode
      ? `CODE:${normalizedSupplierCode}`
      : normalizedSupplierName
        ? `NAME:${normalizedSupplierName}`
        : ''
    const effectiveFrom = parseRangeBaseDate(raw.effectiveFrom)
    const effectiveTo = parseRangeBaseDate(raw.effectiveTo)
    const taxIncluded = parseRangeBaseBoolean(raw.taxIncluded)

    const parsedRow = {
      sourceRowNumber: rowNumber,
      orgCode: toTrimmedText(raw.orgCode),
      sourceName: toTrimmedText(raw.sourceName),
      supplierName,
      supplierNameRaw: raw.supplierName,
      supplierCode,
      supplierCodeRaw: raw.supplierCode,
      purchaseClass: toTrimmedText(raw.purchaseClass),
      materialName: toTrimmedText(raw.materialName),
      materialCode,
      specModel,
      specModelRaw: raw.specModel,
      unit: toTrimmedText(raw.unit),
      taxIncluded,
      taxIncludedRaw: raw.taxIncluded,
      effectiveFrom,
      effectiveFromRaw: raw.effectiveFrom,
      effectiveTo,
      effectiveToRaw: raw.effectiveTo,
      orderType: toTrimmedText(raw.orderType),
      normalizedSpec,
      normalizedSupplierName,
      normalizedSupplierCode,
      supplierIdentityKey,
    }
    parsedRows.push(parsedRow)

    if (!materialCode) {
      errors.push(buildBaseError(
        'MISSING_MATERIAL_CODE',
        rowNumber,
        'materialCode',
        `基础资料第${rowNumber}行物料代码为空`
      ))
    }
    if (!supplierName.trim()) {
      errors.push(buildBaseError(
        'MISSING_SUPPLIER_NAME',
        rowNumber,
        'supplierName',
        `基础资料第${rowNumber}行供应商名称为空`
      ))
    }
    if (!normalizedSpec) {
      errors.push(buildBaseError(
        'MISSING_SPEC_MODEL',
        rowNumber,
        'specModel',
        `基础资料第${rowNumber}行规格型号为空`
      ))
    }
    if (String(raw.taxIncluded ?? '').trim() && taxIncluded == null) {
      errors.push(buildBaseError(
        'INVALID_TAX_INCLUDED',
        rowNumber,
        'taxIncluded',
        `基础资料第${rowNumber}行是否含税“${raw.taxIncluded}”无法识别`
      ))
    }
    if (String(raw.effectiveFrom ?? '').trim() && !effectiveFrom) {
      errors.push(buildBaseError(
        'INVALID_EFFECTIVE_FROM',
        rowNumber,
        'effectiveFrom',
        `基础资料第${rowNumber}行生效日期“${raw.effectiveFrom}”无法识别`
      ))
    }
    if (String(raw.effectiveTo ?? '').trim() && !effectiveTo) {
      errors.push(buildBaseError(
        'INVALID_EFFECTIVE_TO',
        rowNumber,
        'effectiveTo',
        `基础资料第${rowNumber}行失效日期“${raw.effectiveTo}”无法识别`
      ))
    }

    const duplicateKey = materialCode && normalizedSpec && supplierIdentityKey
      ? `${materialCode.toUpperCase()}|${normalizedSpec}|${supplierIdentityKey}`
      : ''
    if (duplicateKey) {
      const firstRowNumber = firstRowByKey.get(duplicateKey)
      if (firstRowNumber) {
        const duplicate = {
          key: duplicateKey,
          firstRowNumber,
          duplicateRowNumber: rowNumber,
        }
        duplicates.push(duplicate)
        errors.push(buildBaseError(
          'DUPLICATE_BASE_ROW',
          rowNumber,
          'row',
          `基础资料第${rowNumber}行与第${firstRowNumber}行重复`,
          { firstRowNumber }
        ))
      } else {
        firstRowByKey.set(duplicateKey, rowNumber)
      }
    }
  }

  return {
    ok: errors.length === 0,
    headerRowIndex,
    columns,
    rows: parsedRows,
    errors: errors.map((error) => {
      const row = parsedRows.find((item) => item.sourceRowNumber === error.rowNumber) || {}
      return enrichRangeImportError(error, {
        sheetName: options.sheetName,
        materialCode: row.materialCode,
        specModel: row.specModel,
        supplierName: row.supplierName,
        supplierCode: row.supplierCode,
      })
    }),
    duplicates,
  }
}

const parseRangeHeaderCandidate = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  const match = text.match(
    /^(.*?)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(?:元\s*\/\s*吨|元每吨)?\s*[—–\-~～至到]+\s*(\d+(?:\.\d+)?)\s*(?:元\s*\/\s*吨|元每吨)?\s*$/i
  )
  if (!match) {
    return null
  }
  const rangeLow = Number(match[2])
  const rangeHigh = Number(match[3])
  if (!Number.isFinite(rangeLow) || !Number.isFinite(rangeHigh)) {
    return null
  }
  return {
    prefix: String(match[1] ?? '').replace(/[：:\s\u3000]+/g, '').trim(),
    rangeLow,
    rangeHigh,
    invalidCode: rangeLow > rangeHigh ? 'RANGE_LOW_GT_HIGH' : '',
    rawHeader: value,
  }
}

const parseRangeHeader = (value) => {
  const parsed = parseRangeHeaderCandidate(value)
  return parsed && !parsed.invalidCode ? parsed : null
}

const isExclTaxSubHeader = (value) => {
  const text = normalizeWorkbookHeader(value)
  return text === '不含税' || text === '不含税价' || text === '未税' || text === '未税价'
}

const isInclTaxSubHeader = (value) => {
  const text = normalizeWorkbookHeader(value)
  return text === '含税' || text === '含税价'
}

const findRangeGroups = (headerRow, subHeaderRow) => {
  const header = Array.isArray(headerRow) ? headerRow : []
  const subHeader = Array.isArray(subHeaderRow) ? subHeaderRow : []
  const rangeColumns = header
    .map((cell, columnIndex) => {
      const range = parseRangeHeader(cell)
      return range ? { ...range, columnIndex } : null
    })
    .filter(Boolean)

  return rangeColumns.map((range, index) => {
    const nextRangeColumn = rangeColumns[index + 1]?.columnIndex
    const endColumn = nextRangeColumn == null
      ? Math.max(header.length, subHeader.length)
      : nextRangeColumn
    const subHeaders = subHeader.slice(range.columnIndex, endColumn)
    return {
      ...range,
      hasExclTax: subHeaders.some(isExclTaxSubHeader),
      hasInclTax: subHeaders.some(isInclTaxSubHeader),
    }
  })
}

const decodeWorksheetAddress = (address) => {
  const match = String(address ?? '').replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  let columnIndex = 0
  for (const character of match[1].toUpperCase()) {
    columnIndex = columnIndex * 26 + character.charCodeAt(0) - 64
  }
  return {
    rowIndex: Number(match[2]) - 1,
    columnIndex: columnIndex - 1,
  }
}

const encodeWorksheetColumn = (columnIndex) => {
  let value = columnIndex + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

const encodeWorksheetAddress = (rowIndex, columnIndex) =>
  `${encodeWorksheetColumn(columnIndex)}${rowIndex + 1}`

export const collectRangeFormulaCells = (worksheet) => {
  const formulaCells = {}
  Object.entries(worksheet || {}).forEach(([address, cell]) => {
    if (address.startsWith('!') || !cell || cell.f == null) {
      return
    }
    const decoded = decodeWorksheetAddress(address)
    if (!decoded) {
      return
    }
    formulaCells[`${decoded.rowIndex}:${decoded.columnIndex}`] = {
      address,
      formula: String(cell.f),
      cachePresent: Object.prototype.hasOwnProperty.call(cell, 'v'),
      cachedValue: cell.v,
      cellType: String(cell.t ?? ''),
      displayValue: cell.w ?? '',
    }
  })
  return formulaCells
}

export const collectRangeMergedCellValues = (worksheet) => {
  const mergedValues = {}
  const mergedRanges = Array.isArray(worksheet?.['!merges']) ? worksheet['!merges'] : []
  mergedRanges.forEach((range) => {
    const startRow = Number(range?.s?.r)
    const startColumn = Number(range?.s?.c)
    const endRow = Number(range?.e?.r)
    const endColumn = Number(range?.e?.c)
    if (
      ![startRow, startColumn, endRow, endColumn].every(Number.isInteger)
      || startRow > endRow
      || startColumn > endColumn
    ) {
      return
    }
    const sourceCell = worksheet[encodeWorksheetAddress(startRow, startColumn)]
    const sourceValue = sourceCell?.v ?? sourceCell?.w ?? ''
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        mergedValues[`${rowIndex}:${columnIndex}`] = sourceValue
      }
    }
  })
  return mergedValues
}

const findType1HeaderRowIndex = (rows) =>
  rows.findIndex((row, rowIndex) => {
    if (!rowContainsAllHeaders(row, TYPE1_REQUIRED_HEADERS)) {
      return false
    }
    const hasRange = (Array.isArray(row) ? row : []).some((cell) =>
      Boolean(parseRangeHeaderCandidate(cell))
    )
    const subHeader = rows[rowIndex + 1] || []
    const hasPriceSubHeader = subHeader.some(
      (cell) => isExclTaxSubHeader(cell) || isInclTaxSubHeader(cell)
    )
    return hasRange && hasPriceSubHeader
  })

const readType1Cell = (rows, rowIndex, columnIndex, mergedCellValues = {}) => {
  if (columnIndex < 0) return ''
  const sourceValue = Array.isArray(rows[rowIndex]) ? rows[rowIndex][columnIndex] : ''
  if (String(sourceValue ?? '').trim() !== '') {
    return sourceValue
  }
  return mergedCellValues[`${rowIndex}:${columnIndex}`] ?? ''
}

const buildType1Error = (code, message, extra = {}) => ({
  code,
  message,
  ...extra,
})

const isExcelErrorValue = (value) =>
  /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA)$/i.test(
    String(value ?? '').trim()
  )

const parseNumericPrice = (value) => {
  if (value == null || String(value).trim() === '') {
    return { value: null, errorCode: '' }
  }
  if (isExcelErrorValue(value)) {
    return { value: null, errorCode: 'EXCEL_PRICE_ERROR' }
  }
  if (typeof value === 'boolean') {
    return { value: null, errorCode: 'NON_NUMERIC_PRICE' }
  }
  const normalized = typeof value === 'number'
    ? value
    : String(value).replace(/,/g, '').trim()
  const numberValue = Number(normalized)
  if (!Number.isFinite(numberValue)) {
    return { value: null, errorCode: 'NON_NUMERIC_PRICE' }
  }
  return { value: numberValue, errorCode: '' }
}

const readType1Price = ({
  rows,
  rowIndex,
  columnIndex,
  formulaCells,
  mergedCellValues,
  priceKind,
}) => {
  if (columnIndex == null || columnIndex < 0) {
    return { value: null, error: null }
  }
  const address = encodeWorksheetAddress(rowIndex, columnIndex)
  const formulaCell = formulaCells[`${rowIndex}:${columnIndex}`]
  const rawValue = readType1Cell(rows, rowIndex, columnIndex, mergedCellValues)
  const rowNumber = rowIndex + 1
  const columnNumber = columnIndex + 1

  if (formulaCell) {
    if (
      String(formulaCell.cellType ?? '').toLowerCase() === 'e'
      || isExcelErrorValue(formulaCell.cachedValue)
    ) {
      return {
        value: null,
        error: buildType1Error(
          'EXCEL_PRICE_ERROR',
          `Sheet1第${rowNumber}行单元格${formulaCell.address || address}为Excel错误值`,
          { rowNumber, columnNumber, address: formulaCell.address || address, priceKind }
        ),
      }
    }
    if (
      formulaCell.cachePresent === false
      || formulaCell.cachedValue == null
      || String(formulaCell.cachedValue).trim() === ''
    ) {
      return {
        value: null,
        error: buildType1Error(
          'MISSING_FORMULA_CACHE',
          `Sheet1第${rowNumber}行公式单元格${formulaCell.address || address}没有已保存的计算结果`,
          { rowNumber, columnNumber, address: formulaCell.address || address, priceKind }
        ),
      }
    }
    const cachedResult = parseNumericPrice(formulaCell.cachedValue)
    if (cachedResult.errorCode) {
      return {
        value: null,
        error: buildType1Error(
          cachedResult.errorCode,
          `Sheet1第${rowNumber}行公式单元格${formulaCell.address || address}的缓存结果不是有效数字`,
          { rowNumber, columnNumber, address: formulaCell.address || address, priceKind }
        ),
      }
    }
    return { value: cachedResult.value, error: null }
  }

  const parsed = parseNumericPrice(rawValue)
  if (!parsed.errorCode) {
    return { value: parsed.value, error: null }
  }
  const message = parsed.errorCode === 'EXCEL_PRICE_ERROR'
    ? `Sheet1第${rowNumber}行单元格${address}为Excel错误值`
    : `Sheet1第${rowNumber}行单元格${address}的价格“${rawValue}”不是有效数字`
  return {
    value: null,
    error: buildType1Error(
      parsed.errorCode,
      message,
      { rowNumber, columnNumber, address, priceKind, rawValue }
    ),
  }
}

const buildType1Intervals = (headerRow, subHeaderRow) => {
  const header = Array.isArray(headerRow) ? headerRow : []
  const subHeader = Array.isArray(subHeaderRow) ? subHeaderRow : []
  const rangeHeaders = header
    .map((cell, columnIndex) => {
      const parsed = parseRangeHeaderCandidate(cell)
      return parsed ? { ...parsed, columnIndex } : null
    })
    .filter(Boolean)

  return rangeHeaders.map((range, intervalIndex) => {
    const nextColumn = rangeHeaders[intervalIndex + 1]?.columnIndex
    const endColumn = nextColumn == null
      ? Math.max(header.length, subHeader.length)
      : nextColumn
    let priceExclTaxColumn = null
    let priceInclTaxColumn = null
    for (let columnIndex = range.columnIndex; columnIndex < endColumn; columnIndex += 1) {
      if (isExclTaxSubHeader(subHeader[columnIndex])) {
        priceExclTaxColumn = columnIndex
      }
      if (isInclTaxSubHeader(subHeader[columnIndex])) {
        priceInclTaxColumn = columnIndex
      }
    }
    return {
      intervalIndex,
      prefix: range.prefix,
      rawHeader: range.rawHeader,
      rangeLow: range.rangeLow,
      rangeHigh: range.rangeHigh,
      invalidCode: range.invalidCode,
      columnIndex: range.columnIndex,
      priceExclTaxColumn,
      priceInclTaxColumn,
    }
  })
}

export const parseRangeType1Sheet = (rows, options = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : []
  const formulaCells = options.formulaCells || {}
  const mergedCellValues = options.mergedCellValues || {}
  const headerRowIndex = Number.isInteger(options.headerRowIndex)
    ? options.headerRowIndex
    : findType1HeaderRowIndex(sourceRows)
  const subHeaderRowIndex = Number.isInteger(options.subHeaderRowIndex)
    ? options.subHeaderRowIndex
    : headerRowIndex >= 0 ? headerRowIndex + 1 : -1

  if (
    headerRowIndex < 0
    || subHeaderRowIndex < 0
    || !Array.isArray(sourceRows[headerRowIndex])
    || !Array.isArray(sourceRows[subHeaderRowIndex])
  ) {
    return {
      ok: false,
      headerRowIndex,
      subHeaderRowIndex,
      columns: {},
      factor: null,
      intervals: [],
      rows: [],
      intervalRows: [],
      unmatchedRows: [],
      errors: [enrichRangeImportError(buildType1Error(
        'MISSING_TYPE1_HEADER',
        '未找到包含“名称、规格、供方、行情区间和价格子表头”的Sheet1双层表头'
      ), { sheetName: options.sheetName })],
    }
  }

  const headerRow = sourceRows[headerRowIndex]
  const subHeaderRow = sourceRows[subHeaderRowIndex]
  const columns = {
    materialName: findExactHeaderColumn(headerRow, ['名称']),
    specModel: findExactHeaderColumn(headerRow, ['规格']),
    supplierShortName: findExactHeaderColumn(headerRow, ['供方']),
    remark: findExactHeaderColumn(headerRow, ['备注']),
  }
  const errors = []
  const intervals = buildType1Intervals(headerRow, subHeaderRow)

  if (intervals.length === 0) {
    errors.push(buildType1Error(
      'MISSING_RANGE_HEADER',
      `Sheet1第${headerRowIndex + 1}行未找到可识别的行情区间`
    ))
  }

  intervals.forEach((interval) => {
    if (interval.invalidCode === 'RANGE_LOW_GT_HIGH') {
      errors.push(buildType1Error(
        'RANGE_LOW_GT_HIGH',
        `Sheet1第${headerRowIndex + 1}行区间“${interval.rawHeader}”下限不能大于上限`,
        {
          rowNumber: headerRowIndex + 1,
          columnNumber: interval.columnIndex + 1,
          rangeLow: interval.rangeLow,
          rangeHigh: interval.rangeHigh,
        }
      ))
    }
    if (
      interval.priceExclTaxColumn == null
      && interval.priceInclTaxColumn == null
    ) {
      errors.push(buildType1Error(
        'MISSING_PRICE_SUBHEADER',
        `Sheet1区间“${interval.rawHeader}”下未找到“含税”或“不含税”子表头`,
        {
          rowNumber: subHeaderRowIndex + 1,
          columnNumber: interval.columnIndex + 1,
        }
      ))
    }
  })

  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1]
    const current = intervals[index]
    if (previous.invalidCode || current.invalidCode) continue
    if (current.rangeLow === previous.rangeHigh) {
      errors.push(buildType1Error(
        'DUPLICATE_RANGE_BOUNDARY',
        `Sheet1相邻区间${previous.rangeLow}-${previous.rangeHigh}与${current.rangeLow}-${current.rangeHigh}重复边界`,
        { previousIntervalIndex: index - 1, intervalIndex: index }
      ))
    } else if (current.rangeLow < previous.rangeHigh) {
      errors.push(buildType1Error(
        'OVERLAPPING_RANGES',
        `Sheet1区间${previous.rangeLow}-${previous.rangeHigh}与${current.rangeLow}-${current.rangeHigh}发生重叠`,
        { previousIntervalIndex: index - 1, intervalIndex: index }
      ))
    }
  }

  const configuredFactor = options.factor
    ? findRangeFactorOption(options.factor.code || options.factor)
    : null
  const detectedFactorCode = intervals
    .map((interval) => detectFactorCodeFromText(interval.prefix))
    .find(Boolean)
  const factor = configuredFactor
    || findRangeFactorOption(detectedFactorCode)
    || detectRangeFactorFromSheetContent(sourceRows, headerRowIndex)
  if (!factor) {
    errors.push(buildType1Error(
      'MISSING_RANGE_FACTOR',
      `Sheet1第${headerRowIndex + 1}行无法识别区间影响因素`
    ))
  }

  const parsedRows = []
  const intervalRows = []
  for (let rowIndex = subHeaderRowIndex + 1; rowIndex < sourceRows.length; rowIndex += 1) {
    const materialNameRaw = readType1Cell(
      sourceRows,
      rowIndex,
      columns.materialName,
      mergedCellValues
    )
    const specModelRaw = readType1Cell(
      sourceRows,
      rowIndex,
      columns.specModel,
      mergedCellValues
    )
    const supplierShortNameRaw = readType1Cell(
      sourceRows,
      rowIndex,
      columns.supplierShortName,
      mergedCellValues
    )
    const hasBusinessValue = [materialNameRaw, specModelRaw, supplierShortNameRaw]
      .some((value) => String(value ?? '').trim() !== '')
    if (!hasBusinessValue) {
      continue
    }

    const rowNumber = rowIndex + 1
    const materialName = toTrimmedText(materialNameRaw)
    const specModel = toOriginalText(specModelRaw)
    const supplierShortName = toTrimmedText(supplierShortNameRaw)
    const remark = toTrimmedText(readType1Cell(
      sourceRows,
      rowIndex,
      columns.remark,
      mergedCellValues
    ))
    const normalizedSpec = normalizeRangeBaseSpec(specModel)
    const normalizedSupplierShortName = normalizeRangeBaseSupplierName(supplierShortName)
    const parsedIntervals = []

    if (!normalizedSpec) {
      errors.push(buildType1Error(
        'MISSING_RANGE_SPEC',
        `Sheet1第${rowNumber}行业务规格为空`,
        { rowNumber, field: 'specModel' }
      ))
    }
    if (!supplierShortName) {
      errors.push(buildType1Error(
        'MISSING_RANGE_SUPPLIER',
        `Sheet1第${rowNumber}行供方简称为空`,
        { rowNumber, field: 'supplierShortName' }
      ))
    }

    intervals.forEach((interval) => {
      if (interval.invalidCode) return
      const exclResult = readType1Price({
        rows: sourceRows,
        rowIndex,
        columnIndex: interval.priceExclTaxColumn,
        formulaCells,
        mergedCellValues,
        priceKind: 'priceExclTax',
      })
      const inclResult = readType1Price({
        rows: sourceRows,
        rowIndex,
        columnIndex: interval.priceInclTaxColumn,
        formulaCells,
        mergedCellValues,
        priceKind: 'priceInclTax',
      })
      if (exclResult.error) errors.push(enrichRangeImportError(exclResult.error, {
        materialName,
        specModel,
        supplierShortName,
      }))
      if (inclResult.error) errors.push(enrichRangeImportError(inclResult.error, {
        materialName,
        specModel,
        supplierShortName,
      }))
      if (exclResult.error || inclResult.error) {
        return
      }
      if (exclResult.value == null && inclResult.value == null) {
        errors.push(buildType1Error(
          'EMPTY_RANGE_PRICE',
          `Sheet1第${rowNumber}行区间${interval.rangeLow}-${interval.rangeHigh}的含税价和不含税价都为空`,
          {
            rowNumber,
            intervalIndex: interval.intervalIndex,
            rangeLow: interval.rangeLow,
            rangeHigh: interval.rangeHigh,
          }
        ))
        return
      }

      const parsedInterval = {
        intervalIndex: interval.intervalIndex,
        rangeLow: interval.rangeLow,
        rangeHigh: interval.rangeHigh,
        priceExclTax: exclResult.value,
        priceInclTax: inclResult.value,
      }
      parsedIntervals.push(parsedInterval)
      intervalRows.push({
        sourceRowNumber: rowNumber,
        materialName,
        specModel,
        specModelRaw,
        normalizedSpec,
        supplierShortName,
        supplierShortNameRaw,
        normalizedSupplierShortName,
        remark,
        factorCode: factor?.code || '',
        factorName: factor?.factorName || '',
        factorUnit: factor?.factorUnit || '',
        ...parsedInterval,
      })
    })

    parsedRows.push({
      sourceRowNumber: rowNumber,
      materialName,
      materialNameRaw,
      specModel,
      specModelRaw,
      normalizedSpec,
      supplierShortName,
      supplierShortNameRaw,
      normalizedSupplierShortName,
      remark,
      intervals: parsedIntervals,
    })
  }

  return {
    ok: errors.length === 0,
    headerRowIndex,
    subHeaderRowIndex,
    columns,
    factor,
    intervals: intervals.map((interval) => ({
      intervalIndex: interval.intervalIndex,
      rangeLow: interval.rangeLow,
      rangeHigh: interval.rangeHigh,
      priceExclTaxColumn: interval.priceExclTaxColumn,
      priceInclTaxColumn: interval.priceInclTaxColumn,
      rawHeader: interval.rawHeader,
    })),
    rows: parsedRows,
    intervalRows,
    unmatchedRows: intervalRows,
    errors: errors.map((error) => {
      const row = parsedRows.find((item) => item.sourceRowNumber === error.rowNumber) || {}
      return enrichRangeImportError(error, {
        sheetName: options.sheetName,
        specModel: row.specModel,
        supplierShortName: row.supplierShortName,
      })
    }),
  }
}

const isSupplierShortNameMatch = (supplierShortName, supplierFullName) => {
  const shortName = normalizeRangeBaseSupplierName(supplierShortName)
  const fullName = normalizeRangeBaseSupplierName(supplierFullName)
  if (!shortName || !fullName) {
    return false
  }
  return shortName === fullName
    || fullName.includes(shortName)
    || shortName.includes(fullName)
}

const buildRangeMatchError = (code, rowNumber, field, message, extra = {}) => ({
  code,
  rowNumber,
  field,
  message,
  ...extra,
})

const buildRangePreviewRow = (businessRow) => ({
  sourceRowNumber: businessRow.sourceRowNumber,
  materialName: businessRow.materialName || '',
  specModel: businessRow.specModel || '',
  supplierShortName: businessRow.supplierShortName || '',
  materialCode: '',
  supplierName: '',
  supplierCode: '',
  intervalCount: Array.isArray(businessRow.intervals) ? businessRow.intervals.length : 0,
  matchStatus: 'FAILED',
  matchStatusLabel: '匹配失败',
  errorCode: '',
  errorField: '',
  errorReason: '',
  candidateMaterialCodes: [],
  candidateSupplierNames: [],
})

const toMatchedRangeRow = (businessRow, baseRow) => {
  const normalizedSupplierName = baseRow.normalizedSupplierName
    || normalizeRangeBaseSupplierName(baseRow.supplierName)
  const normalizedSupplierCode = baseRow.normalizedSupplierCode
    || normalizeRangeBaseSupplierCode(baseRow.supplierCode)
  const supplierIdentityKey = normalizedSupplierCode
    ? `CODE:${normalizedSupplierCode}`
    : normalizedSupplierName
      ? `NAME:${normalizedSupplierName}`
      : ''

  return {
    ...businessRow,
    baseSourceRowNumber: baseRow.sourceRowNumber,
    materialCode: baseRow.materialCode || '',
    supplierName: baseRow.supplierName || '',
    supplierCode: baseRow.supplierCode || '',
    supplierIdentityKey,
    orgCode: baseRow.orgCode || '',
    sourceName: baseRow.sourceName || '',
    purchaseClass: baseRow.purchaseClass || '',
    unit: baseRow.unit || '',
    taxIncluded: baseRow.taxIncluded ?? null,
    effectiveFrom: baseRow.effectiveFrom || '',
    effectiveTo: baseRow.effectiveTo || '',
    orderType: baseRow.orderType || '',
    baseSpecModel: baseRow.specModel || '',
  }
}

export const matchRangeType1Rows = (baseRows, businessRows, options = {}) => {
  const sourceBaseRows = Array.isArray(baseRows) ? baseRows : []
  const sourceBusinessRows = Array.isArray(businessRows) ? businessRows : []
  const previewRows = []
  const matchedRows = []
  const errors = []

  sourceBusinessRows.forEach((businessRow) => {
    const previewRow = buildRangePreviewRow(businessRow)
    const rowNumber = businessRow.sourceRowNumber
    const normalizedSpec = businessRow.normalizedSpec
      || normalizeRangeBaseSpec(businessRow.specModel)
    const normalizedSupplierShortName = businessRow.normalizedSupplierShortName
      || normalizeRangeBaseSupplierName(businessRow.supplierShortName)
    const specCandidates = sourceBaseRows.filter((baseRow) => {
      const baseSpec = baseRow.normalizedSpec || normalizeRangeBaseSpec(baseRow.specModel)
      return normalizedSpec && baseSpec === normalizedSpec
    })

    if (specCandidates.length === 0) {
      const error = buildRangeMatchError(
        'NO_SPEC_MATCH',
        rowNumber,
        'specModel',
        `Sheet1第${rowNumber}行规格“${businessRow.specModel || ''}”在基础资料中没有匹配项`
      )
      Object.assign(previewRow, {
        errorCode: error.code,
        errorField: error.field,
        errorReason: error.message,
      })
      errors.push(error)
      previewRows.push(previewRow)
      return
    }

    const candidatesWithIdentity = specCandidates.filter((baseRow) =>
      String(baseRow.supplierName ?? '').trim() !== ''
      || String(baseRow.supplierCode ?? '').trim() !== ''
    )
    if (candidatesWithIdentity.length === 0) {
      const error = buildRangeMatchError(
        'MISSING_SUPPLIER_IDENTITY',
        rowNumber,
        'supplierShortName',
        `Sheet1第${rowNumber}行对应的基础资料供应商名称和代码都为空`,
        { baseRowNumbers: specCandidates.map((row) => row.sourceRowNumber) }
      )
      Object.assign(previewRow, {
        errorCode: error.code,
        errorField: error.field,
        errorReason: error.message,
      })
      errors.push(error)
      previewRows.push(previewRow)
      return
    }

    const supplierCandidates = specCandidates.filter((baseRow) =>
      isSupplierShortNameMatch(
        normalizedSupplierShortName,
        baseRow.normalizedSupplierName || baseRow.supplierName
      )
    )
    if (supplierCandidates.length === 0) {
      const error = buildRangeMatchError(
        'NO_SUPPLIER_MATCH',
        rowNumber,
        'supplierShortName',
        `Sheet1第${rowNumber}行规格已找到${specCandidates.length}条基础资料，但供方简称“${businessRow.supplierShortName || ''}”没有匹配项`,
        {
          candidateSupplierNames: specCandidates
            .map((row) => row.supplierName)
            .filter(Boolean),
        }
      )
      Object.assign(previewRow, {
        errorCode: error.code,
        errorField: error.field,
        errorReason: error.message,
        candidateSupplierNames: error.candidateSupplierNames,
      })
      errors.push(error)
      previewRows.push(previewRow)
      return
    }

    if (supplierCandidates.length > 1) {
      const candidateMaterialCodes = supplierCandidates
        .map((row) => row.materialCode || '')
      const candidateSupplierNames = supplierCandidates
        .map((row) => row.supplierName || '')
      const error = buildRangeMatchError(
        'MULTIPLE_SUPPLIER_MATCH',
        rowNumber,
        'supplierShortName',
        `Sheet1第${rowNumber}行规格和供方简称匹配到${supplierCandidates.length}条基础资料，不能自动选择`,
        {
          candidateMaterialCodes,
          candidateSupplierNames,
          baseRowNumbers: supplierCandidates.map((row) => row.sourceRowNumber),
        }
      )
      Object.assign(previewRow, {
        matchStatus: 'CONFLICT',
        matchStatusLabel: '匹配冲突',
        errorCode: error.code,
        errorField: error.field,
        errorReason: error.message,
        candidateMaterialCodes,
        candidateSupplierNames,
      })
      errors.push(error)
      previewRows.push(previewRow)
      return
    }

    const baseRow = supplierCandidates[0]
    const matchedRow = toMatchedRangeRow(businessRow, baseRow)
    if (!matchedRow.supplierIdentityKey) {
      const error = buildRangeMatchError(
        'MISSING_SUPPLIER_IDENTITY',
        rowNumber,
        'supplierShortName',
        `Sheet1第${rowNumber}行匹配到的基础资料供应商名称和代码都为空`,
        { baseRowNumber: baseRow.sourceRowNumber }
      )
      Object.assign(previewRow, {
        errorCode: error.code,
        errorField: error.field,
        errorReason: error.message,
      })
      errors.push(error)
      previewRows.push(previewRow)
      return
    }

    matchedRows.push(matchedRow)
    Object.assign(previewRow, {
      materialCode: matchedRow.materialCode,
      supplierName: matchedRow.supplierName,
      supplierCode: matchedRow.supplierCode,
      matchStatus: 'MATCHED',
      matchStatusLabel: '匹配成功',
    })
    previewRows.push(previewRow)
  })

  if (sourceBusinessRows.length === 0) {
    errors.push(buildRangeMatchError(
      'NO_RANGE_BUSINESS_ROWS',
      0,
      'rows',
      'Sheet1没有可匹配的业务行'
    ))
  }

  const conflictCount = previewRows.filter((row) => row.matchStatus === 'CONFLICT').length
  const matchedCount = previewRows.filter((row) => row.matchStatus === 'MATCHED').length
  const summary = {
    totalCount: previewRows.length,
    matchedCount,
    failedCount: previewRows.length - matchedCount,
    conflictCount,
  }
  const ok = errors.length === 0 && previewRows.length > 0
  return {
    ok,
    canSubmit: ok,
    previewRows,
    matchedRows,
    errors: errors.map((error) => {
      const row = sourceBusinessRows.find(
        (item) => item.sourceRowNumber === error.rowNumber
      ) || {}
      return enrichRangeImportError(error, {
        sheetName: options.sheetName || 'Sheet1',
        materialCode: row.materialCode,
        specModel: row.specModel,
        supplierShortName: row.supplierShortName,
      })
    }),
    summary,
  }
}

const detectFactorCodeFromText = (value) => {
  const raw = String(value ?? '')
  const compact = normalizeRangeText(raw)
  if (!compact) return ''

  const directCode = RANGE_FACTOR_OPTIONS.find((option) => {
    const code = option.code.toLowerCase()
    return new RegExp(`(^|[^a-z0-9])${code}([^a-z0-9]|$)`, 'i').test(raw)
      || compact.startsWith(code)
  })
  if (directCode) {
    return directCode.code
  }

  const aliasMatch = FACTOR_ALIASES.find((item) =>
    item.aliases.some((alias) => compact.includes(normalizeRangeText(alias)))
  )
  return aliasMatch?.code || ''
}

export const detectRangeFactorFromSheetContent = (rows, headerRowIndex = -1) => {
  const sourceRows = Array.isArray(rows) ? rows : []
  const rangeStart = headerRowIndex >= 0 ? Math.max(0, headerRowIndex - 3) : 0
  const rangeEnd = headerRowIndex >= 0
    ? Math.min(sourceRows.length, headerRowIndex + 2)
    : sourceRows.length
  for (let rowIndex = rangeStart; rowIndex < rangeEnd; rowIndex += 1) {
    const row = Array.isArray(sourceRows[rowIndex]) ? sourceRows[rowIndex] : []
    for (const cell of row) {
      const factorCode = detectFactorCodeFromText(cell)
      if (factorCode) {
        return findRangeFactorOption(factorCode)
      }
    }
  }
  return null
}

export const scanRangeWorkbookHeaderRows = (rows) => {
  const sourceRows = Array.isArray(rows) ? rows : []
  const matches = []

  sourceRows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.every(isWorkbookCellEmpty)) {
      return
    }

    const subHeaderRow = sourceRows[rowIndex + 1] || []
    const rangeGroups = findRangeGroups(row, subHeaderRow)
    const type1RangeGroups = rangeGroups.filter(
      (group) => group.hasExclTax && group.hasInclTax
    )
    const isBaseHeader = rowContainsAllHeaders(row, BASE_REQUIRED_HEADERS)
    const isType1Header =
      rowContainsAllHeaders(row, TYPE1_REQUIRED_HEADERS) && type1RangeGroups.length > 0
    const hasMaterialCode = rowContainsHeader(row, MATERIAL_CODE_HEADERS)
    const isStandardMatrixHeader = hasMaterialCode && rangeGroups.length > 0
    const isStandardQuantityHeader =
      hasMaterialCode
      && rowContainsHeader(row, RANGE_LOW_HEADERS)
      && rowContainsHeader(row, RANGE_HIGH_HEADERS)
      && rowContainsHeader(row, PRICE_HEADERS)

    if (isBaseHeader || isType1Header || isStandardMatrixHeader || isStandardQuantityHeader) {
      matches.push({
        rowIndex,
        subHeaderRowIndex: rangeGroups.length > 0 ? rowIndex + 1 : null,
        isBaseHeader,
        isType1Header,
        isStandardHeader: isStandardMatrixHeader || isStandardQuantityHeader,
        rangeGroups: isType1Header ? type1RangeGroups : rangeGroups,
      })
    }
  })

  return matches
}

export const summarizeRangeWorkbookSheets = (sheetEntries) => {
  const entries = Array.isArray(sheetEntries) ? sheetEntries : []
  return entries
    .map((entry, sheetIndex) => ({
      name: String(entry?.name ?? `Sheet${sheetIndex + 1}`),
      rows: Array.isArray(entry?.rows) ? entry.rows : [],
      sheetIndex,
    }))
    .filter((entry) => !isSheetRowsEmpty(entry.rows))
    .map((entry) => {
      const headerMatches = scanRangeWorkbookHeaderRows(entry.rows)
      const baseMatch = headerMatches.find((match) => match.isBaseHeader) || null
      const type1Match = headerMatches.find((match) => match.isType1Header) || null
      const standardMatch = headerMatches.find((match) => match.isStandardHeader) || null
      const primaryMatch = type1Match || standardMatch
      const factor = primaryMatch
        ? detectRangeFactorFromSheetContent(entry.rows, primaryMatch.rowIndex)
        : null
      const columnCount = entry.rows.reduce(
        (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
        0
      )

      return {
        ...entry,
        rowCount: entry.rows.length,
        columnCount,
        headerMatches,
        isBaseCandidate: Boolean(baseMatch),
        isType1Candidate: Boolean(type1Match),
        isStandardCandidate: Boolean(standardMatch),
        baseHeaderRowIndex: baseMatch?.rowIndex ?? null,
        type1HeaderRowIndex: type1Match?.rowIndex ?? null,
        standardHeaderRowIndex: standardMatch?.rowIndex ?? null,
        subHeaderRowIndex: primaryMatch?.subHeaderRowIndex ?? null,
        rangeGroups: primaryMatch?.rangeGroups || [],
        factor,
      }
    })
}

const toRouteSheet = (summary, kind) => ({
  name: summary.name,
  sheetIndex: summary.sheetIndex,
  rows: summary.rows,
  rowCount: summary.rowCount,
  columnCount: summary.columnCount,
  headerRowIndex: kind === 'base'
    ? summary.baseHeaderRowIndex
    : kind === 'type1'
      ? summary.type1HeaderRowIndex
      : summary.standardHeaderRowIndex,
  subHeaderRowIndex: kind === 'base' ? null : summary.subHeaderRowIndex,
  rangeGroups: kind === 'base' ? [] : summary.rangeGroups,
})

const buildRouteError = (errorCode, message, summaries) => ({
  ok: false,
  route: null,
  errorCode,
  message,
  sheets: summaries,
})

const listCandidateNames = (candidates) =>
  candidates.map((item) => `“${item.name}”`).join('、')

export const detectRangeWorkbookRoute = (sheetEntries, _options = {}) => {
  const summaries = summarizeRangeWorkbookSheets(sheetEntries)
  const baseCandidates = summaries.filter((item) => item.isBaseCandidate)
  const type1Candidates = summaries.filter((item) => item.isType1Candidate)
  const standardCandidates = summaries.filter((item) => item.isStandardCandidate)

  if (type1Candidates.length > 1) {
    return buildRouteError(
      'MULTIPLE_RANGE_SHEETS',
      `识别到多个类型1区间价格Sheet：${listCandidateNames(type1Candidates)}，请只保留一个后重新导入`,
      summaries
    )
  }

  if (type1Candidates.length === 1) {
    if (baseCandidates.length > 1) {
      return buildRouteError(
        'MULTIPLE_BASE_SHEETS',
        `识别到多个基础资料Sheet：${listCandidateNames(baseCandidates)}，请只保留一个后重新导入`,
        summaries
      )
    }
    if (baseCandidates.length === 0) {
      return buildRouteError(
        'MISSING_BASE_SHEET',
        '已识别到类型1区间价格表，但未找到包含“物料代码、供应商名称、供应商代码、规格型号”的基础资料表',
        summaries
      )
    }

    const base = baseCandidates[0]
    const range = type1Candidates[0]
    return {
      ok: true,
      route: 'TYPE1',
      errorCode: '',
      message: `已识别类型1区间价：基础资料“${base.name}”，区间价格“${range.name}”`,
      sheets: summaries,
      baseSheet: toRouteSheet(base, 'base'),
      rangeSheet: toRouteSheet(range, 'type1'),
      standardSheet: null,
      factor: range.factor,
    }
  }

  if (standardCandidates.length > 1) {
    return buildRouteError(
      'MULTIPLE_STANDARD_SHEETS',
      `识别到多个原有区间价Sheet：${listCandidateNames(standardCandidates)}，请只保留一个后重新导入`,
      summaries
    )
  }

  if (standardCandidates.length === 1) {
    const standard = standardCandidates[0]
    return {
      ok: true,
      route: 'STANDARD',
      errorCode: '',
      message: `已识别原有区间价模板：“${standard.name}”`,
      sheets: summaries,
      baseSheet: null,
      rangeSheet: null,
      standardSheet: toRouteSheet(standard, 'standard'),
      factor: standard.factor,
    }
  }

  if (baseCandidates.length > 0) {
    return buildRouteError(
      'MISSING_RANGE_SHEET',
      '已识别到基础资料表，但未找到包含“名称、规格、供方、行情区间及含税/不含税子表头”的类型1区间价格表',
      summaries
    )
  }

  return buildRouteError(
    'NO_VALID_RANGE_TEMPLATE',
    '未找到可导入的区间价模板，请检查工作簿是否包含原有区间价表，或完整的类型1基础资料表和区间价格表',
    summaries
  )
}

export const formatRangeType = (row) => {
  const basis = String(row?.rangeBasis ?? '').trim().toUpperCase()
  if (basis === 'FACTOR') {
    return findRangeFactorOption(row?.factorCode)?.label || '行情区间'
  }
  return '数量区间'
}

export const formatCurrentStatus = (row) => (
  Number(row?.currentFlag ?? 1) === 0 ? '历史' : '当前'
)

export const buildRangeImportBatchNo = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())
  return `RANGE${year}${month}${day}${hour}${minute}${second}`
}

export const buildRangeImportPayload = (rows, options = {}) => {
  const factor = options.factor ? findRangeFactorOption(options.factor.code || options.factor) : null
  const rangeBasis = factor ? 'FACTOR' : 'QTY'
  const importRows = Array.isArray(rows) ? rows : []
  const firstUnitRow = importRows.find((row) => row?.unit)
  return {
    rangeBasis,
    factorCode: factor?.code || '',
    factorName: factor?.factorName || '',
    factorUnit: factor?.factorUnit || '',
    priceUnit: firstUnitRow?.unit || '',
    sourceFile: options.fileName || '',
    sourceSheet: options.sheetName || '',
    importBatchNo: options.importBatchNo || buildRangeImportBatchNo(),
    rows: importRows.map((row) => ({
      ...row,
      rangeBasis,
      factorCode: factor?.code || row.factorCode || '',
    })),
  }
}

const buildRangeType1RequestError = (code, message, extra = {}) => ({
  code,
  message,
  ...extra,
})

const blockedRangeType1Request = (errors, businessRowCount = 0) => ({
  ok: false,
  canSubmit: false,
  payload: null,
  expandedRows: [],
  businessRowCount,
  rowCount: 0,
  errors,
})

export const buildRangeType1ImportRequest = (matchResult, options = {}) => {
  const matchedRows = Array.isArray(matchResult?.matchedRows)
    ? matchResult.matchedRows
    : []
  const businessRowCount = Number(matchResult?.summary?.totalCount) || matchedRows.length
  const matchErrors = Array.isArray(matchResult?.errors) ? matchResult.errors : []

  if (!matchResult?.ok || !matchResult?.canSubmit || matchErrors.length > 0) {
    return blockedRangeType1Request(
      matchErrors.length > 0
        ? matchErrors
        : [buildRangeType1RequestError(
          'MATCH_NOT_READY',
          '跨Sheet匹配未全部成功，不能生成导入请求'
        )],
      businessRowCount
    )
  }

  const factor = findRangeFactorOption(options.factor?.code || options.factor)
  if (!factor) {
    return blockedRangeType1Request(
      [buildRangeType1RequestError(
        'MISSING_RANGE_FACTOR',
        '类型1区间价未识别到有效影响因素，不能生成导入请求'
      )],
      businessRowCount
    )
  }

  const errors = []
  const expandedRows = []
  matchedRows.forEach((matchedRow) => {
    const intervals = Array.isArray(matchedRow.intervals) ? matchedRow.intervals : []
    if (intervals.length === 0) {
      errors.push(buildRangeType1RequestError(
        'EMPTY_MATCHED_INTERVALS',
        `Sheet1第${matchedRow.sourceRowNumber || 0}行没有可导入的区间明细`,
        { rowNumber: matchedRow.sourceRowNumber || 0 }
      ))
      return
    }
    if (!matchedRow.effectiveFrom) {
      errors.push(buildRangeType1RequestError(
        'MISSING_EFFECTIVE_FROM',
        `Sheet1第${matchedRow.sourceRowNumber || 0}行匹配的基础资料缺少生效日期`,
        { rowNumber: matchedRow.sourceRowNumber || 0 }
      ))
      return
    }

    intervals.forEach((interval) => {
      expandedRows.push({
        orgCode: matchedRow.orgCode || '',
        sourceName: matchedRow.sourceName || '',
        supplierName: matchedRow.supplierName || '',
        supplierCode: matchedRow.supplierCode || '',
        purchaseClass: matchedRow.purchaseClass || '',
        materialName: matchedRow.materialName || '',
        materialCode: matchedRow.materialCode || '',
        specModel: matchedRow.specModel || '',
        unit: matchedRow.unit || '',
        rangeLow: interval.rangeLow,
        rangeHigh: interval.rangeHigh,
        priceExclTax: interval.priceExclTax,
        priceInclTax: interval.priceInclTax,
        taxIncluded: matchedRow.taxIncluded ?? null,
        effectiveFrom: matchedRow.effectiveFrom,
        effectiveTo: matchedRow.effectiveTo || '',
        orderType: matchedRow.orderType || '',
      })
    })
  })

  if (errors.length > 0 || expandedRows.length === 0) {
    return blockedRangeType1Request(
      errors.length > 0
        ? errors
        : [buildRangeType1RequestError(
          'NO_EXPANDED_RANGE_ROWS',
          '没有生成可导入的标准区间价明细'
        )],
      businessRowCount
    )
  }

  const payload = buildRangeImportPayload(expandedRows, {
    factor,
    fileName: options.fileName || '',
    sheetName: options.sheetName || '',
    importBatchNo: options.importBatchNo,
  })
  return {
    ok: true,
    canSubmit: true,
    payload,
    expandedRows: payload.rows,
    businessRowCount,
    rowCount: payload.rows.length,
    errors: [],
  }
}

export const submitRangeType1ImportRequest = async (requestResult, importItems) => {
  if (
    !requestResult?.ok
    || !requestResult?.canSubmit
    || !requestResult?.payload
    || (Array.isArray(requestResult?.errors) && requestResult.errors.length > 0)
  ) {
    return {
      submitted: false,
      response: null,
      reason: 'IMPORT_BLOCKED',
    }
  }
  if (typeof importItems !== 'function') {
    throw new TypeError('缺少区间价导入接口')
  }
  const response = await importItems(requestResult.payload)
  return {
    submitted: true,
    response,
    reason: '',
  }
}

export const buildRangePriceTypeApplyPayload = (conflicts, options = {}) => ({
  rows: (Array.isArray(conflicts) ? conflicts : [])
    .filter((item) => item?.materialCode)
    .map((item) => ({
      materialCode: item.materialCode,
      materialName: item.materialName || '',
      businessUnitType: item.businessUnitType || '',
      period: item.period || '',
      effectiveFrom: item.effectiveFrom || '',
      source: options.source || 'range-price-import',
    })),
})
