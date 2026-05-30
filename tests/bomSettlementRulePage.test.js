import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/bom.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/BomSettlementRulePage.vue')
const LEGACY_WRAPPER = path.join(ROOT, 'src/views/base/bomfilter/index.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V147__bom_settlement_rule_menu.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const wrapperContent = fs.readFileSync(LEGACY_WRAPPER, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')
const removedEndpoint = ['drill', 'rules'].join('-')
const removedAction = ['STOP', 'AND', 'COST', 'ROW'].join('_')
const removedTraceField = ['matched', 'Drill', 'Rule', 'Id'].join('')
const removedPageName = ['Bom', 'Filter', 'Rule', 'Page'].join('')

describe('BSR-08 BOM 结算规则页面和接口', () => {
  it('菜单入口改为 BOM 结算规则并指向新页面', () => {
    assert.match(menuContent, /menu_name = 'BOM 结算规则'/)
    assert.match(menuContent, /path = '\/bom-data\/settlement-rules'/)
    assert.match(menuContent, /component = 'pages:BomSettlementRulePage'/)
    assert.match(menuContent, /perms = 'bom-data:settlement-rule:list'/)
    assert.doesNotMatch(menuContent, /DELETE FROM sys_menu/)
  })

  it('前端 API 调用新 settlement-rules 端点', () => {
    assert.match(apiContent, /listSettlementRules/)
    assert.match(apiContent, /createSettlementRule/)
    assert.match(apiContent, /updateSettlementRule/)
    assert.match(apiContent, /deleteSettlementRule/)
    assert.match(apiContent, /toggleSettlementRule/)
    assert.match(apiContent, /\/api\/v1\/bom\/settlement-rules/)
    assert.match(apiContent, /\/api\/v1\/bom\/byproduct-cost-rules/)
  })

  it('规则页面不再暴露旧停止下钻动作', () => {
    assert.match(pageContent, /BOM 结算规则/)
    assert.match(pageContent, /SETTLEMENT_ACTION_OPTIONS/)
    assert.match(pageContent, /listSettlementRules/)
    assert.match(pageContent, /新增规则/)
    assert.match(pageContent, /编辑/)
    assert.match(pageContent, /停用/)
    assert.match(pageContent, /优先级/)
    assert.equal(pageContent.includes(removedEndpoint), false)
    assert.equal(pageContent.includes(removedAction), false)
    assert.equal(pageContent.includes(removedTraceField), false)
  })

  it('旧 bomfilter wrapper 指向新 settlement 页面', () => {
    assert.match(wrapperContent, /BomSettlementRulePage/)
    assert.equal(wrapperContent.includes(removedPageName), false)
  })
})
