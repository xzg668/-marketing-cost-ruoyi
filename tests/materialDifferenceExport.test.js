import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { materialDifferenceWorkbook, materialDifferenceFilename } from '../src/utils/materialDifferenceExport.js'
const sample = () => ({ oaNo: 'OA-001', topProductCode: '0000123', periodMonth: '2026-11', differences: [
  { materialCode: '00001', materialName: '=literal', quantity: 2, financeUnitPrice: 1, oaUnitPrice: 1.5, unitPriceDifference: .5, financeAmount: 2, oaAmount: 3, amountDifference: 1, differenceRate: 50, different: true },
  { materialCode: '202445[33001]', materialName: '废料回收', quantity: -2, financeUnitPrice: 1, oaUnitPrice: 2, unitPriceDifference: 1, financeAmount: -2, oaAmount: -4, amountDifference: -2, differenceRate: -100, different: true },
  { materialCode: 'ZERO', quantity: 1, financeUnitPrice: 0, oaUnitPrice: 0, unitPriceDifference: 0, financeAmount: 0, oaAmount: 0, amountDifference: 0, differenceRate: null, different: false },
] })
const roundTrip = book => XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellNF: true, cellStyles: true })
test('current filter exports signed values, exact identities and Excel direction colors', () => {
  const data = sample(), before = JSON.stringify(data)
  const book = roundTrip(materialDifferenceWorkbook(XLSX, data, { onlyDifferent: true }))
  const sheet = book.Sheets['材料差异对比']
  assert.equal(sheet.A2.v, '00001'); assert.equal(sheet.A2.t, 's'); assert.equal(sheet.B2.v, '=literal'); assert.equal(sheet.B2.f, undefined)
  assert.equal(sheet.A3.v, '202445[33001]'); assert.equal(sheet.I2.v, 1); assert.equal(sheet.I3.v, -2)
  assert.equal(sheet.I2.t, 'n'); assert.match(sheet.I2.z, /\[Red\]/); assert.match(sheet.I3.z, /\[Green\]/)
  assert.equal(sheet.J2.v, 50); assert.match(sheet.J2.z, /"%"/)
  assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.r, 2); assert.equal(JSON.stringify(data), before)
  assert.match(JSON.stringify(book.Sheets['对比说明']), /仅有差异/)
})
test('all rows retains zero and absent percentage distinctly', () => {
  const sheet = roundTrip(materialDifferenceWorkbook(XLSX, sample(), { onlyDifferent: false })).Sheets['材料差异对比']
  assert.equal(sheet.I4.v, 0); assert.equal(sheet.I4.t, 'n'); assert.equal(sheet.J4?.v ?? '', '')
  assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.r, 3)
})
test('precision beyond Excel limits remains exact text with its direction color', () => {
  const data=sample();data.differences[0].amountDifference='0.123456789012345678901'
  const sheet=roundTrip(materialDifferenceWorkbook(XLSX,data,{onlyDifferent:true})).Sheets['材料差异对比']
  assert.equal(sheet.I2.v,'0.123456789012345678901');assert.equal(sheet.I2.t,'s');assert.match(sheet.I2.z,/\[Red\]@$/)
})
test('empty export is rejected and file names identify quote, product and period', () => {
  assert.throws(() => materialDifferenceWorkbook(XLSX,{differences:[]},{onlyDifferent:true}), /没有可导出/)
  assert.equal(materialDifferenceFilename(sample()),'材料差异对比_OA-001_0000123_2026-11.xlsx')
})
