import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGE_FILE = path.join(ROOT, 'src/pages/U9MaterialMasterPage.vue')
const PERMISSION_FILE = path.join(ROOT, 'src/store/modules/permission.js')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V96__u9_material_master_menu.sql'
)

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const permissionContent = fs.readFileSync(PERMISSION_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('U9MM-07 U9 料品主档菜单和路由', () => {
  it('菜单挂在基础数据 / U9基础数据 / 料品主档', () => {
    assert.match(menuContent, /40159,\s*'基础数据'/)
    assert.match(menuContent, /40435,\s*'U9基础数据',\s*40159/)
    assert.match(menuContent, /40436,\s*'料品主档',\s*40435/)
    assert.match(menuContent, /\/base\/u9\/material-master/)
  })

  it('动态菜单组件路径可解析到 pages 组件', () => {
    assert.ok(fs.existsSync(PAGE_FILE))
    assert.match(menuContent, /'pages:U9MaterialMasterPage'/)
    assert.match(permissionContent, /const pageModules = import\.meta\.glob/)
    assert.match(permissionContent, /mapped\.startsWith\('pages:'\)/)
    assert.match(pageContent, /料品主档/)
  })

  it('菜单权限点对齐后端 U9MM-06 接口', () => {
    assert.match(menuContent, /base:u9-material:list/)
    assert.match(menuContent, /base:u9-material:import/)
    assert.match(menuContent, /base:u9-material:export/)
    assert.doesNotMatch(menuContent, /base:u9-material:compare/)
    assert.doesNotMatch(menuContent, /base:u9-material:sync/)
  })

  it('seed 幂等且不会影响原基础数据菜单', () => {
    assert.match(menuContent, /ON DUPLICATE KEY UPDATE/)
    assert.match(menuContent, /INSERT IGNORE INTO sys_role_menu/)
    assert.doesNotMatch(menuContent, /DELETE FROM sys_menu/)
    assert.doesNotMatch(menuContent, /TRUNCATE TABLE/)
  })
})
