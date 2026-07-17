import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteBasePriceMappings.js')
const PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/price/linked/quote-base-mapping/index.vue')
const MENU_MIGRATION_FILE = path.resolve(
  import.meta.dirname,
  '../../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V194__metal_base_price_policy.sql',
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuMigrationContent = fs.readFileSync(MENU_MIGRATION_FILE, 'utf-8')

describe('金属基价取值规则 API', () => {
  it('提供取价规则查询和修改接口', () => {
    assert.match(apiContent, /fetchMetalBasePricePolicies/)
    assert.match(apiContent, /updateMetalBasePricePolicy/)
    assert.match(apiContent, /metal-base-price-policies/)
    assert.match(apiContent, /body:\s*\{ pricePolicy \}/)
  })

  it('保留底层映射接口供兼容和诊断使用', () => {
    assert.match(apiContent, /fetchQuoteBaseMappingRules/)
    assert.match(apiContent, /fetchFactorQuoteBaseMappings/)
  })
})

describe('金属基价取值规则页面', () => {
  it('只开放 Zn、Al 的两种取价方式', () => {
    assert.match(pageContent, /金属基价取值规则/)
    assert.match(pageContent, /OA_PRIORITY/)
    assert.match(pageContent, /FACTOR_MONTHLY/)
    assert.match(pageContent, /OA优先/)
    assert.match(pageContent, /影响因素表/)
    assert.doesNotMatch(pageContent, /新增规则/)
    assert.doesNotMatch(pageContent, /匹配关键词/)
  })

  it('Cu 只显示财务月度基准说明，不提供取价切换', () => {
    assert.match(pageContent, /铜价按财务月度基准核算/)
    assert.match(pageContent, /OA 铜基价只用于差异对比/)
    assert.match(pageContent, /固定规则/)
  })

  it('修改失败时重新读取服务端规则', () => {
    assert.match(pageContent, /updateMetalBasePricePolicy/)
    assert.match(pageContent, /catch \(error\)[\s\S]{0,180}loadPolicies\(\)/)
  })
})

describe('金属基价取值规则菜单迁移', () => {
  it('将原页面更名并保留在规则配置目录', () => {
    assert.match(menuMigrationContent, /menu_name = '金属基价取值规则'/)
    assert.match(menuMigrationContent, /parent_id = 40475/)
    assert.match(menuMigrationContent, /WHERE menu_id = 40421/)
  })
})
