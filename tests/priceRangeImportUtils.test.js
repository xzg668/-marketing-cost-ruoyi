import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  RANGE_IMPORT_TYPE_OPTIONS,
  buildRangeImportBatchNo,
  buildRangeImportPayload,
  buildRangePriceTypeApplyPayload,
  detectRangeFactorBySheetName,
  formatCurrentStatus,
  formatRangeType,
  isQuantityRangeSheetName,
} from '../src/pages/priceRangeImportUtils.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceRangePage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('MFRP-03 区间价导入 sheet 识别', () => {
  it('识别区间铜价为 CU', () => {
    const factor = detectRangeFactorBySheetName('区间铜价')
    assert.equal(factor.code, 'CU')
    assert.equal(factor.label, '铜价区间')
  })

  it('识别区间锌价、区间铝价、镀金区间价、白银区间价', () => {
    assert.equal(detectRangeFactorBySheetName('区间锌价').code, 'ZN')
    assert.equal(detectRangeFactorBySheetName('区间铝价').code, 'AL')
    assert.equal(detectRangeFactorBySheetName('镀金区间价').code, 'GOLD')
    assert.equal(detectRangeFactorBySheetName('白银区间价').code, 'SILVER')
  })

  it('无法识别时返回 null，页面负责弹出选择', () => {
    assert.equal(detectRangeFactorBySheetName('Sheet1'), null)
  })

  it('数量区间 sheet 走旧 QTY 兼容路径', () => {
    assert.equal(isQuantityRangeSheetName('数量区间价'), true)
    assert.equal(isQuantityRangeSheetName('区间铜价'), false)
  })
})

describe('MFRP-03 区间价导入 payload', () => {
  it('FACTOR 导入提交 rangeBasis、factorCode、sourceSheet 和 importBatchNo', () => {
    const payload = buildRangeImportPayload(
      [
        {
          materialCode: '201850160',
          unit: '元/米',
          rangeLow: 87501,
          rangeHigh: 92500,
          priceExclTax: 0.392035,
        },
      ],
      {
        factor: { code: 'CU' },
        fileName: 'range.xlsx',
        sheetName: '区间铜价',
        importBatchNo: 'BATCH-001',
      }
    )

    assert.equal(payload.rangeBasis, 'FACTOR')
    assert.equal(payload.factorCode, 'CU')
    assert.equal(payload.factorName, '电解铜')
    assert.equal(payload.factorUnit, '元/吨')
    assert.equal(payload.priceUnit, '元/米')
    assert.equal(payload.sourceFile, 'range.xlsx')
    assert.equal(payload.sourceSheet, '区间铜价')
    assert.equal(payload.importBatchNo, 'BATCH-001')
    assert.equal(payload.rows[0].rangeBasis, 'FACTOR')
    assert.equal(payload.rows[0].factorCode, 'CU')
  })

  it('QTY 导入保持数量区间 payload', () => {
    const payload = buildRangeImportPayload(
      [{ materialCode: 'MAT-QTY', rangeLow: 1, rangeHigh: 10, priceInclTax: 5 }],
      { sheetName: '数量区间价', importBatchNo: 'BATCH-QTY' }
    )

    assert.equal(payload.rangeBasis, 'QTY')
    assert.equal(payload.factorCode, '')
    assert.equal(payload.rows[0].rangeBasis, 'QTY')
  })

  it('importBatchNo 生成稳定前缀', () => {
    assert.equal(
      buildRangeImportBatchNo(new Date('2026-07-02T09:05:06')),
      'RANGE20260702090506'
    )
  })
})

describe('MFRP-03 区间价列表展示', () => {
  it('FACTOR 行展示人话区间类型和当前状态', () => {
    assert.equal(formatRangeType({ rangeBasis: 'FACTOR', factorCode: 'CU' }), '铜价区间')
    assert.equal(formatCurrentStatus({ currentFlag: 1 }), '当前')
  })

  it('旧数据默认展示数量区间，currentFlag=0 展示历史', () => {
    assert.equal(formatRangeType({}), '数量区间')
    assert.equal(formatCurrentStatus({ currentFlag: 0 }), '历史')
  })

  it('页面包含简单选择弹窗，不直接展示技术字段列', () => {
    assert.match(pageContent, /title="选择区间类型"/)
    assert.match(pageContent, /RANGE_IMPORT_TYPE_OPTIONS/)
    assert.match(pageContent, /formatRangeType\(row\)/)
    assert.match(pageContent, /formatCurrentStatus\(row\)/)
    assert.equal(RANGE_IMPORT_TYPE_OPTIONS.some((option) => option.code === 'QTY'), true)
    assert.doesNotMatch(pageContent, /label="factor_rule_id"/i)
    assert.doesNotMatch(pageContent, /label="range_basis"/i)
    assert.doesNotMatch(pageContent, /label="current_flag"/i)
    assert.doesNotMatch(pageContent, /label="version_no"/i)
  })
})

describe('MFRP-04 价格类型冲突确认', () => {
  it('构造改为区间价 payload 时只提交物料和生效信息', () => {
    const payload = buildRangePriceTypeApplyPayload([
      {
        materialCode: '201850160',
        materialName: '铜管',
        businessUnitType: 'COMMERCIAL',
        period: '2026-07',
        effectiveFrom: '2026-07-01',
        currentPriceType: '固定价',
      },
    ])

    assert.deepEqual(payload, {
      rows: [
        {
          materialCode: '201850160',
          materialName: '铜管',
          businessUnitType: 'COMMERCIAL',
          period: '2026-07',
          effectiveFrom: '2026-07-01',
          source: 'range-price-import',
        },
      ],
    })
  })

  it('页面导入后提示价格类型冲突并可调用确认改价接口', () => {
    assert.match(pageContent, /价格类型冲突/)
    assert.match(pageContent, /改为区间价/)
    assert.match(pageContent, /暂不修改/)
    assert.match(pageContent, /applyRangePriceTypes/)
    assert.match(pageContent, /priceTypeConflicts/)
  })
})
