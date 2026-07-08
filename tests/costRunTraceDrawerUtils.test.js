import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  rangeTraceExplanation,
  rangeTraceMeta,
} from '../src/components/costRunTraceDrawerUtils.js'

describe('MFRP-07 区间价底稿抽屉文案', () => {
  it('FACTOR 区间按报价单铜价命中区间展示', () => {
    const detail = {
      sourceType: 'RANGE_PRICE',
      sourceSnapshotJson: JSON.stringify({
        rangePriceItem: {
          range_basis: 'FACTOR',
          range_type: '铜价区间',
          factor_code: 'CU',
          factor_value: 90000,
          range_low: 87501,
          range_high: 92500,
        },
      }),
    }

    assert.equal(rangeTraceMeta(detail).isFactorRange, true)
    const text = rangeTraceExplanation(detail)
    assert.match(text, /按报价单铜价命中区间/)
    assert.doesNotMatch(text, /按 BOM 用量命中区间/)
  })

  it('QTY 区间保留按 BOM 用量命中区间展示', () => {
    const detail = {
      sourceType: 'RANGE_PRICE',
      sourceSnapshotJson: JSON.stringify({
        rangePriceItem: {
          rangeBasis: 'QTY',
          rangeLow: 1,
          rangeHigh: 10,
        },
      }),
    }

    assert.equal(rangeTraceMeta(detail).isFactorRange, false)
    assert.match(rangeTraceExplanation(detail), /按 BOM 用量命中区间/)
  })
})
