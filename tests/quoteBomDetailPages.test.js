import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/quoteBomDetails.js')
const PACKAGE_PAGE = path.join(ROOT, 'src/pages/PackageComponentStructurePage.vue')
const COSTING_PAGE = path.join(ROOT, 'src/pages/BomCostingRowPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V141__quote_bom_preparation_menu_restructure.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const packagePageContent = fs.readFileSync(PACKAGE_PAGE, 'utf-8')
const costingPageContent = fs.readFileSync(COSTING_PAGE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('QBP-11 BOM 明细页面完善', () => {
  it('菜单入口指向包装组件结构和结算明细真实页面', () => {
    assert.match(menuContent, /40464,\s*'包装组件结构'/)
    assert.match(menuContent, /'pages:PackageComponentStructurePage'/)
    assert.match(menuContent, /menu_name = 'BOM 结算明细'/)
    assert.match(menuContent, /component = 'pages:BomCostingRowPage'/)
  })

  it('API 覆盖包装结构和结算明细查询端点', () => {
    assert.match(apiContent, /\/api\/v1\/quote-bom-details/)
    assert.match(apiContent, /fetchQuoteBomPackageStructures/)
    assert.match(apiContent, /package-structures/)
    assert.match(apiContent, /fetchQuoteBomCostingProducts/)
    assert.match(apiContent, /costing-products/)
    assert.match(apiContent, /fetchQuoteBomCostingRows/)
    assert.match(apiContent, /costing-rows/)
  })

  it('包装组件结构页展示完整父件和子件字段', () => {
    ;[
      '参考成品料号',
      '目件料号',
      '包装父件料号',
      '包装父件名称',
      '父件规格',
      '父件型号',
      '父件图号',
      '父件形态',
      '父件主分类',
      '父件单位',
      '父件用量',
      '父件累计用量',
      '父件母件底数',
      '子件料号',
      '子件名称',
      '子件规格',
      '子件型号',
      '子件图号',
      '子件形态',
      '子件主分类',
      '子件单位',
      '子件用量',
      '子件累计用量',
      '子件母件底数',
      '来源路径',
    ].forEach((label) => assert.match(packagePageContent, new RegExp(label)))
    assert.match(packagePageContent, /show-overflow-tooltip/)
    assert.match(packagePageContent, /word-break:\s*break-word/)
  })

  it('包装组件结构页不展示技术字段缺口文案', () => {
    assert.match(packagePageContent, /提示：/)
    assert.doesNotMatch(packagePageContent, /结构字段存在缺口/)
    assert.doesNotMatch(packagePageContent, /source_top_product_code/)
  })

  it('BOM 结算明细页只读展示来源追溯和规则命中', () => {
    assert.match(costingPageContent, /OA 产品料号/)
    assert.match(costingPageContent, /结算明细数/)
    assert.match(costingPageContent, /@click="openDetail\(row\)">明细/)
    assert.match(costingPageContent, /fetchQuoteBomCostingProducts/)
    assert.match(costingPageContent, /fetchQuoteBomCostingRows/)
    assert.match(costingPageContent, /来源追溯/)
    assert.match(costingPageContent, /sourceRefs/)
    assert.match(costingPageContent, /结算规则命中/)
    assert.match(costingPageContent, /matchedSettlementRuleId/)
    assert.match(costingPageContent, /matchedSettlementRuleName/)
    assert.match(costingPageContent, /settlementRowType/)
    assert.match(costingPageContent, /sourceSummary/)
    assert.match(costingPageContent, /结算路径/)
    assert.doesNotMatch(costingPageContent, /编辑结算行/)
    assert.doesNotMatch(costingPageContent, /el-button[^>]*(新增|保存|删除)/)
  })
})
