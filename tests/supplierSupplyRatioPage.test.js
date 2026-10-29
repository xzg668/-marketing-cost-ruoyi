import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { formatPercent, normalizeSupplierRatioChange, supplierRatioChangeFields } from '../src/utils/supplierSupplyRatio.js'

const root = path.resolve(import.meta.dirname, '..')
const api = fs.readFileSync(path.join(root, 'src/api/supplierSupplyRatios.js'), 'utf8')
const page = fs.readFileSync(path.join(root, 'src/pages/SupplierSupplyRatioPage.vue'), 'utf8')
const dialog = fs.readFileSync(path.join(root, 'src/components/SupplierSupplyRatioImportDialog.vue'), 'utf8')

describe('MRP-02 供货关系增量导入和追溯', () => {
  it('仅保留导入写入，历史覆盖入口已移除', () => {
    assert.match(api, /import-excel/)
    assert.match(api, /fetchSupplierSupplyRatioChanges/)
    assert.doesNotMatch(api, /PATCH|DELETE|updateSupplierSupplyRatio|deleteSupplierSupplyRatio/)
    assert.doesNotMatch(page, /openEdit|removeRow|el-date-picker/)
    assert.match(page, /base:supplier-supply-ratio:import/)
  })
  it('支持当前、历史和按批次追溯，明确无日期要求', () => {
    for (const text of ['当前版本', '历史版本', 'sourceBatchNo', 'supplierCode', 'before', 'after', 'previousVersionId', 'importFileName', 'changedByName']) assert.ok(page.includes(text))
    assert.match(dialog, /按物料和供应商增量更新/)
    assert.match(dialog, /无需填写生效日期/)
    assert.match(dialog, /unchangedRows/)
    assert.match(dialog, /无变更，未产生批次/)
    assert.doesNotMatch(dialog, /按物料整组更新/)
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
