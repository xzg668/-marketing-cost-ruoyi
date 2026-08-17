import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  RATE_CALCULATION_MODE_FINAL_QUOTE,
  RATE_CALCULATION_MODE_PLAN_UPLIFT,
  parseDepartmentFundRateRows,
  resolveDepartmentFundEffectiveRate,
} from '../src/pages/departmentFundRateImportUtils.js'

describe('departmentFundRateImportUtils', () => {
  it('imports the raw H-column value as the final quote rate', () => {
    const result = parseDepartmentFundRateRows([
      [
        '序号',
        '事业部',
        '费用科目',
        '预算费用',
        '总工时',
        '计划\n（元/分钟）',
        '上浮比例',
        '报价比例（元/分钟）\n=计划*上浮比例',
        '工时率',
      ],
      ['序号', '事业部', '费用科目', '预算费用', '总工时', '（元/分钟）', '', '', ''],
      [
        1,
        '商用部品事业部',
        '水电费用',
        819.39,
        15468.39,
        0.0529718994672361,
        1.05,
        0.0556204944405979,
        0.4249,
      ],
      ['', '', '工装零星费用', 438.39, '', 0.0283410232092674, 1.05, 0.0297580743697308, ''],
      ['', '', '', '', '', '', '', '', ''],
    ])

    assert.deepEqual(result.errors, [])
    assert.equal(result.rows.length, 2)
    assert.equal(result.rows[0].quoteRatio, 0.0556204944405979)
    assert.equal(result.rows[0].rateCalculationMode, RATE_CALCULATION_MODE_FINAL_QUOTE)
    assert.equal(result.rows[1].businessDivision, '商用部品事业部')
    assert.equal(result.rows[1].totalWorkMinutes, 15468.39)
    assert.equal(result.rows[1].manhourRate, 0.4249)
  })

  it('rejects a final rate that does not match plan times uplift', () => {
    const result = parseDepartmentFundRateRows([
      ['事业部', '费用科目', '计划', '上浮比例', '报价比例', '工时率'],
      ['商用部品事业部', '水电费用', 0.053, 1.05, 0.065, 0.4249],
    ])

    assert.equal(result.rows.length, 0)
    assert.match(result.errors[0], /报价比例不等于计划×上浮比例/)
  })

  it('calculates final and historical rows with their own compatible semantics', () => {
    assert.equal(
      resolveDepartmentFundEffectiveRate({
        quoteRatio: 0.0556204944405979,
        upliftRatio: 1.05,
        rateCalculationMode: RATE_CALCULATION_MODE_FINAL_QUOTE,
      }),
      0.0556204944405979,
    )
    assert.equal(
      resolveDepartmentFundEffectiveRate({
        quoteRatio: 0.053,
        upliftRatio: 1.05,
        rateCalculationMode: RATE_CALCULATION_MODE_PLAN_UPLIFT,
      }),
      0.05565,
    )
  })
})
