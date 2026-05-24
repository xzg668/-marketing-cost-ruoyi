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
const CONTROLLER_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/controller/MakePartSpecController.java'
)
const MAKE_CALC_RESOLVER_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/pricing/MakePartPriceCalcResolver.java'
)
const LEGACY_RESOLVER_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/java/com/sanhua/marketingcost/service/pricing/MakeSpecPriceResolver.java'
)

const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')
const controllerContent = fs.readFileSync(CONTROLLER_FILE, 'utf-8')
const makeCalcResolverContent = fs.readFileSync(MAKE_CALC_RESOLVER_FILE, 'utf-8')
const legacyResolverContent = fs.readFileSync(LEGACY_RESOLVER_FILE, 'utf-8')

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

  it('后端旧接口只保留查询兼容，写入类接口被阻断且有中文说明', () => {
    assert.match(controllerContent, /旧自制件规格只作历史兼容/)
    assert.match(controllerContent, /实时成本新口径不读取/)
    assert.match(controllerContent, /LEGACY_DISABLED_MESSAGE/)
    assert.match(controllerContent, /@GetMapping/)
    assert.match(controllerContent, /@PostMapping/)
    assert.match(controllerContent, /@PatchMapping/)
    assert.match(controllerContent, /@DeleteMapping/)
  })

  it('实时成本制造件取价使用生成表 Resolver，旧规格 Resolver 不作为 Spring Bean 注入', () => {
    assert.match(makeCalcResolverContent, /@Service/)
    assert.match(makeCalcResolverContent, /lp_make_part_price_calc_row/)
    assert.match(makeCalcResolverContent, /禁止回退/)
    assert.doesNotMatch(legacyResolverContent, /@Service/)
    assert.match(legacyResolverContent, /@Deprecated/)
  })
})
