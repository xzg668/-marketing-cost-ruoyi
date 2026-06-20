import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunDetailPage.vue')
const DRAWER_FILE = path.resolve(import.meta.dirname, '../src/components/CostRunTraceDrawer.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/costRunDetail.js')

const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')
const drawerContent = fs.readFileSync(DRAWER_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('T10 成本一览表核算底稿抽屉', () => {
  it('详情页工具栏和金额列接入核算底稿抽屉', () => {
    assert.match(detailPageContent, /CostRunTraceDrawer/)
    assert.match(detailPageContent, />核算底稿</)
    assert.match(detailPageContent, /openTraceDrawer\(\)/)
    assert.match(detailPageContent, /openPartTrace\(item\)/)
    assert.match(detailPageContent, /openCostTrace\('DIRECT_LABOR'\)/)
    assert.match(detailPageContent, /openCostTrace\('MGMT_EXP'\)/)
    assert.match(detailPageContent, /openCostTrace\('TOTAL'\)/)
    assert.match(detailPageContent, /class="trace-link/)
    assert.match(detailPageContent, /productCode \|\| route\.query\.materialCode/)
  })

  it('底稿抽屉按 costRunNo 拉列表和详情并展示通用 JSON 区块', () => {
    assert.match(drawerContent, /fetchCostRunTraces/)
    assert.match(drawerContent, /fetchCostRunTraceDetail/)
    assert.match(drawerContent, /PART_PRICE/)
    assert.match(drawerContent, /COST_ITEM/)
    assert.match(drawerContent, /TOTAL/)
    assert.match(drawerContent, /来源快照/)
    assert.match(drawerContent, /计算口径/)
    assert.match(drawerContent, /变量取值/)
    assert.match(drawerContent, /计算步骤/)
    assert.match(drawerContent, /该版本未生成底稿快照/)
    assert.match(drawerContent, /findInitialTrace/)
    assert.match(drawerContent, /partItemId/)
    assert.match(drawerContent, /costItemId/)
    assert.match(drawerContent, /hasTraceSelector/)
    assert.match(drawerContent, /未找到对应底稿条目/)
  })

  it('costRunDetail API 封装底稿列表和单条详情接口', () => {
    assert.match(apiContent, /fetchCostRunTraces/)
    assert.match(apiContent, /fetchCostRunTraceDetail/)
    assert.match(apiContent, /\/api\/v1\/cost-run\/detail\/\$\{encodeURIComponent/)
    assert.match(apiContent, /\/traces\/\$\{encodeURIComponent/)
  })
})
