const TARGET_SHEET_NAME = '报价系统展示'
const EXPECTED_HEADERS = [
  '料号',
  '品名',
  '规格',
  '型号',
  '事业部',
  '大类',
  '小类',
  '规格',
  '四级',
  '净损失率',
]

export const normalizeQualityLossRateHeader = (value) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

export const parseQualityLossRate = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text || text === '未报价' || /^#N\/A$/i.test(text)) {
    return null
  }
  if (text.endsWith('%')) {
    const parsed = Number(text.slice(0, -1).trim())
    return Number.isFinite(parsed) ? parsed / 100 : Number.NaN
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const isExpectedHeader = (row) =>
  EXPECTED_HEADERS.every((expected, index) => {
    const actual = normalizeQualityLossRateHeader(row?.[index])
    return index === 4 ? actual.startsWith('事业部') : actual === expected
  })

const findHeaderIndex = (rows) =>
  rows.slice(0, 20).findIndex(isExpectedHeader)

export const selectQualityLossRateSheet = (workbook, XLSX) => {
  const sheetNames = workbook?.SheetNames || []
  let sheetName = null
  if (sheetNames.includes(TARGET_SHEET_NAME)) {
    sheetName = TARGET_SHEET_NAME
  } else if (sheetNames.length === 1) {
    sheetName = sheetNames[0]
  } else {
    throw new Error('多工作表文件必须包含名为“报价系统展示”的工作表')
  }
  const sheet = workbook?.Sheets?.[sheetName]
  if (!sheet) {
    throw new Error('未找到可导入的质量损失率工作表')
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  })
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  })
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex < 0) {
    throw new Error('工作表结构不正确，必须包含 A:J：料号、品名、规格、型号、事业部、大类、小类、规格、四级、净损失率')
  }
  return { sheetName, rows, rawRows, headerIndex }
}

export const parseQualityLossRateWorkbook = (workbook, XLSX) => {
  const { sheetName, rows, rawRows, headerIndex } = selectQualityLossRateSheet(workbook, XLSX)
  const parsedRows = []
  const seenCodes = new Set()
  let skippedRows = 0
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    const values = row.slice(0, 10).map((value) => String(value ?? '').trim())
    if (values.every((value) => !value)) {
      continue
    }
    const rowNo = index + 1
    const bareProductCode = values[0]
    if (!bareProductCode) {
      throw new Error(`Excel第${rowNo}行缺裸品料号`)
    }
    // 数值型百分比读取底层值，避免因 Excel 显示精度或另存工具改写格式而产生差异。
    // 文本型百分比仍按显示内容解析，以兼容手工录入的“0.25%”。
    const rawRate = rawRows[index]?.[9]
    const rate = parseQualityLossRate(typeof rawRate === 'number' ? rawRate : row[9])
    if (rate === null) {
      skippedRows += 1
      continue
    }
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
      throw new Error(`Excel第${rowNo}行净损失率格式不正确`)
    }
    if (seenCodes.has(bareProductCode)) {
      throw new Error(`Excel第${rowNo}行裸品料号重复：${bareProductCode}`)
    }
    seenCodes.add(bareProductCode)
    parsedRows.push({
      rowNo,
      bareProductCode,
      productName: values[1],
      materialSpec: values[2],
      productModel: values[3],
      businessDivision: values[4],
      productCategory: values[5],
      productSubcategory: values[6],
      categorySpec: values[7],
      fourthLevel: values[8],
      lossRate: rate,
      remark: '',
    })
  }
  return { sheetName, rows: parsedRows, skippedRows }
}
