import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePeriod,
  parseRate,
  parseThreeExpenseRateRows,
  resolveTitle,
} from '../src/pages/threeExpenseRateImportUtils.js'

describe('threeExpenseRateImportUtils', () => {
  it('parses period and percentage/decimal rates', () => {
    assert.deepEqual(parsePeriod('2026.3'), { periodYear: 2026 })
    assert.equal(parseRate('8%'), 0.08)
    assert.equal(parseRate('0.08'), 0.08)
    assert.equal(parseRate('20'), 0.2)
  })

  it('resolves the six title matrix headers', () => {
    assert.deepEqual(resolveTitle('配置表三：商用直销产品-越南事业部'), {
      code: '配置表三',
      title: '商用直销产品-越南事业部',
      productCategory: '商用直销产品',
      productLine: '越南事业部',
    })
    assert.deepEqual(resolveTitle('配置表五：家代商代销产品-墨西哥产线'), {
      code: '配置表五',
      title: '家代商代销产品-墨西哥产线',
      productCategory: '家代商代销产品',
      productLine: '墨西哥产线',
    })
  })

  it('parses one workbook containing all six matrix sections into one row set', () => {
    const rows = [
      ['期间', '2026.3'],
      ...section('配置表一：商用直销产品-国内产线', '欧美业务部（直销）', '/', '8%', '2%', '20%', '0.3', '5%'),
      ...section('配置表二：商用直销产品-墨西哥产线', '欧美业务部（直销）', '/', '0.08', '0.02', '0.20', '30%', '0.05'),
      ...section('配置表三：商用直销产品-越南事业部', '亚太营销本部', '华南业务部', '8%', '2%', '20%', '0.3', ''),
      ...section('配置表四：家代商代销产品-国内产线', '美洲区业务部（代销）', '/', '8%', '2%', '20%', '0.3', ''),
      ...section('配置表五：家代商代销产品-墨西哥产线', '美洲区业务部（代销）', '/', '8%', '2%', '20%', '0.3', ''),
      ...section('配置表六：家代商代销产品-越南事业部', '亚太营销本部', '越南业务部', '8%', '2%', '20%', '0.3', ''),
    ]

    const result = parseThreeExpenseRateRows(rows, { importBatchNo: 'TEST-BATCH' })

    assert.equal(result.errors.length, 0)
    assert.equal(result.rows.length, 6)
    assert.deepEqual(
      result.rows.map((row) => [row.productCategory, row.productLine]),
      [
        ['商用直销产品', '国内产线'],
        ['商用直销产品', '墨西哥产线'],
        ['商用直销产品', '越南事业部'],
        ['家代商代销产品', '国内产线'],
        ['家代商代销产品', '墨西哥产线'],
        ['家代商代销产品', '越南事业部'],
      ],
    )
    assert.equal(result.rows[0].applicantOffice, '')
    assert.equal(result.rows[0].threeExpenseTotalRate, 0.3)
    assert.equal(result.rows[0].oemExpenseRate, 0.05)
    assert.equal(result.rows[3].businessUnitType, 'HOUSEHOLD')
    assert.equal(Object.hasOwn(result.rows[0], 'rawPeriod'), false)
  })

  it('reports a clear row error when total rate does not match detail rates', () => {
    const result = parseThreeExpenseRateRows([
      ['期间', '2026.3'],
      ...section('配置表一：商用直销产品-国内产线', '欧美业务部（直销）', '/', '8%', '2%', '20%', '0.29', ''),
    ])

    assert.equal(result.rows.length, 0)
    assert.match(result.errors[0].message, /三项费用合计不等于管理费用\+财务费用\+营业费用/)
  })

  it('uses default year for the simple title plus table format', () => {
    const result = parseThreeExpenseRateRows([
      ['配置表一：商用直销产品-国内产线'],
      ['申请部门', '申请处室', '管理费用', '财务费用', '营业费用', '三项费用合计', 'OEM费用率'],
      ['欧洲业务管理部（海外）', '/', '8%', '0.5%', '21.5%', '30%', '0%'],
    ], { defaultPeriodYear: 2026 })

    assert.equal(result.errors.length, 0)
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].periodYear, 2026)
    assert.equal(result.rows[0].productCategory, '商用直销产品')
    assert.equal(result.rows[0].productLine, '国内产线')
  })
})

function section(title, department, office, management, finance, sales, total, oem) {
  return [
    [title],
    ['申请部门', '申请处室', '管理费用', '财务费用', '营业费用', '三项费用合计', 'OEM费用率'],
    [department, office, management, finance, sales, total, oem],
  ]
}
