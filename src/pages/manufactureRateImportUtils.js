const HEADER_ALIASES = {
  businessDivision: ['事业部', '生产事业部'],
  productCategory: ['产品大类', '产品分类', '生产分类'],
  productCode: ['料号', '产品料号'],
  productName: ['产品名称', '品名'],
  productModel: ['产品型号', '型号'],
  productSpec: ['产品规格', '规格'],
  feeRate: ['制造费用率', '费用率'],
  remark: ['备注'],
}

export function normalizeManufactureRateHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()
}

export function selectManufactureRateSheetName(sheetNames) {
  const names = Array.isArray(sheetNames) ? sheetNames.filter(Boolean) : []
  const exact = names.find(
    (name) => normalizeManufactureRateHeader(name) === '制造费用',
  )
  if (exact) {
    return exact
  }
  const similar = names.find((name) =>
    normalizeManufactureRateHeader(name).includes('制造费用'),
  )
  if (similar) {
    return similar
  }
  return names.length === 1 ? names[0] : null
}

export function parseManufactureRate(value) {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  if (text.endsWith('%')) {
    const parsed = Number(text.slice(0, -1).trim())
    return Number.isNaN(parsed) ? null : parsed / 100
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

export function normalizeManufactureRatePlaceholder(value) {
  const text = String(value ?? '').trim()
  return text === '/' || text === '／' ? '' : text
}

export function normalizeManufactureRateModel(value) {
  const text = normalizeManufactureRatePlaceholder(value)
  const noteMatch = text.match(/^(.+?)[（(](仅含[^）)]+)[）)]$/)
  if (!noteMatch) {
    return { value: text, note: '' }
  }
  return {
    value: noteMatch[1].trim(),
    note: noteMatch[2].trim(),
  }
}

export function parseManufactureRateRows(rows, options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : []
  const rateYear = Number(options.rateYear) || new Date().getFullYear()
  const headerMap = buildHeaderMap()
  const headerKeys = Object.keys(headerMap).sort((a, b) => b.length - a.length)
  const resolveHeaderField = (cell) => {
    const normalized = normalizeManufactureRateHeader(cell)
    if (!normalized) {
      return null
    }
    if (headerMap[normalized]) {
      return headerMap[normalized]
    }
    const matched = headerKeys.find((key) => normalized.includes(key))
    return matched ? headerMap[matched] : null
  }
  const headerSearch = sourceRows.reduce(
    (best, row, index) => {
      const hitCount = (Array.isArray(row) ? row : []).reduce(
        (count, cell) => (resolveHeaderField(cell) ? count + 1 : count),
        0,
      )
      return hitCount > best.count ? { index, count: hitCount } : best
    },
    { index: -1, count: 0 },
  )
  if (headerSearch.index === -1 || headerSearch.count < 3) {
    return { rows: [], error: '未找到表头，请确认Excel格式是否正确' }
  }

  const fieldIndex = {}
  sourceRows[headerSearch.index].forEach((cell, index) => {
    const field = resolveHeaderField(cell)
    if (field) {
      fieldIndex[field] = index
    }
  })
  if (fieldIndex.feeRate === undefined) {
    return { rows: [], error: '缺少表头：制造费用率' }
  }

  const parsedRows = sourceRows
    .slice(headerSearch.index + 1)
    .map((row, index) => {
      const productModel = normalizeManufactureRateModel(readCell(row, fieldIndex.productModel))
      const rawRemark = readText(row, fieldIndex.remark)
      const remark = [rawRemark, productModel.note].filter(Boolean).join('；')
      const businessDivision = readText(row, fieldIndex.businessDivision)
      return {
        rowNo: headerSearch.index + index + 2,
        businessDivision,
        businessUnit: businessDivision,
        productCategory: readText(row, fieldIndex.productCategory),
        productCode: normalizeManufactureRatePlaceholder(readCell(row, fieldIndex.productCode)),
        productName: readText(row, fieldIndex.productName),
        productModel: productModel.value,
        productSpec: readText(row, fieldIndex.productSpec),
        feeRate: parseManufactureRate(readCell(row, fieldIndex.feeRate)),
        remark,
        rateYear,
        period: `${rateYear}-01`,
      }
    })
    .filter((row) =>
      row.feeRate !== null
      || row.businessDivision
      || row.productCategory
      || row.productCode
      || row.productName
      || row.productModel
      || row.productSpec
      || row.remark,
    )

  if (parsedRows.length === 0) {
    return { rows: [], error: '未解析到有效数据' }
  }
  return { rows: parsedRows, error: null }
}

function buildHeaderMap() {
  return Object.entries(HEADER_ALIASES).reduce((acc, [key, values]) => {
    values.forEach((value) => {
      acc[normalizeManufactureRateHeader(value)] = key
    })
    return acc
  }, {})
}

function readCell(row, index) {
  return index === undefined ? '' : row?.[index]
}

function readText(row, index) {
  return String(readCell(row, index) ?? '').trim()
}
