import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteBasePriceMappings.js')
const PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/price/linked/quote-base-mapping/index.vue')
const MENU_SEED_FILE = path.resolve(
  import.meta.dirname,
  '../../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V87__quote_base_mapping_menu_seed.sql',
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuSeedContent = fs.readFileSync(MENU_SEED_FILE, 'utf-8')

describe('报价单基价映射规则 API', () => {
  it('覆盖规则列表、新增、编辑、启停、删除接口', () => {
    assert.match(apiContent, /fetchQuoteBaseMappingRules/)
    assert.match(apiContent, /createQuoteBaseMappingRule/)
    assert.match(apiContent, /updateQuoteBaseMappingRule/)
    assert.match(apiContent, /setQuoteBaseMappingRuleEnabled/)
    assert.match(apiContent, /deleteQuoteBaseMappingRule/)
    assert.match(apiContent, /BASE_PATH\s*=\s*['"]\/api\/v1\/price-linked['"]/)
    assert.match(apiContent, /quote-base-mapping-rules/)
  })

  it('保留影响因素识别结果查询接口', () => {
    assert.match(apiContent, /fetchFactorQuoteBaseMappings/)
    assert.match(apiContent, /factor-quote-base-mappings/)
  })
})

describe('报价单基价映射规则页面', () => {
  it('存在动态菜单组件页面', () => {
    assert.ok(fs.existsSync(PAGE_FILE))
    assert.match(pageContent, /报价单基价映射规则/)
    assert.match(pageContent, /QUOTE_FIELD_OPTIONS/)
  })

  it('支持多个匹配关键词并以数组提交给后端', () => {
    assert.match(pageContent, /v-model="form\.matchKeywords"/)
    assert.match(pageContent, /multiple/)
    assert.match(pageContent, /allow-create/)
    assert.match(pageContent, /matchKeywords:\s*form\.matchKeywords/)
  })

  it('操作成功后刷新列表', () => {
    assert.match(pageContent, /createQuoteBaseMappingRule[\s\S]{0,260}loadRows\(\)/)
    assert.match(pageContent, /updateQuoteBaseMappingRule[\s\S]{0,260}loadRows\(\)/)
    assert.match(pageContent, /deleteQuoteBaseMappingRule[\s\S]{0,260}loadRows\(\)/)
  })
})

describe('报价单基价映射规则菜单 seed', () => {
  it('挂在联动价目录下并指向前端组件', () => {
    assert.match(menuSeedContent, /40421,\s*'报价单基价映射规则',\s*40165/)
    assert.match(menuSeedContent, /\/price\/linked\/quote-base-mapping/)
    assert.match(menuSeedContent, /price\/linked\/quote-base-mapping\/index/)
    assert.match(menuSeedContent, /price:quote-base-mapping:list/)
  })

  it('补齐新增、编辑、删除权限点', () => {
    assert.match(menuSeedContent, /price:quote-base-mapping:add/)
    assert.match(menuSeedContent, /price:quote-base-mapping:edit/)
    assert.match(menuSeedContent, /price:quote-base-mapping:remove/)
  })
})
