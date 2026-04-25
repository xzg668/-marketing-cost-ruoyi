import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T25：菜单 + 权限 + 路由 契约测试。
 *
 * 目的：防止 4 个联动价页面在 menu.js / router/index.js 中被意外改名或摘除 —
 * 一旦菜单丢失子项或 route 拿不到页面组件，管理员进入 UI 直接白屏，
 * 而后端 sys_menu seed 又与 menu.js 的 path 强一致。静态文本断言成本低、收益大。
 */

const MENU_FILE = path.resolve(
  import.meta.dirname,
  '../src/menu.js'
)
const ROUTER_FILE = path.resolve(
  import.meta.dirname,
  '../src/router/index.js'
)

const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

// 页面 path → 后端 sys_menu.path 对齐（V5 4011-4014）
// 公式配置 /price/linked/formula 暂从菜单隐藏（后端无落库接口），
// 路由/组件保留，故 LINKED_PAGES 仅断言菜单可见的 3 项；
// formula 的 router import / component map 断言单独保留在 router 分组里
const LINKED_PAGES = [
  { path: '/price/linked/result', title: '联动价格表' },
  { path: '/price/linked/oa-result', title: '联动价计算' },
  { path: '/price/linked/finance-base', title: '影响因素表' },
]

describe('menu.js 联动价分组契约', () => {
  it('含顶层 price 分组 + 联动价二级目录 /price/linked', () => {
    assert.match(menuContent, /index:\s*['"]price['"]/)
    assert.match(menuContent, /index:\s*['"]\/price\/linked['"]/)
    assert.match(menuContent, /title:\s*['"]联动价['"]/)
  })

  for (const page of LINKED_PAGES) {
    it(`菜单挂载 ${page.path} (${page.title})`, () => {
      assert.match(
        menuContent,
        new RegExp(`index:\\s*['"]${page.path}['"]`),
        `menu.js 缺少 ${page.path} 子项`
      )
      assert.match(
        menuContent,
        new RegExp(`title:\\s*['"]${page.title}['"]`),
        `menu.js 缺少 "${page.title}" 标题`
      )
    })
  }
})

describe('router/index.js 联动价路由契约', () => {
  it('导入 4 个联动价页面组件', () => {
    assert.match(
      routerContent,
      /import\s+PriceLinkedResultPage\s+from\s*['"]\.\.\/pages\/PriceLinkedResultPage\.vue['"]/
    )
    assert.match(
      routerContent,
      /import\s+PriceLinkedOaResultPage\s+from\s*['"]\.\.\/pages\/PriceLinkedOaResultPage\.vue['"]/
    )
    assert.match(
      routerContent,
      /import\s+PriceLinkedFormulaPage\s+from\s*['"]\.\.\/pages\/PriceLinkedFormulaPage\.vue['"]/
    )
    assert.match(
      routerContent,
      /import\s+PriceLinkedFinanceBasePage\s+from\s*['"]\.\.\/pages\/PriceLinkedFinanceBasePage\.vue['"]/
    )
  })

  for (const page of LINKED_PAGES) {
    it(`routeComponentMap 把 ${page.path} 映射到具体组件（避免回退到 PlaceholderPage）`, () => {
      // 允许 key 带/不带引号；值必须是组件标识符
      const re = new RegExp(
        `['"]${page.path}['"]\\s*:\\s*PriceLinked[A-Za-z]+Page`
      )
      assert.match(routerContent, re, `routeComponentMap 缺少 ${page.path} 映射`)
    })
  }

  it('/price/linked 根路径默认重定向到 /price/linked/result', () => {
    assert.match(
      routerContent,
      /path:\s*['"]\/price\/linked['"][\s\S]{0,80}redirect:\s*['"]\/price\/linked\/result['"]/
    )
  })

  it('router guard 校验 token + 未登录导航到 /login', () => {
    // 防止 T25 改动意外把权限保护摘掉 —— DoD: 普通用户 403 拦截
    assert.match(routerContent, /router\.beforeEach/)
    assert.match(routerContent, /['"]\/login['"]/)
    assert.match(routerContent, /permissionStore/)
  })
})
