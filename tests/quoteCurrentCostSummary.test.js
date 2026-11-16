import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { compile, createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import * as workflow from '../src/utils/quoteItemWorkflow.js'

const completed = id => ({ id, calcStatus: '已核算', costingWorkspace: { workspaceStatus: 'SUCCESS', currentCostVersionId: id + 100, inputChanged: false, gapCount: 0 } })
async function renderStatus(batchRun, items) {
  const template = parse(readFileSync(new URL('../src/pages/QuoteRequestDetailPage.vue', import.meta.url), 'utf8')).descriptor.template.content
  const start = template.search(/    <(?:div v-if="batchRun|section v-if="!batchRun)/)
  const fragment = template.slice(start, template.indexOf('    <el-alert v-if="detail.oaWorkflow"'))
  const app = createSSRApp({ render: compile(fragment), setup: () => ({ batchRun,
    currentCostSummary: workflow.quoteCurrentCostSummary?.(items),
    batchBusinessOutcomeLabel: () => '失败', batchStatusLabel: () => '执行失败' }) })
  app.component('el-alert', { props: ['title', 'description'], setup: p => () => h('div', { role: 'alert' }, [p.title, p.description]) })
  app.component('el-progress', { render: () => h('progress') })
  return renderToString(app)
}
test('a failed old batch is collapsed history after the product successfully recalculates', async () => {
  const html = await renderStatus({ active: false, status: 'FAILED', businessOutcome: 'FAILED', failedCount: 1, message: '旧缺口' }, [completed(174)])
  assert.match(html, /<details[^>]*>/)
  assert.doesNotMatch(html.match(/<details[^>]*>/)[0], /\bopen\b/)
  assert.match(html, /当前核算结果：全部已核算/)
  assert.match(html, /历史/)
  assert.ok(html.indexOf('旧缺口') > html.indexOf('<details'))
})
test('current missing data, failure, running and changed inputs are never concealed by saved costs', () => {
  const items = ['SUCCESS', 'WAIT_PRICE', 'SYSTEM_FAILED', 'RUNNING', 'QUEUED', 'STALE', 'SUCCESS', 'READY'].map((status, i) => {
    const item = completed(i); item.costingWorkspace.workspaceStatus = status
    if (i === 6) item.costingWorkspace.inputChanged = true
    return item
  })
  const value = workflow.quoteCurrentCostSummary(items)
  assert.deepEqual(Object.fromEntries(['success', 'waiting', 'failed', 'running', 'stale', 'pending'].map(k => [k, value[k]])),
    { success: 1, waiting: 1, failed: 1, running: 2, stale: 2, pending: 1 })
  assert.equal(value.type, 'info')
})
test('zero products, missing current versions and unresolved drawing reviews cannot claim all success', () => {
  const missing = completed(1); missing.costingWorkspace.currentCostVersionId = null
  const drawing = completed(2); drawing.workflow = { currentStatus: 'E_DRAWING_WAIT_REVIEW' }
  for (const items of [[], [missing], [drawing]]) assert.notEqual(workflow.quoteCurrentCostSummary(items).type, 'success')
})
test('an active batch remains expanded and its failure message is visible', async () => {
  const html = await renderStatus({ active: true, status: 'RUNNING', message: '当前执行信息' }, [completed(1)])
  assert.match(html.match(/<details[^>]*>/)[0], /\bopen\b/)
  assert.match(html, /当前执行信息/)
  assert.doesNotMatch(html, /当前核算结果：全部已核算/)
})
test('a successful old batch cannot conceal a current failed product', async () => {
  const item = completed(1); item.costingWorkspace.workspaceStatus = 'SYSTEM_FAILED'
  const html = await renderStatus({ active: false, status: 'SUCCESS' }, [item])
  assert.match(html, /当前核算结果：有产品核算失败/)
  assert.ok(html.indexOf('有产品核算失败') < html.indexOf('<details'))
})

test('107 products with 60 successes, 45 gaps and 2 failures show a partial result without a whole-order error', async () => {
  const items = Array.from({ length: 107 }, (_, i) => {
    const item = completed(i)
    if (i >= 60) item.costingWorkspace.workspaceStatus = i < 105 ? 'WAIT_PRICE' : 'SYSTEM_FAILED'
    return item
  })
  const value = workflow.quoteCurrentCostSummary(items)
  assert.equal(value.type, 'warning')
  assert.match(value.title, /部分已核算/)
  assert.equal(value.success, 60)
  assert.equal(value.waiting, 45)
  assert.equal(value.failed, 2)
  assert.match(value.description, /已核算 60.*待补资料 45.*失败 2/)
  assert.match(value.description, /不影响其他产品核算/)
  const html = await renderStatus({ active: false, status: 'FAILED' }, items)
  assert.match(html, /当前核算结果：部分已核算/)
})

test('only entirely failed results use an error; mixed waiting products and fully successful products stay distinct', () => {
  const failed = { costingWorkspace: { workspaceStatus: 'SYSTEM_FAILED' } }
  const waiting = { costingWorkspace: { workspaceStatus: 'WAIT_PRICE' } }
  assert.equal(workflow.quoteCurrentCostSummary([failed]).type, 'error')
  assert.equal(workflow.quoteCurrentCostSummary([failed, waiting]).type, 'warning')
  assert.equal(workflow.quoteCurrentCostSummary([completed(1)]).type, 'success')
})
