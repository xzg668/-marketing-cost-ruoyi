import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/monthlyReprice.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/MonthlyRepricePage.vue')
const VIEW_FILE = path.join(ROOT, 'src/views/settlement/monthly-adjustment/index.vue')
const COST_RUN_PAGE_FILE = path.join(ROOT, 'src/pages/CostRunPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V128__monthly_reprice_menu_seed.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const viewContent = fs.readFileSync(VIEW_FILE, 'utf-8')
const costRunContent = fs.readFileSync(COST_RUN_PAGE_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('T11 月度调价页面契约', () => {
  it('新增月度调价 API 封装，覆盖批次、进度、任务、结果、明细、审计和锁定状态', () => {
    for (const name of [
      'fetchMonthlyRepriceActiveLock',
      'fetchMonthlyRepriceBatches',
      'fetchMonthlyRepriceProgress',
      'createMonthlyRepriceBatch',
      'confirmMonthlyRepriceBatch',
      'cancelMonthlyRepriceBatch',
      'retryMonthlyRepriceFailedTasks',
      'fetchMonthlyRepriceTasks',
      'fetchMonthlyRepriceResults',
      'fetchMonthlyRepricePartItems',
      'fetchMonthlyRepriceCostItems',
      'fetchMonthlyRepriceAuditLogs',
    ]) {
      assert.match(apiContent, new RegExp(`export const ${name}`))
    }
    assert.match(apiContent, /\/api\/v1\/monthly-reprice\/active-lock/)
    assert.match(apiContent, /\/part-items/)
    assert.match(apiContent, /\/cost-items/)
  })

  it('菜单组件指向真实月度调价页面，不再是占位页', () => {
    assert.match(viewContent, /MonthlyRepricePage\.vue/)
    assert.doesNotMatch(viewContent, /PlaceholderPage/)
  })

  it('页面包含批次列表、结果查询、审计日志和详情 tabs', () => {
    assert.match(pageContent, /label="批次列表"/)
    assert.match(pageContent, /label="结果查询"/)
    assert.match(pageContent, /label="审计日志"/)
    assert.match(pageContent, /label="批次概览"/)
    assert.match(pageContent, /label="核算任务"/)
    assert.match(pageContent, /label="调价结果"/)
  })

  it('调价结果明细默认按产品成本计算一览表格式展示', () => {
    assert.match(pageContent, /label="产品成本计算一览表"/)
    assert.match(pageContent, />产品成本计算一览表</)
    for (const label of [
      '部品名',
      '部品料号',
      '部品图号',
      '部品单价',
      '部品用量',
      '部品价格',
      '材质',
      '形态属性',
      '价格来源',
      '不含税总成本',
    ]) {
      assert.match(pageContent, new RegExp(label))
    }
    assert.match(pageContent, /drillDrawer\.tab = 'sheet'/)
    assert.match(pageContent, /fetchMonthlyRepricePartItems\(repriceNo, resultId\)/)
    assert.match(pageContent, /fetchMonthlyRepriceCostItems\(repriceNo, resultId\)/)
  })

  it('结果查询默认落到同月份同业务单元最新 CONFIRMED 批次', () => {
    assert.match(pageContent, /status:\s*'CONFIRMED'/)
    assert.match(pageContent, /sortBy:\s*'confirmedAt'/)
    assert.match(pageContent, /sortDirection:\s*'desc'/)
  })

  it('发起弹窗只按月份和业务单元创建，并展示锁定提示', () => {
    assert.doesNotMatch(pageContent, /fetchFactorAdjustBatches/)
    assert.doesNotMatch(pageContent, /createForm\.adjustBatchId/)
    assert.match(pageContent, /调价月份和业务单元必填/)
    assert.match(pageContent, /prop="priceAsOfTime"/)
    assert.match(pageContent, /本次操作会锁定所选业务单元/)
    assert.match(pageContent, /月度调价结果不会覆盖原 OA 报价结果/)
  })

  it('确认按钮要求 WAIT_CONFIRM 且 failedCount 为 0', () => {
    assert.match(pageContent, /row\?\.status === 'WAIT_CONFIRM'/)
    assert.match(pageContent, /Number\(row\?\.failedCount \|\| 0\) === 0/)
  })

  it('普通成本核算页接入月度调价锁定提示并置灰试算按钮', () => {
    assert.match(costRunContent, /fetchMonthlyRepriceActiveLock/)
    assert.match(costRunContent, /activeRepriceLock\.locked/)
    assert.match(costRunContent, /:disabled="isCostRunLocked\(row\)"/)
    assert.match(costRunContent, /当前业务单元正在月度调价/)
  })

  it('菜单挂在成本核算下，并提供 list/review/operate 权限', () => {
    assert.match(menuContent, /503,\s*'月度调价',\s*500/)
    assert.match(menuContent, /'price:monthly-reprice:list'/)
    assert.match(menuContent, /'price:monthly-reprice:review'/)
    assert.match(menuContent, /'price:monthly-reprice:operate'/)
    assert.match(menuContent, /\(11,\s*503\),\s*\(11,\s*5031\)/)
  })
})
