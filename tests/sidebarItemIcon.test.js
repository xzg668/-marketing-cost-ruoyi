import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SIDEBAR_ITEM_FILE = path.join(ROOT, 'src/layout/components/SidebarItem.vue')
const sidebarItemContent = fs.readFileSync(SIDEBAR_ITEM_FILE, 'utf-8')

describe('SidebarItem 菜单图标展示', () => {
  it('U9/CMS 数据目录和供应商供货比例不展示左侧小图标', () => {
    assert.match(sidebarItemContent, /ICONLESS_MENU_TITLES/)
    assert.match(sidebarItemContent, /'U9数据'/)
    assert.match(sidebarItemContent, /'U9基础数据'/)
    assert.match(sidebarItemContent, /'CMS数据'/)
    assert.match(sidebarItemContent, /'CMS成本数据'/)
    assert.match(sidebarItemContent, /'供应商供货比例'/)
    assert.match(sidebarItemContent, /'供应商供货比率'/)
    assert.match(sidebarItemContent, /ICONLESS_MENU_PATHS/)
    assert.match(sidebarItemContent, /'\/base\/u9'/)
    assert.match(sidebarItemContent, /'\/base\/cms-cost'/)
    assert.match(sidebarItemContent, /'\/base\/supplier-relation\/supply-ratio'/)
    assert.match(sidebarItemContent, /if \(shouldHideIcon\.value\) return null/)
  })
})
