import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { displayFactorPrice, factorPricePerTon, publicationCanConfirm, validateCopperAdjustment, priceUnitLabel, financePreviousMonthExport } from '../src/pages/financeFactorPublicationUtils.js'

describe('财务基价展示和发布边界', () => {
  it('按目标月份导出上月，商用与板换文件明确分开，跨年不受时区影响', () => {
    assert.deepEqual(financePreviousMonthExport({ priceMonth: '2027-01', priceOrgCode: '210' }), {
      priceMonth: '2027-01', priceOrgCode: '210', sourceMonth: '2026-12', filename: '商用财务基价_2026-12_用于2027-01.xlsx',
    })
    const board = financePreviousMonthExport({ priceMonth: '2026-11', priceOrgCode: '220', schemeCode: 'forged', condition: 'TENDER' })
    assert.equal(board.sourceMonth, '2026-10'); assert.equal(board.filename, '板换财务基价_2026-10_用于2026-11.xlsx')
    assert.deepEqual(Object.keys(board).sort(), ['filename', 'priceMonth', 'priceOrgCode', 'sourceMonth'])
  })
  it('月份和组织不完整时不能下载另一个范围的基价', () => {
    for (const priceMonth of ['', '0000-10', '0001-01', '2026-13', '2026-1'])
      assert.throws(() => financePreviousMonthExport({ priceMonth, priceOrgCode: '210' }))
    assert.throws(() => financePreviousMonthExport({ priceMonth: '2026-11', priceOrgCode: '221' }))
  })
  it('公斤铜价按十进制准确转吨，不丢失原始精度', () => {
    assert.equal(factorPricePerTon({ price: '90.1234567890123456', unit: 'CNY/KG' }), '90123.4567890123456')
    assert.equal(factorPricePerTon({ price: '0.0000000000000001', unit: 'CNY/KG' }), '0.0000000000001')
    assert.equal(factorPricePerTon({ price: '100.0000000000000000', unit: 'CNY/KG' }), '100000')
    assert.equal(factorPricePerTon({ price: '90000.123', unit: 'CNY/TON' }), '90000.123')
  })
  it('仅去除展示末尾零，保留实际小数和缺值', () => {
    assert.equal(displayFactorPrice('90.0000000000000000'), '90')
    assert.equal(displayFactorPrice('21.6362912421045000'), '21.6362912421045')
    assert.equal(displayFactorPrice('0.0000000000000001'), '0.0000000000000001')
    assert.equal(displayFactorPrice('0.0000000000000000'), '0')
    assert.equal(displayFactorPrice(null), '—')
  })
  it('缺价或未知单位不能展示成0或默认90000', () => {
    for (const factor of [null, {}, { price: null, unit: 'CNY/KG' }, { price: '90', unit: 'unknown' }]) {
      assert.equal(factorPricePerTon(factor), '')
    }
    assert.equal(priceUnitLabel('CNY/KG'), '元/公斤')
    assert.equal(priceUnitLabel('CNY/G'), '元/克')
  })
  it('Cu调整必须有正数价格和原因，不设固定铜价或无依据上限', () => {
    for (const value of ['', ' ', 'NaN', '1e3', '0', '0.0000', '-1']) {
      assert.ok(validateCopperAdjustment({ pricePerTon: value, changeReason: '核对' }))
    }
    assert.equal(validateCopperAdjustment({ pricePerTon: '1000001.123456789', changeReason: '核对' }), '')
    assert.ok(validateCopperAdjustment({ pricePerTon: '95000', changeReason: ' ' }))
    assert.ok(validateCopperAdjustment({ pricePerTon: '95000', changeReason: '字'.repeat(513) }))
  })
  it('仅非空且没有问题的预检可以确认，处理中的请求禁止重复确认', () => {
    const preview = { previewFingerprint: 'fingerprint', workbook: { values: [{}], problems: [] } }
    assert.equal(publicationCanConfirm(preview, {}, false), true)
    assert.equal(publicationCanConfirm(preview, null, false), false)
    assert.equal(publicationCanConfirm(preview, {}, true), false)
    assert.equal(publicationCanConfirm(null, {}, false), false)
    assert.equal(publicationCanConfirm({ ...preview, previewFingerprint: '' }, {}, false), false)
    assert.equal(publicationCanConfirm({ ...preview, workbook: { values: [], problems: [] } }, {}, false), false)
    assert.equal(publicationCanConfirm({ ...preview, workbook: { values: [{}], problems: [{ cellRef: 'G3' }] } }, {}, false), false)
  })
})
