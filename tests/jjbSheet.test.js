import test from 'node:test'
import assert from 'node:assert/strict'
import { savedMoney, rowBasis, ratePercent, sheetGroups, sheetTotals, jjbColumns, sheetHeaderRows, sheetRowCells, manufacturingGrossWeightSource, grossWeightWithSource } from '../src/utils/jjbSheet.js'

test('the CMS column shows the saved source month and leaves calculated fees blank', () => {
  const group = { code: 'MATERIAL_DETAIL', rows: [] }
  const cell = (row) => sheetRowCells(row, group, 0).find(value => value.key === 'basis').value
  const auxiliary = { kind: 'COST', code: 'AUX_0201', rate: '1.05', cmsSourceNote: 'CMS 2026-07' }
  assert.equal(cell(auxiliary), 'CMS 2026-07')
  assert.equal(rowBasis(auxiliary), '105%')
  assert.equal(cell({ kind: 'COST', code: 'WATER_POWER', rate: '0.014015' }), '')
})

test('包装费用在原金额行显示包装料号与保存规格，业务费用标识保持', () => {
  const row = { kind: 'CONTRIBUTION', code: 'OTHER_EXP_PACKAGE', name: '包装费用', displayCode: '001\n002', drawingNo: '箱规格\n托规格', amount: '0.324345' }
  const cells = sheetRowCells(row, { code: 'MATERIAL_DETAIL' }, 0)
  assert.equal(cells[0].value, '001\n002')
  assert.equal(cells[1].value, '包装费用')
  assert.equal(cells[2].value, '箱规格\n托规格')
  assert.equal(cells[6].value, '0.324345')
  assert.equal(row.code, 'OTHER_EXP_PACKAGE')
})

test('报价员使用保存成本的核算人，不借用需求申请人', () => {
  const rows = sheetHeaderRows({ header: { quotation: { quoterName: '罗思雅', applicantName: '需求申请人' } } })
  assert.equal(rows[0].cells.find(cell => cell.column === 4).value, '罗思雅')
  const missing = sheetHeaderRows({ header: { quotation: { applicantName: '需求申请人' } } })
  assert.equal(missing[0].cells.find(cell => cell.column === 4).value, '')
})

test('decimal display preserves huge values, negative differences, explicit zero and blank', () => {
  for (const v of ['999999999973.140060', '0.000000', '-8.000000']) assert.equal(savedMoney(v), v)
  assert.equal(savedMoney(null), '')
  assert.throws(() => savedMoney(1.234567), /十进制文本/)
  assert.throws(() => savedMoney('1.23456789'), /十进制文本/)
})
test('A through P retain D=price E=quantity F=unit G=amount without arithmetic', () => {
  assert.equal(jjbColumns.length, 16)
  assert.deepEqual(jjbColumns.slice(3, 7).map(x => x[0]), ['unitPrice', 'quantity', 'unit', 'amount'])
  const row = { kind: 'HOUSEHOLD', householdRate: '0.085', salesRate: '0.25' }
  assert.equal(rowBasis(row), 'H=8.5%；S=25%')
  assert.equal(ratePercent('0.000000123456789012'), '0.0000123456789012%')
})
test('saved OEM sales rate is annotated and normal rates remain numeric text', () => {
  const rate = { kind: 'COST', code: 'SALES_EXP', rate: '0.12', remark: '（OEM）' }
  assert.equal(rowBasis(rate), '12%（OEM）')
  assert.equal(rowBasis({ ...rate, rate: '0' }), '0%（OEM）')
  assert.equal(rowBasis({ ...rate, remark: null }), '12%')
  assert.equal(rowBasis({ ...rate, code: 'MGMT_EXP' }), '12%')
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

test('blank gross provenance is displayed from saved evidence while the decimal stays numeric', () => {
  const row = { kind: 'PART', grossWeight: '298.14', manufacturing: [{ grossWeightSource: 'SRM联动价表' }] }
  assert.equal(sheetRowCells(row, { code: 'ORDINARY_PARTS' }, 0)[7].value, '298.14（SRM联动价表）')
  assert.equal(row.grossWeight, '298.14')
  assert.equal(manufacturingGrossWeightSource({ itemProcessType: '毛坯加工', remark: '毛重来源=SRM区间价表；毛重取本次采用报价净重' }), 'SRM区间价表')
  assert.equal(manufacturingGrossWeightSource({ itemProcessType: '原材料加工', remark: '毛重来源=SRM区间价表；' }), '')
  assert.equal(grossWeightWithSource('0', 'U9 BOM用量'), '0（U9 BOM用量）')
  assert.equal(grossWeightWithSource(null, 'SRM联动价表'), '')
})


test('结算Cu重仅备注在净重栏，零值可见，原净重与金额保持', () => {
  for (const weight of ['0.119', '0']) {
    for (const net of [null, '5']) {
      const row = { kind: 'PART', code: '203240247', netWeight: net, settlementCopperWeightG: weight, amount: '0.023200' }
      const cells = sheetRowCells(row, { code: 'ORDINARY_PARTS' }, 0)
      assert.equal(cells[8].value, [net, `${weight} g`, '（家用结算Cu重）'].filter(v => v != null).join('\n'))
      assert.equal(row.netWeight, net)
      assert.equal(cells[6].value, '0.023200')
      assert.ok(!cells[8].value.includes('Zn'))
    }
  }
  assert.equal(sheetRowCells({ kind: 'PART', netWeight: '12' }, { code: 'ORDINARY_PARTS' }, 0)[8].value, '12')
})
