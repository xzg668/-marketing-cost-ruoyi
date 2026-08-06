import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const page = fs.readFileSync(path.join(ROOT, 'src/pages/MaterialQuoteShapePolicyPage.vue'), 'utf8')
const permission = fs.readFileSync(path.join(ROOT, 'src/store/modules/permission.js'), 'utf8')
const menu = fs.readFileSync(
  path.resolve(ROOT, '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V203__material_quote_shape_policy_menu.sql'),
  'utf8'
)

describe('QEB-13 物料形态规则菜单与权限', () => {
  it('菜单唯一挂在规则配置下并可解析到pages组件', () => {
    assert.match(menu, /40483, '报价 BOM 物料形态规则', 40475/)
    assert.match(menu, /'\/rules\/material-quote-shape-policy'/)
    assert.match(menu, /'pages:MaterialQuoteShapePolicyPage'/)
    assert.match(permission, /const pageModules = import\.meta\.glob/)
    assert.doesNotMatch(menu, /DELETE FROM sys_menu/)
  })

  it('查看、编辑、启停权限与后端权限点一致', () => {
    assert.match(menu, /bom-data:material-shape-policy:list/)
    assert.match(menu, /bom-data:material-shape-policy:edit/)
    assert.match(menu, /bom-data:material-shape-policy:toggle/)
    assert.match(page, /v-hasPermi="\['bom-data:material-shape-policy:edit'\]"/)
    assert.match(page, /v-hasPermi="\['bom-data:material-shape-policy:toggle'\]"/)
    assert.match(page, /v-hasPermi="\['system:operation-log:list'\]"/)
  })

  it('菜单迁移幂等且默认只授权超级管理员', () => {
    assert.match(menu, /ON DUPLICATE KEY UPDATE/)
    assert.match(menu, /INSERT IGNORE INTO sys_role_menu/)
    assert.match(menu, /\(1, 40475\), \(1, 40483\), \(1, 40484\), \(1, 40485\), \(1, 40486\)/)
    assert.doesNotMatch(menu, /\(10, 40483\)|\(11, 40483\)/)
  })
})
