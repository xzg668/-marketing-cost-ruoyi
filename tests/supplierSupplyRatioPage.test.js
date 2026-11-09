import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { formatPercent, normalizeSupplierRatioChange, supplierRatioChangeFields, supplierRatioFromPercent, supplierRatioPercentInput } from '../src/utils/supplierSupplyRatio.js'

const root = path.resolve(import.meta.dirname, '..')
const api = fs.readFileSync(path.join(root, 'src/api/supplierSupplyRatios.js'), 'utf8')
const page = fs.readFileSync(path.join(root, 'src/pages/SupplierSupplyRatioPage.vue'), 'utf8')
const dialog = fs.readFileSync(path.join(root, 'src/components/SupplierSupplyRatioImportDialog.vue'), 'utf8')

describe('供货比率按料号替换、沿用和追溯', () => {
  it('当前版本可编辑，保留导入和历史追溯且不允许删除', () => {
    assert.match(api, /import-excel/)
    assert.match(api, /fetchSupplierSupplyRatioChanges/)
    assert.match(api, /updateSupplierSupplyRatio/)
    assert.match(api, /method: 'PUT'/)
    assert.match(page, /openEdit\(row\)/)
    assert.match(page, /v-if="row.isActive === 1"/)
    assert.doesNotMatch(api, /DELETE|deleteSupplierSupplyRatio/)
    assert.doesNotMatch(page, /removeRow|el-date-picker/)
    assert.match(page, /base:supplier-supply-ratio:import/)
  })
  it('支持当前、历史和按批次追溯，明确无日期要求', () => {
    for (const text of ['当前版本', '历史版本', 'sourceBatchNo', 'supplierCode', 'before', 'after', 'previousVersionId', 'importFileName', 'changedByName']) assert.ok(page.includes(text))
    assert.match(dialog, /按料号整组更新/)
    assert.match(dialog, /未导入的料号沿用原值/)
    assert.match(dialog, /removedRelations/)
    assert.match(dialog, /无需填写生效日期/)
    assert.match(dialog, /unchangedRows/)
    assert.match(dialog, /无变更，未产生批次/)
  })
  it('比例精度保持到数据库的六位小数，不把微小比例显示为零', () => {
    assert.equal(formatPercent('0.000001'), '0.0001%')
    assert.equal(formatPercent('0.123456'), '12.3456%')
    assert.equal(formatPercent('0.65'), '65.00%')
  })
  it('空值与明确零分别展示', () => {
    for (const value of [null, undefined, '']) assert.equal(formatPercent(value), '未填写')
    assert.equal(formatPercent(0), '0.00%')
  })
  it('编辑回填和保存完整保留比例精度、空白和0%', () => {
    for (const value of ['0', '0.000001', '0.123456', '0.65', '1']) {
      assert.equal(Number(supplierRatioFromPercent(supplierRatioPercentInput(value))), Number(value))
    }
    assert.equal(supplierRatioPercentInput(null), '')
    assert.equal(supplierRatioFromPercent(' '), null)
    assert.equal(supplierRatioFromPercent('0'), '0.000000')
    assert.equal(supplierRatioFromPercent('65'), '0.650000')
    assert.equal(supplierRatioFromPercent('12.3456'), '0.123456')
  })
  it('编辑拒绝超界、非数字和会被舍入的比例', () => {
    for (const value of ['-1', '100.0001', 'abc', '1e1', 'NaN', '1.23456']) {
      assert.throws(() => supplierRatioFromPercent(value), /0到100/)
    }
  })
  it('整组替换移出的供应商不显示成未填写或零比例', () => {
    const change = normalizeSupplierRatioChange({ beforeValue: '{"supplyRatio":0.6}', afterValue: '{"isActive":0,"importFileName":"replace.xlsx"}' })
    const fields = supplierRatioChangeFields(change)
    assert.equal(fields.find(x => x.label === '供货比例').before, '60.00%')
    assert.equal(fields.find(x => x.label === '供货比例').after, '已移出当前集合')
  })
  it('新增没有旧版本，不能虚构旧零值', () => {
    const change = normalizeSupplierRatioChange({ beforeValue: null, afterValue: '{"supplyRatio":0,"supplierName":"供应商C"}' })
    const fields = supplierRatioChangeFields(change)
    assert.equal(fields.find(x => x.label === '供货比例').before, '无原记录')
    assert.equal(fields.find(x => x.label === '供货比例').after, '0.00%')
  })
  it('改前留空、改后零，以及元数据变更来自保存快照', () => {
    const change = normalizeSupplierRatioChange({ beforeValue: '{"supplyRatio":null,"unit":"件"}', afterValue: '{"supplyRatio":0,"unit":"套"}' })
    const fields = supplierRatioChangeFields(change)
    assert.deepEqual(fields.find(x => x.label === '供货比例'), { label: '供货比例', before: '未填写', after: '0.00%' })
    assert.deepEqual(fields.find(x => x.label === '单位'), { label: '单位', before: '件', after: '套' })
  })
})
