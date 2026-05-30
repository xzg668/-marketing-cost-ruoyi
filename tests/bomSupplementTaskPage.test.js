import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGE_FILE = path.join(ROOT, 'src/pages/BomSupplementTaskPage.vue')
const API_FILE = path.join(ROOT, 'src/api/bomSupplementTasks.js')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V141__quote_bom_preparation_menu_restructure.sql'
)

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('QBP-08 BOM 补录任务财务审核页', () => {
  it('菜单入口指向真实任务页', () => {
    assert.match(menuContent, /40467,\s*'BOM 补录任务'/)
    assert.match(menuContent, /'pages:BomSupplementTaskPage'/)
  })

  it('API 覆盖列表、详情、确认和退回端点', () => {
    assert.match(apiContent, /\/api\/v1\/bom-supplement\/tasks/)
    assert.match(apiContent, /fetchBomSupplementTasks/)
    assert.match(apiContent, /fetchBomSupplementTaskDetail/)
    assert.match(apiContent, /reviewBomSupplementTask[\s\S]*\/review/)
    assert.match(apiContent, /returnBomSupplementTask[\s\S]*\/return/)
  })

  it('页面展示技术员提交内容、差异日志和完整 BOM 预览', () => {
    assert.match(pageContent, /本体 BOM 明细/)
    assert.match(pageContent, /包装参考成品料号/)
    assert.match(pageContent, /包装组件明细/)
    assert.match(pageContent, /技术员调整差异/)
    assert.match(pageContent, /完整 BOM 预览/)
    assert.match(pageContent, /修改前/)
    assert.match(pageContent, /修改后/)
  })

  it('审核动作只提供财务确认和退回，不暴露结算行编辑入口', () => {
    assert.match(pageContent, /财务确认/)
    assert.match(pageContent, /退回技术员/)
    assert.match(pageContent, /不会直接生成结算行/)
    assert.doesNotMatch(pageContent, /编辑结算行/)
    assert.doesNotMatch(pageContent, /build-costing-rows/)
  })

  it('长字段表格使用 overflow tooltip 和断行保护', () => {
    assert.match(pageContent, /show-overflow-tooltip/)
    assert.match(pageContent, /word-break:\s*break-word/)
    assert.match(pageContent, /minmax\(0,\s*1fr\)/)
  })
})
