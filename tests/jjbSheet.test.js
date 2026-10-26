import test from 'node:test'
import assert from 'node:assert/strict'
import { savedMoney, rowBasis, ratePercent, sheetGroups, sheetTotals, jjbColumns } from '../src/utils/jjbSheet.js'

test('decimal display preserves huge values, negative differences, explicit zero and blank', () => {
  for (const v of ['999999999973.140060', '0.000000', '-8.000000']) assert.equal(savedMoney(v), v)
  assert.equal(savedMoney(null), '')
  assert.throws(() => savedMoney(1.234567), /十进制文本/)
  assert.throws(() => savedMoney('1.23456789'), /十进制文本/)
})
test('A through O retain D=P E=Q F=Ai without arithmetic', () => {
  assert.equal(jjbColumns.length, 15)
  assert.deepEqual(jjbColumns.slice(3, 6).map(x => x[0]), ['unitPrice', 'quantity', 'amount'])
  const row = { kind: 'HOUSEHOLD', householdRate: '0.085', salesRate: '0.25' }
  assert.equal(rowBasis(row), 'H=8.5%；S=25%')
  assert.equal(ratePercent('0.000000123456789012'), '0.0000123456789012%')
})
test('actual stored rows alone create household section and preserve fixed fees', () => {
  const fees = ['模具费', '认证费', '折旧费', '工装夹具费'].map(name => ({ section: 'PRODUCT_FEES', name, kind: 'FEE', amount: null }))
  assert.deepEqual(sheetGroups({ rows: fees }).map(g => g.code), ['PRODUCT_FEES'])
  for (const count of [1, 2, 9]) {
    const rows = [...Array.from({ length: count }, (_, i) => ({ key: i, section: 'HOUSEHOLD' })), ...fees]
    const groups = sheetGroups({ rows }); assert.equal(groups[0].rows.length, count); assert.equal(groups[1].rows.length, 4)
    assert.deepEqual(rows.slice(-4).map(r => r.amount), [null, null, null, null])
  }
})
test('totals never derive missing old fields or reapply coefficients', () => {
  const totals = sheetTotals({ totals: { totalCost: '1.775829', cuMaterialAdjustment: null, finalQuoteAmount: null } })
  assert.deepEqual(totals.map(t => t.amount), ['1.775829', null, null])
  assert.equal(rowBasis({ kind: 'PROPERTY', coefficient: '1.05' }), '系数 1.05（已在保存金额中应用）')
  assert.equal(rowBasis({ kind: 'FEE', feeState: 'MISSING' }), '未填写')
  assert.equal(rowBasis({ kind: 'FEE', feeState: 'EXPLICIT_NONE' }), '明确无费用')
  assert.equal(rowBasis({ kind: 'FEE', feeState: 'LEGACY' }), '历史保存值')
})
