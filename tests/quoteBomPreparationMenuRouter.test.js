import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V141__quote_bom_preparation_menu_restructure.sql'
)
const SETTLEMENT_RULE_MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V147__bom_settlement_rule_menu.sql'
)
const PERMISSION_FILE = path.join(ROOT, 'src/store/modules/permission.js')
const PLACEHOLDER_PAGE = path.join(ROOT, 'src/pages/BomPreparationPlaceholderPage.vue')
const PRODUCT_BOM_PAGE = path.join(ROOT, 'src/views/ingest/quote-request-products/bom/index.vue')
const QUOTE_REQUEST_PAGE = path.join(ROOT, 'src/views/ingest/quote-requests/index.vue')

const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')
const settlementRuleMenuContent = fs.readFileSync(SETTLEMENT_RULE_MENU_FILE, 'utf-8')
const permissionContent = fs.readFileSync(PERMISSION_FILE, 'utf-8')
const placeholderContent = fs.readFileSync(PLACEHOLDER_PAGE, 'utf-8')
const productBomPageContent = fs.readFileSync(PRODUCT_BOM_PAGE, 'utf-8')
const quoteRequestPageContent = fs.readFileSync(QUOTE_REQUEST_PAGE, 'utf-8')

describe('QBP-01 报价产品 BOM 准备菜单和路由', () => {
  it('报价需求下的产品 BOM 入口改名为准备工作台', () => {
    assert.match(menuContent, /menu_name = '报价产品 BOM 准备'/)
    assert.match(menuContent, /WHERE menu_id = 208/)
    assert.match(menuContent, /quote-request-products\/bom/)
    assert.match(productBomPageContent, /报价产品 BOM 准备/)
    assert.match(quoteRequestPageContent, /产品 BOM 准备/)
    assert.doesNotMatch(productBomPageContent, /报价单产品 BOM 处理/)
  })

  it('BOM 数据管理下有 BOM 明细分组和四个明细入口', () => {
    assert.match(menuContent, /40461,\s*'BOM 数据管理',\s*0/)
    assert.match(menuContent, /40462,\s*'BOM 明细',\s*40461/)
    assert.match(menuContent, /menu_name = 'U9 BOM 原始数据'/)
    assert.match(menuContent, /40463,\s*'BOM 层级树查看',\s*40462/)
    assert.match(menuContent, /40464,\s*'包装组件结构',\s*40462/)
    assert.match(menuContent, /menu_name = 'BOM 结算明细'/)
  })

  it('BOM 规则和补录菜单挂在 BOM 数据管理下', () => {
    assert.match(menuContent, /WHERE menu_id = 301/)
    assert.match(settlementRuleMenuContent, /menu_name = 'BOM 结算规则'/)
    assert.match(menuContent, /parent_id = 40461/)
    assert.match(menuContent, /40467,\s*'BOM 补录任务',\s*40461/)
    assert.match(menuContent, /40468,\s*'补录 BOM 版本',\s*40461/)
  })

  it('新增页面组件可被动态路由解析', () => {
    assert.ok(fs.existsSync(PLACEHOLDER_PAGE))
    assert.match(menuContent, /'pages:BomTreeViewerPage'/)
    assert.match(menuContent, /'pages:BomCostingRowPage'/)
    assert.match(menuContent, /'pages:PackageComponentStructurePage'/)
    assert.match(settlementRuleMenuContent, /'pages:BomSettlementRulePage'/)
    assert.match(menuContent, /'pages:BomPreparationPlaceholderPage'/)
    assert.match(permissionContent, /const pageModules = import\.meta\.glob/)
    assert.match(permissionContent, /mapped\.startsWith\('pages:'\)/)
    assert.match(placeholderContent, /报价产品 BOM 准备/)
  })

  it('迁移脚本不删除既有菜单或角色授权', () => {
    assert.doesNotMatch(menuContent, /DELETE FROM sys_menu/)
    assert.doesNotMatch(menuContent, /DELETE FROM sys_role_menu/)
    assert.match(menuContent, /INSERT IGNORE INTO sys_role_menu/)
  })
})
