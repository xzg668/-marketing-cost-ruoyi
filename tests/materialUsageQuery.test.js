import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/materialUsage.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/MaterialUsageQueryPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V197__bom_part_where_used_query.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('物料使用查询页面', () => {
  it('兼容若依 PageResult 的 list 和普通分页 records', () => {
    assert.match(apiContent, /normalizeMaterialUsagePage/)
    assert.match(apiContent, /Array\.isArray\(page\.list\)/)
    assert.match(apiContent, /Array\.isArray\(page\.records\)/)
    assert.match(apiContent, /\/api\/v1\/base\/u9\/material-usage/)
  })

  it('只在用户输入完整物料料号后查询，避免无条件扫描关系表', () => {
    assert.match(pageContent, /请输入完整物料料号/)
    assert.match(pageContent, /if \(!code\)/)
    assert.match(pageContent, /ElMessage\.warning\('请输入物料料号'\)/)
    assert.doesNotMatch(pageContent, /onMounted\(fetchRows\)/)
  })

  it('清楚区分当前BOM潜在影响与历史报价', () => {
    assert.match(pageContent, /当前 BOM 潜在影响/)
    assert.match(pageContent, /不代表历史报价当时实际使用的 BOM/)
    assert.match(pageContent, /累计单台用量/)
    assert.match(pageContent, /示例BOM路径/)
  })

  it('菜单位于U9数据下且动态组件可解析', () => {
    assert.ok(fs.existsSync(PAGE_FILE))
    assert.match(menuContent, /'物料使用查询',\s*40435/)
    assert.match(menuContent, /'pages:MaterialUsageQueryPage'/)
    assert.match(menuContent, /base:u9-material-usage:list/)
  })
})
