import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api', `make${'Part'}Spec.js`)
const PAGE_FILE = path.join(ROOT, 'src/pages', `Make${'Part'}SpecPage.vue`)
const VIEW_FILE = path.join(ROOT, 'src/views/price/make/index.vue')
const NEW_PAGE_FILE = path.join(ROOT, 'src/views/price/make-calc/index.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V101__remove_make_part_spec_menu.sql'
)
const OLD_BACKEND_FILES = [
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/controller/MakePartSpecController.java',
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/MakePartSpecService.java',
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/impl/MakePartSpecServiceImpl.java',
  '../marketing-cost-api/marketing-cost-core/src/main/java/com/sanhua/marketingcost/service/pricing/MakePartResolver.java',
  '../marketing-cost-api/marketing-cost-core/src/main/java/com/sanhua/marketingcost/service/pricing/MakeSpecPriceResolver.java',
  '../marketing-cost-api/marketing-cost-core/src/main/java/com/sanhua/marketingcost/service/PriceScrapService.java',
].map((file) => path.resolve(ROOT, file))
const CLEANUP_MIGRATION_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V237__drop_obsolete_runtime_schema_artifacts.sql'
)
const MAKE_PRICE_PREPARE_STRATEGY_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/impl/MakePartPricePrepareStrategyImpl.java'
)
const MAKE_PRICE_PREPARE_CONTRACT_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/MakePartPricePrepareStrategy.java'
)

const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')
const cleanupMigrationContent = fs.readFileSync(CLEANUP_MIGRATION_FILE, 'utf-8')
const makePricePrepareStrategyContent = fs.readFileSync(MAKE_PRICE_PREPARE_STRATEGY_FILE, 'utf-8')
const makePricePrepareContractContent = fs.readFileSync(MAKE_PRICE_PREPARE_CONTRACT_FILE, 'utf-8')

describe('MPPG-10 旧自制件管理入口收口', () => {
  it('前端不再保留旧自制件管理页面、wrapper 和 API', () => {
    assert.equal(fs.existsSync(API_FILE), false)
    assert.equal(fs.existsSync(PAGE_FILE), false)
    assert.equal(fs.existsSync(VIEW_FILE), false)
    assert.equal(fs.existsSync(NEW_PAGE_FILE), true)
  })

  it('菜单脚本删除旧自制件管理入口和 make:part 权限', () => {
    assert.match(menuContent, /V101: 下线旧自制件管理菜单和权限/)
    assert.match(menuContent, /component IN \('price\/make\/index', 'views:price\/make\/index', 'pages:Make.+SpecPage'\)/)
    assert.match(menuContent, /perms LIKE 'make:part:%'/)
    assert.match(menuContent, /DELETE FROM sys_role_menu/)
    assert.match(menuContent, /DELETE FROM sys_menu/)
    assert.doesNotMatch(menuContent, /TRUNCATE TABLE/)
  })

  it('后端不再保留旧规格、旧废料价接口和兼容解析器', () => {
    for (const file of OLD_BACKEND_FILES) assert.equal(fs.existsSync(file), false)
    assert.match(cleanupMigrationContent, /DROP TABLE IF EXISTS `lp_make_part_spec`/)
    assert.match(cleanupMigrationContent, /DROP TABLE IF EXISTS `lp_price_scrap`/)
  })

  it('实时成本制造件取价使用生成表准备策略，旧 pricing Resolver 已下线', () => {
    assert.match(makePricePrepareStrategyContent, /@Service/)
    assert.match(makePricePrepareStrategyContent, /lp_make_part_price_calc_row/)
    assert.match(makePricePrepareContractContent, /禁止回退/)
    assert.equal(fs.existsSync(path.dirname(MAKE_PRICE_PREPARE_STRATEGY_FILE).replace('/impl', '/pricing')), true)
    assert.equal(fs.readdirSync(path.dirname(MAKE_PRICE_PREPARE_STRATEGY_FILE).replace('/impl', '/pricing')).length, 0)
  })
})
