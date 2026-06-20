import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')
const PERMISSION_FILE = path.resolve(import.meta.dirname, '../src/store/modules/permission.js')
const SIDEBAR_FILE = path.resolve(import.meta.dirname, '../src/layout/components/Sidebar.vue')
const API_DIR = path.resolve(import.meta.dirname, '../src/api')
const VIEWS_DIR = path.resolve(import.meta.dirname, '../src/views')
const PAGES_DIR = path.resolve(import.meta.dirname, '../src/pages')

const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')
const permissionContent = fs.readFileSync(PERMISSION_FILE, 'utf-8')
const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8')

describe('动态菜单路由契约', () => {
  it('不再依赖已下线的 src/menu.js 静态菜单', () => {
    assert.equal(fs.existsSync(path.resolve(import.meta.dirname, '../src/menu.js')), false)
    assert.match(routerContent, /permissionStore\.generateRoutes/)
    assert.match(permissionContent, /fetchRouters/)
  })

  it('保留动态组件解析入口', () => {
    assert.match(permissionContent, /const viewModules = import\.meta\.glob/)
    assert.match(permissionContent, /const pageModules = import\.meta\.glob/)
    assert.match(permissionContent, /function loadView/)
  })

  it('保留联动价动态组件别名', () => {
    assert.match(permissionContent, /'price\/price-linked\/index'\s*:\s*'views:price\/linked\/result\/index'/)
    assert.match(permissionContent, /'rate\/finance-base-price\/index'\s*:\s*'pages:PriceLinkedFinanceBasePage'/)
  })

  it('新增报价单基价映射规则动态组件', () => {
    assert.ok(fs.existsSync(path.join(VIEWS_DIR, 'price/linked/quote-base-mapping/index.vue')))
  })

  it('/price/linked 根路径仍默认重定向到 /price/linked/result', () => {
    assert.match(
      routerContent,
      /path:\s*['"]\/price\/linked['"][\s\S]{0,80}redirect:\s*['"]\/price\/linked\/result['"]/
    )
  })
})

describe('T9 报价需求菜单路由契约', () => {
  it('新增报价单接入 API 模块', () => {
    assert.ok(fs.existsSync(path.join(API_DIR, 'quoteRequests.js')))
    assert.ok(fs.existsSync(path.join(API_DIR, 'quoteIngest.js')))
  })

  it('新增四个报价需求菜单组件', () => {
    assert.ok(fs.existsSync(path.join(VIEWS_DIR, 'ingest/quote-requests/index.vue')))
    assert.ok(fs.existsSync(path.join(VIEWS_DIR, 'ingest/quote-request-products/bom/index.vue')))
    assert.ok(fs.existsSync(path.join(VIEWS_DIR, 'ingest/quote-requests/import/index.vue')))
    assert.ok(fs.existsSync(path.join(VIEWS_DIR, 'ingest/quote-ingest-logs/index.vue')))
  })

  it('新增报价单详情隐藏路由组件', () => {
    assert.ok(fs.existsSync(path.join(PAGES_DIR, 'QuoteRequestDetailPage.vue')))
    assert.match(routerContent, /path:\s*['"]\/ingest\/quote-requests\/:oaNo['"]/)
    assert.match(routerContent, /activeMenu:\s*['"]\/ingest\/quote-requests['"]/)
  })

  it('侧边栏保留 200 报价需求顶级菜单，隐藏旧 OA 报价单但保留旧 BOM 接入子入口', () => {
    assert.match(sidebarContent, /LEGACY_MENU_IDS/)
    assert.match(sidebarContent, /201,\s*300,\s*400,\s*500,\s*40166/)
    assert.match(sidebarContent, /LEGACY_OA_PATHS/)
    assert.match(sidebarContent, /OA报价单/)
    assert.doesNotMatch(sidebarContent, /202,\s*203,\s*204/)
    assert.doesNotMatch(sidebarContent, /LEGACY_MENU_IDS\s*=\s*new Set\(\[\s*200/)
    assert.match(sidebarContent, /pruneLegacyMenus/)
  })
})
