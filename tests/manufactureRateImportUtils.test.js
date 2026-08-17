import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeManufactureRateModel,
  normalizeManufactureRatePlaceholder,
  parseManufactureRateRows,
  selectManufactureRateSheetName,
} from '../src/pages/manufactureRateImportUtils.js'

describe('manufactureRateImportUtils', () => {
  it('selects the manufacture sheet by exact/similar name and supports a single-sheet workbook', () => {
    assert.equal(
      selectManufactureRateSheetName(['水电大修费', '制造费用', '三项费用']),
      '制造费用',
    )
    assert.equal(
      selectManufactureRateSheetName(['水电大修费', '2026年制造费用率', '三项费用']),
      '2026年制造费用率',
    )
    assert.equal(selectManufactureRateSheetName(['Sheet1']), 'Sheet1')
    assert.equal(selectManufactureRateSheetName(['Sheet1', 'Sheet2']), null)
  })

  it('treats slash product codes as blank and moves a trailing model note to remark', () => {
    assert.equal(normalizeManufactureRatePlaceholder('/'), '')
    assert.equal(normalizeManufactureRatePlaceholder('／'), '')
    assert.deepEqual(normalizeManufactureRateModel('YCQE01U01（仅含快速接头）'), {
      value: 'YCQE01U01',
      note: '仅含快速接头',
    })
    assert.deepEqual(normalizeManufactureRateModel('PSB-12(B)-33'), {
      value: 'PSB-12(B)-33',
      note: '',
    })
  })

  it('parses exact-model and J/S category-prefix rows from the manufacture worksheet', () => {
    const result = parseManufactureRateRows([
      ['序号', '事业部', '产品大类', '产品料号', '产品名称', '产品型号', '产品规格', '制造费用率', '备注'],
      [1, '电子产品事业部', 'FQ', '/', '宁波惠康线圈', 'FQ-A20110-000001', '', '12%', ''],
      [2, '电子产品事业部', 'YCQ', '/', '数显压力变送器', 'YCQE01U01（仅含快速接头）', '', '5%', ''],
      [3, '板换事业部', 'J系列', '/', '钎焊板式换热器', '', '', '12%', ''],
      [4, '板换事业部', 'S系列', '/', '钎焊板式换热器', '', '', '16%', ''],
    ], { rateYear: 2026 })

    assert.equal(result.error, null)
    assert.equal(result.rows.length, 4)
    assert.equal(result.rows[0].productCode, '')
    assert.equal(result.rows[0].productModel, 'FQ-A20110-000001')
    assert.equal(result.rows[1].productModel, 'YCQE01U01')
    assert.equal(result.rows[1].remark, '仅含快速接头')
    assert.equal(result.rows[2].productCategory, 'J系列')
    assert.equal(result.rows[2].productModel, '')
    assert.equal(result.rows[2].feeRate, 0.12)
    assert.equal(result.rows[3].feeRate, 0.16)
  })
})
