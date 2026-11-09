import test from 'node:test'
import assert from 'node:assert/strict'
import * as layout from '../src/utils/jjbSheet.js'

test('reference header uses one A:P grid with merged B:C and the six original header rows', () => {
  const rows = layout.sheetHeaderRows({ identity: { oaNo: 'OA-1', productCode: '000001' }, header: { financeCuPrice: '90.000000', customerCuPrice: '100.000000', quotation: { copperPrice: '101000.000000', customerCuPrice: '101.000000' } } })
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0].cells[1], { column: 1, colspan: 2, value: 'OA-1', label: false })
  assert.equal(rows[0].cells.find(c => c.column === 13).value, '101000.000000')
  assert.equal(rows[3].cells.find(c => c.column === 9).value, '101.000000')
  assert.equal(layout.jjbColumnWidths.length, 16)
  assert.equal(layout.jjbColumns[15][1], '备注-CMS\n来源信息')
})

test('three expenses and four optional fees have vertical labels and names in column C', () => {
  const rows = ['模具费', '认证费', '折旧费', '工装夹具费'].map((name, i) => ({ section: 'PRODUCT_FEES', kind: 'FEE', name, amount: i ? null : '0.000000' }))
  const group = layout.sheetGroups({ rows })[0]
  const first = layout.sheetRowCells(rows[0], group, 0)
  assert.equal(first[0].rowspan, 4)
  assert.equal(first[0].value, '新品费用')
  assert.equal(first.find(c => c.column === 2).value, '模具费')
  assert.equal(first.find(c => c.column === 6).value, '0.000000')
  const next = layout.sheetRowCells(rows[1], group, 1)
  assert.equal(next.some(c => c.column === 0), false)
  assert.equal(next.find(c => c.column === 6).value, '')
})

test('property coefficient is shown once in G; monetary totals still come from saved model', () => {
  const row = { kind: 'PROPERTY', section: 'PROPERTY', name: '产品属性', remark: '非标品', coefficient: '1.05' }
  const cells = layout.sheetRowCells(row, { code: 'PROPERTY', rows: [row] }, 0)
  assert.equal(cells[0].value, '产品属性')
  assert.equal(cells[2].value, '非标品')
  assert.equal(cells[6].value, '1.05')
  assert.deepEqual(layout.sheetTotals({ totals: { totalCost: '1.000000', cuMaterialAdjustment: '-2.000000', finalQuoteAmount: '-1.000000' } }).map(r => r.amount), ['1.000000', '-2.000000', '-1.000000'])
})


test('measurement unit and original price source accompany the unchanged quantity and amount', () => {
  const row = { kind: 'PART', code: 'M', quantity: '0.00001', unit: '千克', unitPrice: '1259.115000', amount: '0.012591', priceSource: '发票价格' }
  const cells = layout.sheetRowCells(row, { code: 'ORDINARY_PARTS' }, 0)
  for (const key of ['quantity', 'unit', 'unitPrice', 'amount', 'priceSource']) assert.equal(cells.find(cell => cell.key === key).value, row[key])
  assert.equal(cells.length, 16)
  for (const header of layout.sheetHeaderRows({})) assert.equal(header.cells.reduce((sum, cell) => sum + cell.colspan, 0), 16)
})
