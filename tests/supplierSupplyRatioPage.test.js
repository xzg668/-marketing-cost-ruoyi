import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { decimalToPercent, percentToDecimal, formatPercent } from '../src/utils/supplierSupplyRatio.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/supplierSupplyRatios.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/SupplierSupplyRatioPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V90__supplier_supply_ratio_menu.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const importContent = fs.readFileSync(path.join(ROOT, 'src/components/SupplierSupplyRatioImportDialog.vue'), 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('SSR-07 供应商供货比例 API', () => {
  it('封装查询、导入、更新和删除接口', () => {
    assert.match(apiContent, /\/api\/v1\/supplier-supply-ratios/)
    assert.match(apiContent, /export const fetchSupplierSupplyRatios/)
    assert.match(apiContent, /export const importSupplierSupplyRatioExcel/)
    assert.match(apiContent, /\/import-excel/)
    assert.match(apiContent, /method:\s*'PATCH'/)
    assert.match(apiContent, /method:\s*'DELETE'/)
    assert.match(apiContent, /normalizeSupplierSupplyRatioPage/)
    assert.match(apiContent, /toSupplierSupplyRatioFormData/)
  })
})

describe('SSR-07 供应商供货比例页面', () => {
  it('菜单组件路径可由动态路由解析到 pages 组件', () => {
    assert.ok(fs.existsSync(PAGE_FILE))
    assert.match(menuContent, /'供应商供货比例'/)
    assert.match(menuContent, /\/base\/supplier-relation\/supply-ratio/)
    assert.match(menuContent, /'pages:SupplierSupplyRatioPage'/)
  })

  it('提供查询条件、表格字段和操作按钮', () => {
    assert.match(pageContent, /label="物料代码"/)
    assert.match(pageContent, /label="物料名称"/)
    assert.match(pageContent, /label="型号"/)
    assert.match(pageContent, /label="供应商"/)
    assert.match(pageContent, /label="来源"/)
    assert.match(pageContent, /prop="sourceBatchNo" label="批次"/)
    assert.match(pageContent, /label="供货比例"/)
    assert.match(pageContent, /openEdit/)
    assert.match(pageContent, /removeRow/)
  })

  it('来源筛选覆盖 EXCEL/SRM/MANUAL，不把 SRM 写死成唯一来源', () => {
    assert.match(pageContent, /value:\s*'EXCEL'/)
    assert.match(pageContent, /value:\s*'SRM'/)
    assert.match(pageContent, /value:\s*'MANUAL'/)
    assert.doesNotMatch(pageContent, /sourceType:\s*'SRM'/)
  })

  it('导入弹窗展示去重口径和导入结果明细', () => {
    assert.match(importContent, /按物料整组更新/)
    assert.match(importContent, /totalRows/)
    assert.match(importContent, /insertedRows/)
    assert.match(importContent, /deactivatedRows/)
    assert.match(importContent, /unfilledRatioRows/)
    assert.doesNotMatch(importContent, /missingRatioAsZero|skippedRows/)
  })

  it('供货比例页面显示百分比，提交给后端使用 decimal', () => {
    assert.match(pageContent, /formatPercent/)
    assert.match(pageContent, /decimalToPercent/)
    assert.match(pageContent, /percentToDecimal/)
    assert.match(pageContent, /supplyRatio:\s*percentToDecimal/)
    assert.equal(percentToDecimal(60), 0.6)
  })

  it('权限点对齐 V90 菜单 seed', () => {
    assert.match(pageContent, /base:supplier-supply-ratio:import/)
    assert.match(pageContent, /base:supplier-supply-ratio:edit/)
    assert.match(pageContent, /base:supplier-supply-ratio:remove/)
    assert.match(menuContent, /base:supplier-supply-ratio:list/)
    assert.match(menuContent, /base:supplier-supply-ratio:import/)
    assert.match(menuContent, /base:supplier-supply-ratio:edit/)
    assert.match(menuContent, /base:supplier-supply-ratio:remove/)
  })
})


describe('未填写比例和明确零比例必须区分', () => {
  it('展示、打开编辑、保存空值时都保持未填写', () => {
    for (const value of [null, undefined, '']) {
      assert.equal(formatPercent(value), '未填写')
      assert.equal(decimalToPercent(value), null)
      assert.equal(percentToDecimal(value), null)
    }
  })

  it('明确填写的零比例不变成未填写', () => {
    assert.equal(formatPercent(0), '0.00%')
    assert.equal(decimalToPercent(0), 0)
    assert.equal(percentToDecimal(0), 0)
    assert.equal(formatPercent(0.65), '65.00%')
  })
})
