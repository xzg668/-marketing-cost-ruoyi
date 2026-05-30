export const TITLE_CONFIGS = [
  ['配置表一', '商用直销产品-国内产线', '商用直销产品', '国内产线'],
  ['配置表二', '商用直销产品-墨西哥产线', '商用直销产品', '墨西哥产线'],
  ['配置表三', '商用直销产品-越南事业部', '商用直销产品', '越南事业部'],
  ['配置表四', '家代商代销产品-国内产线', '家代商代销产品', '国内产线'],
  ['配置表五', '家代商代销产品-墨西哥产线', '家代商代销产品', '墨西哥产线'],
  ['配置表六', '家代商代销产品-越南事业部', '家代商代销产品', '越南事业部'],
]

const TITLE_BY_NAME = TITLE_CONFIGS.reduce((acc, [code, title, productCategory, productLine]) => {
  acc[normalizeLoose(`${code}:${title}`)] = { code, title, productCategory, productLine }
  acc[normalizeLoose(`${code}：${title}`)] = { code, title, productCategory, productLine }
  acc[normalizeLoose(title)] = { code, title, productCategory, productLine }
  return acc
}, {})

const HEADER_ALIASES = {
  company: ['公司'],
  businessUnit: ['生产事业部', '事业部'],
  applicantDepartment: ['申请部门', '部门'],
  applicantOffice: ['申请处室', '处室'],
  managementExpenseRate: ['管理费用', '管理费用率'],
  financeExpenseRate: ['财务费用', '财务费用率'],
  salesExpenseRate: ['营业费用', '营业费用率'],
  threeExpenseTotalRate: ['三项费用合计', '合计'],
  threeExpenseRate2025: ['2025三项费用', '2025 三项费用'],
  threeExpenseRate2026: ['2026三项费用', '2026 三项费用'],
  oemExpenseRate: ['OEM费用率', 'OEM费用', 'OEM'],
  overseasSales: ['是否通过海外销'],
  periodText: ['年份/期间', '年份期间', '期间', '年份'],
}

const REQUIRED_FIELDS = [
  'applicantDepartment',
  'applicantOffice',
  'managementExpenseRate',
  'financeExpenseRate',
  'salesExpenseRate',
  'threeExpenseTotalRate',
]

const TOLERANCE = 0.000001

export function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()
}

function normalizeLoose(value) {
  return normalizeHeader(value).replace(/[()（）\-—_]/g, '')
}

export function resolveTitle(value) {
  const normalized = normalizeLoose(value)
  if (!normalized) {
    return null
  }
  if (TITLE_BY_NAME[normalized]) {
    return TITLE_BY_NAME[normalized]
  }
  return Object.values(TITLE_BY_NAME).find((item) => normalized.includes(normalizeLoose(item.title))) || null
}

export function parseRate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const text = String(value).replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const hasPercent = text.includes('%')
  const parsed = Number(text.replace('%', ''))
  if (!Number.isFinite(parsed)) {
    return null
  }
  if (hasPercent || Math.abs(parsed) > 1) {
    return roundRate(parsed / 100)
  }
  return roundRate(parsed)
}

function roundRate(value) {
  return Number(value.toFixed(6))
}

export function parsePeriod(value) {
  const periodText = String(value || '').trim()
  if (!periodText) {
    return { periodYear: null }
  }
  const matched = periodText.match(/(\d{4})/)
  return {
    periodYear: matched ? Number(matched[1]) : null,
  }
}

export function parseThreeExpenseRateRows(rows, options = {}) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  const importBatchNo = options.importBatchNo || `TER-${Date.now()}`
  const defaultPeriodYear = Number(options.defaultPeriodYear) || null
  const globalPeriodText = findGlobalPeriodText(normalizedRows)
  const sections = findSections(normalizedRows)
  const parsedRows = []
  const errors = []

  if (sections.length === 0) {
    return {
      rows: parseLegacyRows(normalizedRows, importBatchNo, errors),
      errors,
    }
  }

  sections.forEach((section, index) => {
    const nextSectionRow = sections[index + 1]?.rowIndex ?? normalizedRows.length
    parseSection(
      normalizedRows,
      section,
      nextSectionRow,
      globalPeriodText,
      defaultPeriodYear,
      importBatchNo,
      parsedRows,
      errors,
    )
  })

  return { rows: parsedRows, errors }
}

function findSections(rows) {
  const sections = []
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const title = resolveTitle(cell)
      if (title) {
        // 同一模板有 6 个配置区域，识别到的每个区域都拆标题后导入同一张三项费用表。
        sections.push({ rowIndex, colIndex, ...title })
      }
    })
  })
  return sections.sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex)
}

function parseSection(rows, section, endRowIndex, globalPeriodText, defaultPeriodYear, importBatchNo, parsedRows, errors) {
  const headerRowIndex = findHeaderRow(rows, section.rowIndex + 1, endRowIndex)
  if (headerRowIndex < 0) {
    errors.push({ rowNumber: section.rowIndex + 1, message: `${section.title} 未找到表头` })
    return
  }
  const fieldIndex = buildFieldIndex(rows[headerRowIndex])
  const missing = REQUIRED_FIELDS.filter((field) => fieldIndex[field] === undefined)
  if (missing.length > 0) {
    errors.push({ rowNumber: headerRowIndex + 1, message: `${section.title} 缺少表头：${missing.join(', ')}` })
    return
  }

  let lastDepartment = ''
  let lastOffice = ''
  for (let rowIndex = headerRowIndex + 1; rowIndex < endRowIndex; rowIndex += 1) {
    const row = rows[rowIndex] || []
    if (isBlankRow(row) || row.some((cell) => resolveTitle(cell))) {
      continue
    }
    const department = readText(row, fieldIndex.applicantDepartment) || lastDepartment
    const officeRaw = readText(row, fieldIndex.applicantOffice) || lastOffice
    if (department) {
      lastDepartment = department
    }
    if (officeRaw) {
      lastOffice = officeRaw
    }
    const office = normalizeApplicantOffice(officeRaw)
    const management = parseRate(row[fieldIndex.managementExpenseRate])
    const finance = parseRate(row[fieldIndex.financeExpenseRate])
    const sales = parseRate(row[fieldIndex.salesExpenseRate])
    const total = parseRate(row[fieldIndex.threeExpenseTotalRate])
    const oem = fieldIndex.oemExpenseRate === undefined ? null : parseRate(row[fieldIndex.oemExpenseRate])
    const periodValue =
      fieldIndex.periodText === undefined ? globalPeriodText : readText(row, fieldIndex.periodText) || globalPeriodText
    const period = parsePeriod(periodValue)
    const periodYear = period.periodYear || defaultPeriodYear

    if (!department && management === null && finance === null && sales === null && total === null) {
      continue
    }
    const rowNumber = rowIndex + 1
    if (!department) {
      errors.push({ rowNumber, message: `${section.title} 第 ${rowNumber} 行缺少申请部门` })
      continue
    }
    if (!periodYear) {
      errors.push({ rowNumber, message: `${section.title} 第 ${rowNumber} 行缺少有效期间` })
      continue
    }
    if ([management, finance, sales, total].some((value) => value === null)) {
      errors.push({ rowNumber, message: `${section.title} 第 ${rowNumber} 行费率不能为空且必须为数字` })
      continue
    }
    if (!isTotalValid(management, finance, sales, total)) {
      errors.push({ rowNumber, message: `${section.title} 第 ${rowNumber} 行三项费用合计不等于管理费用+财务费用+营业费用` })
      continue
    }

    parsedRows.push({
      businessUnitType: section.productCategory === '家代商代销产品' ? 'HOUSEHOLD' : 'COMMERCIAL',
      periodYear,
      productCategory: section.productCategory,
      productLine: section.productLine,
      applicantDepartment: department,
      // “/” 表示没有具体处室，后续成本核算会走申请部门匹配。
      applicantOffice: office,
      managementExpenseRate: management,
      financeExpenseRate: finance,
      salesExpenseRate: sales,
      threeExpenseTotalRate: total,
      oemExpenseRate: oem,
      sourceType: 'EXCEL_IMPORT',
      importBatchNo,
    })
  }
}

function parseLegacyRows(rows, importBatchNo, errors) {
  const headerRowIndex = findHeaderRow(rows, 0, rows.length)
  if (headerRowIndex < 0) {
    errors.push({ rowNumber: 1, message: '未找到三项费用表头' })
    return []
  }
  const fieldIndex = buildFieldIndex(rows[headerRowIndex])
  return rows.slice(headerRowIndex + 1).map((row, offset) => {
    const rowNumber = headerRowIndex + offset + 2
    const periodText = readText(row, fieldIndex.periodText)
    const period = parsePeriod(periodText)
    const management = parseRate(row[fieldIndex.managementExpenseRate])
    const finance = parseRate(row[fieldIndex.financeExpenseRate])
    const sales = parseRate(row[fieldIndex.salesExpenseRate])
    const total = parseRate(row[fieldIndex.threeExpenseTotalRate])
    if (!isBlankRow(row) && total !== null && !isTotalValid(management, finance, sales, total)) {
      errors.push({ rowNumber, message: `第 ${rowNumber} 行三项费用合计不等于管理费用+财务费用+营业费用` })
    }
    return {
      company: readText(row, fieldIndex.company),
      businessUnit: readText(row, fieldIndex.businessUnit),
      department: readText(row, fieldIndex.applicantDepartment),
      period: periodText,
      periodYear: period.periodYear,
      applicantDepartment: readText(row, fieldIndex.applicantDepartment),
      applicantOffice: normalizeApplicantOffice(readText(row, fieldIndex.applicantOffice)),
      managementExpenseRate: management,
      financeExpenseRate: finance,
      salesExpenseRate: sales,
      threeExpenseRate2025: parseRate(row[fieldIndex.threeExpenseRate2025]),
      threeExpenseRate2026: parseRate(row[fieldIndex.threeExpenseRate2026]),
      overseasSales: readText(row, fieldIndex.overseasSales),
      threeExpenseTotalRate: total,
      sourceType: 'EXCEL_IMPORT',
      importBatchNo,
    }
  }).filter((row) => row.applicantDepartment && row.periodYear)
}

function findHeaderRow(rows, startRowIndex, endRowIndex) {
  let best = { index: -1, count: 0 }
  for (let rowIndex = startRowIndex; rowIndex < endRowIndex; rowIndex += 1) {
    const fieldIndex = buildFieldIndex(rows[rowIndex] || [])
    const count = REQUIRED_FIELDS.filter((field) => fieldIndex[field] !== undefined).length
    if (count > best.count) {
      best = { index: rowIndex, count }
    }
  }
  return best.count >= 4 ? best.index : -1
}

function buildFieldIndex(row) {
  const aliasMap = Object.entries(HEADER_ALIASES).reduce((acc, [field, aliases]) => {
    aliases.forEach((alias) => {
      acc[normalizeHeader(alias)] = field
    })
    return acc
  }, {})
  const fieldIndex = {}
  row.forEach((cell, index) => {
    const field = aliasMap[normalizeHeader(cell)]
    if (field && fieldIndex[field] === undefined) {
      fieldIndex[field] = index
    }
  })
  return fieldIndex
}

function findGlobalPeriodText(rows) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || []
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const header = normalizeHeader(row[colIndex])
      if (['年份期间', '期间', '年份'].includes(header)) {
        return String(row[colIndex + 1] || rows[rowIndex + 1]?.[colIndex] || '').trim()
      }
    }
  }
  return ''
}

function readText(row, index) {
  if (index === undefined) {
    return ''
  }
  return String(row[index] ?? '').trim()
}

function normalizeApplicantOffice(value) {
  const text = String(value || '').trim()
  return text === '/' ? '' : text
}

function isBlankRow(row) {
  return !row.some((cell) => String(cell ?? '').trim())
}

function isTotalValid(management, finance, sales, total) {
  if ([management, finance, sales, total].some((value) => value === null || value === undefined)) {
    return false
  }
  return Math.abs(management + finance + sales - total) <= TOLERANCE
}
