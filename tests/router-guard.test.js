import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

describe('路由配置检查', () => {

  it('导入 LoginPage 组件', () => {
    assert.match(routerContent, /import\s+LoginPage\s+from/)
  })

  it('定义 /login 路由', () => {
    assert.match(routerContent, /path:\s*['"]\/login['"]/)
  })

  it('/login 路由标记为 public', () => {
    assert.match(routerContent, /public:\s*true/)
  })

  it('使用 LoginPage 组件', () => {
    assert.match(routerContent, /component:\s*LoginPage/)
  })

  it('定义 beforeEach 全局前置守卫', () => {
    assert.match(routerContent, /router\.beforeEach/)
  })

  it('守卫中检查 token', () => {
    assert.match(routerContent, /localStorage\.getItem\(['"]token['"]\)/)
  })

  it('无 token 时跳转到 /login', () => {
    assert.match(routerContent, /path:\s*['"]\/login['"]/)
  })

  it('跳转登录页时携带 redirect 参数', () => {
    assert.match(routerContent, /redirect/)
  })

  it('已登录用户访问 /login 时重定向到首页', () => {
    // 检查存在 token && 目标是 /login 时 next('/') 的逻辑
    assert.match(routerContent, /\/login/)
    assert.match(routerContent, /next\(['"]\/['"]\)/)
  })
})

describe('MainLayout 退出登录检查', () => {
  const layoutFile = path.resolve(import.meta.dirname, '../src/layouts/MainLayout.vue')
  const layoutContent = fs.readFileSync(layoutFile, 'utf-8')

  it('包含退出登录按钮', () => {
    assert.match(layoutContent, /退出登录/)
  })

  it('退出时清除 token', () => {
    assert.match(layoutContent, /localStorage\.removeItem\(['"]token['"]\)/)
  })

  it('退出后跳转到 /login', () => {
    assert.match(layoutContent, /router\.push\(['"]\/login['"]\)/)
  })

  it('使用 el-button 组件', () => {
    assert.match(layoutContent, /el-button/)
  })
})

describe('LoginPage 登录页检查', () => {
  const loginFile = path.resolve(import.meta.dirname, '../src/pages/LoginPage.vue')
  const loginContent = fs.readFileSync(loginFile, 'utf-8')

  it('LoginPage.vue 文件存在', () => {
    assert.ok(fs.existsSync(loginFile))
  })

  it('使用 Element Plus 表单组件', () => {
    assert.match(loginContent, /el-form/)
    assert.match(loginContent, /el-input/)
    assert.match(loginContent, /el-button/)
  })

  it('包含用户名输入框', () => {
    assert.match(loginContent, /username/)
  })

  it('包含密码输入框（show-password）', () => {
    assert.match(loginContent, /password/)
    assert.match(loginContent, /show-password/)
  })

  it('导入 auth API 的 login 方法', () => {
    assert.match(loginContent, /import.*login.*from.*auth/)
  })

  it('登录成功后保存 token 到 localStorage', () => {
    assert.match(loginContent, /localStorage\.setItem\(['"]token['"]/)
  })

  it('登录失败显示错误提示', () => {
    assert.match(loginContent, /ElMessage\.error/)
  })

  it('包含 el-card 容器', () => {
    assert.match(loginContent, /el-card/)
  })

  it('包含 User 和 Lock 图标', () => {
    assert.match(loginContent, /User/)
    assert.match(loginContent, /Lock/)
  })
})
