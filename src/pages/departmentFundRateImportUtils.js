export const RATE_CALCULATION_MODE_PLAN_UPLIFT = 'PLAN_UPLIFT'
export const RATE_CALCULATION_MODE_FINAL_QUOTE = 'FINAL_QUOTE'

const HEADER_ALIASES = {
  businessDivision: ['事业部'],
  expenseSubject: ['费用科目'],
  budgetAmount: ['预算费用'],
  totalWorkMinutes: ['总工时'],
  planRate: ['计划元/分钟', '计划'],
  upliftRatio: ['上浮比例'],
  quoteRatio: ['报价比例元/分钟=计划*上浮比例', '报价比例元/分钟', '报价比例'],
  manhourRate: ['工时率'],
  remark: ['备注'],
}

const REQUIRED_FIELDS = ['businessDivision', 'expenseSubject', 'quoteRatio']
const REQUIRED_LABELS = {
  businessDivision: '事业部',
  expenseSubject: '费用科目',
  quoteRatio: '报价比例（元/分钟）',
}
const FINAL_RATE_TOLERANCE = 0.0001

export function parseNumber(value) {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeDepartmentFundHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[()（）]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()
}

export function parseDepartmentFundRateRows(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  const headerMap = buildHeaderMap()
  const headerKeys = Object.keys(headerMap).sort((a, b) => b.length - a.length)
  const resolveHeaderField = (cell) => {
    const normalized = normalizeDepartmentFundHeader(cell)
    if (!normalized) {
      return null
    }
    if (headerMap[normalized]) {
      return headerMap[normalized]
    }
    const matched = headerKeys.find((key) => normalized.includes(key))
    return matched ? headerMap[matched] : null
  }
  const header = normalizedRows.reduce(
    (best, row, index) => {
      const hitCount = (row || []).reduce(
        (count, cell) => count + (resolveHeaderField(cell) ? 1 : 0),
        0,
      )
      return hitCount > best.count ? { index, count: hitCount } : best
    },
    { index: -1, count: 0 },
  )
  if (header.index < 0 || header.count === 0) {
    return { rows: [], errors: ['未找到表头，请确认Excel格式是否正确'], missingHeaders: [] }
  }

  const fieldIndex = {}
  ;(normalizedRows[header.index] || []).forEach((cell, index) => {
    const field = resolveHeaderField(cell)
    if (field) {
      fieldIndex[field] = index
    }
  })
  const missingHeaders = REQUIRED_FIELDS.filter((field) => fieldIndex[field] === undefined)
    .map((field) => REQUIRED_LABELS[field] || field)
  if (missingHeaders.length > 0) {
    return { rows: [], errors: [], missingHeaders }
  }

  let lastBusinessDivision = ''
  let lastTotalWorkMinutes = null
  let lastManhourRate = null
  const parsedRows = []
  const errors = []
  normalizedRows.slice(header.index + 1).forEach((row, index) => {
    const rowNo = header.index + index + 2
    const businessDivision = readText(row, fieldIndex.businessDivision) || lastBusinessDivision
    const totalWorkMinutes = readCarriedNumber(
      row,
      fieldIndex.totalWorkMinutes,
      lastTotalWorkMinutes,
    )
    const manhourRate = readCarriedNumber(row, fieldIndex.manhourRate, lastManhourRate)
    if (businessDivision) {
      lastBusinessDivision = businessDivision
    }
    if (totalWorkMinutes !== null) {
      lastTotalWorkMinutes = totalWorkMinutes
    }
    if (manhourRate !== null) {
      lastManhourRate = manhourRate
    }

    const expenseSubject = readText(row, fieldIndex.expenseSubject)
    const quoteRatio = parseNumber(row?.[fieldIndex.quoteRatio])
    // 合并表头展开后可能出现第二行重复表头；模板末尾也可能保留空白说明行。
    if (expenseSubject === '费用科目' || (!expenseSubject && quoteRatio === null)) {
      return
    }
    if (!businessDivision || !expenseSubject || quoteRatio === null) {
      errors.push(`Excel第${rowNo}行缺事业部、费用科目或报价比例`)
      return
    }
    const planRate = readNumber(row, fieldIndex.planRate)
    const upliftRatio = readNumber(row, fieldIndex.upliftRatio)
    if (!matchesFinalQuoteRate(planRate, upliftRatio, quoteRatio)) {
      errors.push(`Excel第${rowNo}行报价比例不等于计划×上浮比例`)
      return
    }
    parsedRows.push({
      rowNo,
      businessDivision,
      businessUnit: businessDivision,
      expenseSubject,
      budgetAmount: readNumber(row, fieldIndex.budgetAmount),
      totalWorkMinutes,
      planRate,
      upliftRatio,
      quoteRatio,
      rateCalculationMode: RATE_CALCULATION_MODE_FINAL_QUOTE,
      manhourRate,
      remark: readText(row, fieldIndex.remark),
    })
  })
  return { rows: parsedRows, errors, missingHeaders: [] }
}

export function resolveDepartmentFundEffectiveRate(row) {
  const quoteRatio = parseNumber(row?.quoteRatio)
  if (quoteRatio === null) {
    return null
  }
  if (row?.rateCalculationMode === RATE_CALCULATION_MODE_FINAL_QUOTE) {
    return quoteRatio
  }
  return quoteRatio * (parseNumber(row?.upliftRatio) ?? 1)
}

export function formatDepartmentFundRateMode(value) {
  return value === RATE_CALCULATION_MODE_FINAL_QUOTE ? '最终费率' : '历史：再乘上浮'
}

function buildHeaderMap() {
  return Object.entries(HEADER_ALIASES).reduce((acc, [field, aliases]) => {
    aliases.forEach((alias) => {
      acc[normalizeDepartmentFundHeader(alias)] = field
    })
    return acc
  }, {})
}

function readText(row, index) {
  if (index === undefined) {
    return ''
  }
  return String(row?.[index] ?? '').trim()
}

function readNumber(row, index) {
  return index === undefined ? null : parseNumber(row?.[index])
}

function readCarriedNumber(row, index, previous) {
  const value = readNumber(row, index)
  return value === null ? previous : value
}

function matchesFinalQuoteRate(planRate, upliftRatio, quoteRatio) {
  if (planRate === null || upliftRatio === null || quoteRatio === null) {
    return true
  }
  return Math.abs(planRate * upliftRatio - quoteRatio) <= FINAL_RATE_TOLERANCE
}
