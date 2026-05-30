import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/u9BomByproduct.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/U9BomByproductPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V145__u9_bom_byproduct_master.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('U9 BOM副产品档案', () => {
  it('封装独立接口，不复用料品主档接口', () => {
    assert.match(apiContent, /\/api\/v1\/base\/u9\/bom-byproduct/)
    assert.match(apiContent, /importU9BomByproductExcel/)
    assert.match(apiContent, /fetchU9BomByproductRows/)
    assert.match(apiContent, /fetchU9BomByproductTemplateMapping/)
    assert.doesNotMatch(apiContent, /material-master/)
  })

  it('页面查询和表格覆盖副产品关键字段，且没有批次入口', () => {
    ;[
      'label="母件料号"',
      'label="母件名称"',
      'label="副产品料号"',
      'label="副产品名称"',
      'label="BOM目的"',
      'label="有效日期"',
      'prop="parentMaterialNo" label="母件料号"',
      'prop="bomPurpose" label="BOM目的"',
      'prop="byproductMaterialNo" label="副产品料号"',
      'prop="effectiveFrom" label="生效日期"',
      'prop="effectiveTo" label="失效日期"',
      '去重键：BOM目的 \\+ 母件料号 \\+ 副产品料号 \\+ 生效日期 \\+ 失效日期',
    ].forEach((text) => assert.match(pageContent, new RegExp(text)))

    assert.doesNotMatch(pageContent, /fetchU9MaterialBatches/)
    assert.doesNotMatch(pageContent, /label="批次"/)
    assert.doesNotMatch(pageContent, /batchNo/)
  })

  it('菜单挂在基础数据 / U9基础数据 下，权限独立', () => {
    assert.match(menuContent, /40469,\s*'BOM副产品档案',\s*40435/)
    assert.match(menuContent, /\/base\/u9\/bom-byproduct/)
    assert.match(menuContent, /'pages:U9BomByproductPage'/)
    assert.match(menuContent, /base:u9-bom-byproduct:list/)
    assert.match(menuContent, /base:u9-bom-byproduct:import/)
    assert.match(menuContent, /base:u9-bom-byproduct:export/)
  })

  it('DDL 使用五字段自然键幂等导入，不包含导入批次字段', () => {
    assert.match(menuContent, /UNIQUE KEY uk_u9_bom_byproduct_natural/)
    assert.match(menuContent, /bom_purpose/)
    assert.match(menuContent, /parent_material_no/)
    assert.match(menuContent, /byproduct_material_no/)
    assert.match(menuContent, /effective_from/)
    assert.match(menuContent, /effective_to/)
    assert.doesNotMatch(menuContent, /import_batch_id/)
  })
})
