import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const sidebarContent = fs.readFileSync(
  path.join(ROOT, 'src/layout/components/Sidebar.vue'),
  'utf-8',
)
const sidebarItemContent = fs.readFileSync(
  path.join(ROOT, 'src/layout/components/SidebarItem.vue'),
  'utf-8',
)

describe('侧边栏菜单导航', () => {
  it('由 Element Plus Router 模式统一执行路由跳转', () => {
    assert.match(sidebarContent, /:router="true"/)
    assert.doesNotMatch(sidebarItemContent, /@click="onClick"/)
    assert.doesNotMatch(sidebarItemContent, /useRouter/)
    assert.doesNotMatch(sidebarItemContent, /router\.push/)
  })

  it('导航异常时保留原页面并给出明确提示', () => {
    assert.match(sidebarContent, /@select="handleMenuSelect"/)
    assert.match(sidebarContent, /routerResult\.catch/)
    assert.match(sidebarContent, /页面跳转失败，请刷新后重试/)
  })
})
