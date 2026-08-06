import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import XLSX from 'xlsx'
import {
  RPI1_TYPE1_REAL_FILE_SHA256,
  buildSanitizedRangeType1Workbook,
  parseRangeType1Workbook,
} from './rpi1RangeType1WorkbookHarness.js'

const REAL_FILE = process.env.RPI1_TYPE1_REAL_EXCEL
  || '/Users/xiexicheng/Desktop/price/采购价表二次开发导入模板251115区间价格导入类型1.xls'

const assertEightyRows = (result) => {
  assert.equal(result.ok, true)
  assert.equal(result.route.route, 'TYPE1')
  assert.equal(result.route.factor.code, 'CU')
  assert.equal(result.base.rows.length, 8)
  assert.equal(result.range.headerRowIndex, 1)
  assert.equal(result.range.subHeaderRowIndex, 2)
  assert.equal(result.range.rows.length, 8)
  assert.equal(result.range.intervals.length, 10)
  assert.equal(result.range.intervalRows.length, 80)
  assert.deepEqual(result.match.summary, {
    totalCount: 8,
    matchedCount: 8,
    failedCount: 0,
    conflictCount: 0,
  })
  assert.equal(result.request.payload.rangeBasis, 'FACTOR')
  assert.equal(result.request.payload.factorCode, 'CU')
  assert.equal(result.request.payload.rows.length, 80)
}

describe('RPI1-12 三Sheet脱敏夹具端到端', () => {
  it('独立工作簿覆盖第2、3行表头、公式缓存、8行匹配和80条展开', () => {
    const original = buildSanitizedRangeType1Workbook()
    const buffer = XLSX.write(original, { type: 'buffer', bookType: 'xlsx' })
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellFormula: true,
      cellNF: true,
      cellText: true,
    })
    const result = parseRangeType1Workbook(workbook, {
      fileName: '区间价格类型1-脱敏夹具.xlsx',
      importBatchNo: 'RPI1-12-SANITIZED',
    })

    assert.deepEqual(workbook.SheetNames, ['气门芯价格', 'Sheet1', 'Sheet2'])
    assert.equal(Object.keys(result.formulaCells).length, 80)
    assert.equal(
      Object.values(result.formulaCells).every((cell) => cell.cachePresent),
      true
    )
    assertEightyRows(result)
    assert.equal(
      result.request.payload.rows
        .filter((row) => row.materialCode === 'MAT-001' && row.supplierCode === 'TEST-A')
        .length,
      10
    )
    assert.equal(
      result.request.payload.rows
        .filter((row) => row.materialCode === 'MAT-001' && row.supplierCode === 'TEST-B')
        .length,
      10
    )
  })
})

describe('RPI1-12 真实Excel只读端到端', () => {
  it('固定SHA-256的真实文件得到8/8匹配和80条标准请求', {
    skip: !fs.existsSync(REAL_FILE),
  }, () => {
    const bytes = fs.readFileSync(REAL_FILE)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    assert.equal(sha256, RPI1_TYPE1_REAL_FILE_SHA256)

    const workbook = XLSX.read(bytes, {
      type: 'buffer',
      cellFormula: true,
      cellNF: true,
      cellText: true,
    })
    const result = parseRangeType1Workbook(workbook, {
      fileName: path.basename(REAL_FILE),
      importBatchNo: `RPI1-12-REAL-${sha256.slice(0, 8)}`,
    })

    assert.deepEqual(workbook.SheetNames, ['气门芯价格', 'Sheet1', 'Sheet2'])
    assert.equal(Object.keys(result.formulaCells).length, 104)
    assertEightyRows(result)
    assert.equal(result.route.baseSheet.name, '气门芯价格')
    assert.equal(result.route.rangeSheet.name, 'Sheet1')
    assert.equal(result.request.payload.rows[0].effectiveFrom, '2025-11-01')
    assert.equal(result.request.payload.rows[0].effectiveTo, '2025-11-30')
    assert.equal(result.request.payload.rows[0].priceExclTax, 0.9946902654867257)

    for (const materialCode of ['201503873', '201503874']) {
      for (const supplierCode of ['S000841', 'S001289']) {
        assert.equal(
          result.request.payload.rows.filter(
            (row) => row.materialCode === materialCode && row.supplierCode === supplierCode
          ).length,
          10
        )
      }
    }
    assert.equal(
      result.request.payload.rows
        .filter((row) => row.supplierCode === 'S000841')
        .every((row) => row.supplierName === '公主岭市远达实业有限公司'),
      true
    )
    assert.equal(
      result.request.payload.rows
        .filter((row) => row.supplierCode === 'S001289')
        .every((row) => row.supplierName === '吉林省合信汽配有限公司'),
      true
    )
  })
})
