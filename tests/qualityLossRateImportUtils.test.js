import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseQualityLossRateWorkbook } from '../src/utils/qualityLossRateImportUtils.js'

const header = ['料号', '品名', '规格', '型号', '事业部', '大类', '小类', '规格', '四级', '净损失率']

const workbookWith = (sheets) => {
  const workbook = XLSX.utils.book_new()
  sheets.forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  })
  return workbook
}

describe('qualityLossRateImportUtils', () => {
  it('完整多表文件只选择“报价系统展示”，不会误读第一张物料主档', () => {
    const workbook = workbookWith([
      ['物料主档', [['料号', '名称'], ['WRONG', '错误页']]],
      ['报价系统展示', [header, ['102053856', '阀', 'C规格', 'D型号', '商用部品', 'F大类', 'G小类', 'H规格', 'I四级', '0.25%']]],
    ])

    const result = parseQualityLossRateWorkbook(workbook, XLSX)

    assert.equal(result.sheetName, '报价系统展示')
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].bareProductCode, '102053856')
    assert.equal(result.rows[0].materialSpec, 'C规格')
    assert.equal(result.rows[0].categorySpec, 'H规格')
    assert.equal(result.rows[0].lossRate, 0.0025)
  })

  it('独立单表即使名为 Sheet1 也按相同 A:J 结构导入', () => {
    const workbook = workbookWith([
      ['Sheet1', [header, ['101500535', '线圈', '', 'MODEL', '电子产品', '线圈', '', '', '', 0.01]]],
    ])

    const result = parseQualityLossRateWorkbook(workbook, XLSX)

    assert.equal(result.sheetName, 'Sheet1')
    assert.equal(result.rows[0].lossRate, 0.01)
  })

  it('数值型损失率读取 Excel 原始值，不受百分比显示精度影响', () => {
    const preciseRate = 0.0047504845450991
    const workbook = workbookWith([
      ['报价系统展示', [header, ['1001100050001', '组合阀', '', '', '', '', '', '', '', preciseRate]]],
    ])
    workbook.Sheets['报价系统展示'].J2.z = '0.000%'

    const result = parseQualityLossRateWorkbook(workbook, XLSX)

    assert.equal(result.rows[0].lossRate, preciseRate)
  })

  it('多表文件缺少目标表时拒绝导入，避免误选第一表', () => {
    const workbook = workbookWith([
      ['物料主档', [header]],
      ['分类', [header]],
    ])

    assert.throws(
      () => parseQualityLossRateWorkbook(workbook, XLSX),
      /必须包含名为“报价系统展示”的工作表/,
    )
  })

  it('未报价、#N/A 和空损失率不进入导入数据', () => {
    const workbook = workbookWith([
      ['报价系统展示', [
        header,
        ['A', '', '', '', '', '', '', '', '', '未报价'],
        ['B', '', '', '', '', '', '', '', '', '#N/A'],
        ['C', '', '', '', '', '', '', '', '', ''],
        ['D', '', '', '', '', '', '', '', '', '0.475%'],
      ]],
    ])

    const result = parseQualityLossRateWorkbook(workbook, XLSX)

    assert.equal(result.skippedRows, 3)
    assert.deepEqual(result.rows.map((row) => row.bareProductCode), ['D'])
    assert.equal(result.rows[0].lossRate, 0.00475)
  })
})
