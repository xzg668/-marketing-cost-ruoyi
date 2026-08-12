import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'
import {
  RPI1_TYPE1_REAL_FILE_SHA256,
  parseRangeType1Workbook,
} from '../tests/rpi1RangeType1WorkbookHarness.js'

const [inputFile, outputFile] = process.argv.slice(2)
if (!inputFile || !outputFile) {
  throw new Error('用法：node scripts/rpi1RangeType1RealExcelPayload.mjs <真实Excel> <临时JSON>')
}

const bytes = fs.readFileSync(inputFile)
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (sha256 !== RPI1_TYPE1_REAL_FILE_SHA256) {
  throw new Error(`真实文件SHA-256不一致：expected=${RPI1_TYPE1_REAL_FILE_SHA256}, actual=${sha256}`)
}

const workbook = XLSX.read(bytes, {
  type: 'buffer',
  cellFormula: true,
  cellNF: true,
  cellText: true,
})
const result = parseRangeType1Workbook(workbook, {
  fileName: path.basename(inputFile),
  importBatchNo: `RPI1-12-REAL-${sha256.slice(0, 8)}`,
})
if (!result.ok || result.match.summary.matchedCount !== 8 || result.request.rowCount !== 80) {
  throw new Error(`真实文件未达到8/8和80条：${JSON.stringify({
    ok: result.ok,
    match: result.match?.summary,
    rowCount: result.request?.rowCount,
    baseErrors: result.base?.errors,
    rangeErrors: result.range?.errors,
    matchErrors: result.match?.errors,
  })}`)
}

fs.writeFileSync(outputFile, JSON.stringify({
  sourceSha256: sha256,
  sheetNames: workbook.SheetNames,
  baseRowCount: result.base.rows.length,
  matchedRowCount: result.match.summary.matchedCount,
  expandedRowCount: result.request.rowCount,
  request: result.request.payload,
}, null, 2))

process.stdout.write(`${JSON.stringify({
  sourceSha256: sha256,
  outputFile,
  sheetNames: workbook.SheetNames,
  matchedRowCount: result.match.summary.matchedCount,
  expandedRowCount: result.request.rowCount,
})}\n`)
