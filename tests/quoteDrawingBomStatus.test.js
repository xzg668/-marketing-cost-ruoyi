import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed, reactive } from 'vue'
import { quoteItemWorkflow, withQuoteItemWorkflow } from '../src/utils/quoteItemWorkflow.js'
import { workflowStatusTagType } from '../src/utils/workflowStatus.js'

const item = {
  id: 21, electronicDrawingWorkflowId: 21, electronicDrawingAccountingMonth: '2026-10',
  bomStatus: { bomStatus: 'NO_BOM', errorMessage: '未在 lp_bom_raw_hierarchy 找到正式 BOM' },
  costingWorkspace: { workspaceStatus: 'WAIT_BOM', lastErrorCode: 'BOM_MISSING', lastErrorMessage: '未在 lp_bom_raw_hierarchy 找到正式 BOM' },
}
const drawing = (task = {}, workflowStage = '') => ({
  itemId: 21, accountingMonth: '2026-10', workflowStage,
  current: { localTaskId: 5, taskState: 'RECEIVED', consumptionState: 'COMPLETE', currentResultId: 12, ...task },
})

function noMissingBom(workflow) {
  assert.notEqual(workflow.bomStatus, 'NO_BOM')
  assert.notEqual(workflow.currentStatus, 'MISSING_BOM')
  assert.doesNotMatch([workflow.bomStatusLabel, workflow.priceStatusLabel, workflow.currentStatusLabel, workflow.message].join(' '), /待补BOM|无BOM|lp_bom_raw_hierarchy/)
}

test('只有U9无BOM且尚无图库结果时，保留实际缺口', () => {
  const workflow = quoteItemWorkflow(item)
  assert.equal(workflow.bomStatus, 'NO_BOM')
  assert.equal(workflow.currentStatus, 'MISSING_BOM')
  assert.equal(workflow.nextAction, 'VIEW_COSTING_GAP')
})

test('有差异的当前任务统一显示待图纸确认；不把确认当作价格检查', () => {
  const workflow = quoteItemWorkflow(item, drawing({ taskState: 'WAIT_REVIEW', consumptionState: 'NOT_READY', differenceCount: 2, currentResultId: null }))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatusLabel, '待图纸确认')
  assert.equal(workflow.currentStatusLabel, '待图纸确认')
  assert.equal(workflow.priceStatusLabel, '待检查')
  assert.equal(workflow.actionEnabled, false)
  assert.equal(workflowStatusTagType(workflow.currentStatus), 'warning')
})

test('确认接收但消费未完成时显示图库处理中，旧已组好阶段不能提前算就绪', () => {
  const workflow = quoteItemWorkflow(item, drawing({ consumptionState: 'PENDING' }, 'E_DRAWING_COMPOSED'))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatusLabel, '图库明细已接收')
  assert.equal(workflow.currentStatusLabel, '图库处理中')
  assert.equal(workflow.actionEnabled, false)
})

test('核验尚未返回或获取失败时，不能沿用旧的BOM就绪阶段', () => {
  const requesting = quoteItemWorkflow(item, drawing({ taskState: 'REQUESTING', consumptionState: 'NOT_READY' }, 'E_DRAWING_COMPOSED'))
  assert.equal(requesting.currentStatusLabel, '图库获取中')
  assert.equal(requesting.actionEnabled, false)
  const failed = quoteItemWorkflow(item, drawing({ taskState: 'FAILED', consumptionState: 'NOT_READY', errorMessage: '图库服务连接超时' }, 'E_DRAWING_COMPOSED'))
  assert.equal(failed.bomStatusLabel, '图库获取失败')
  assert.equal(failed.message, '图库服务连接超时')
})

test('待匹配料号展示已有图库明细并继续使用真实U9选料入口', () => {
  const workflow = quoteItemWorkflow(item, drawing({}, 'MAPPING_PENDING'))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatusLabel, '已有图库明细')
  assert.equal(workflow.currentStatusLabel, '待匹配料号')
  assert.equal(workflow.nextAction, 'RESOLVE_ELECTRONIC_DRAWING_MATERIAL')
  assert.equal(workflow.nextActionLabel, '选择U9料号')
  const withoutWorkflow = quoteItemWorkflow({ ...item, electronicDrawingWorkflowId: null }, drawing({}, 'MAPPING_PENDING'))
  assert.equal(withoutWorkflow.nextAction, 'VIEW_COSTING_GAP')
})

test('旧共享来源没有PDF任务时，已保存的待匹配阶段仍正确展示', () => {
  const workflow = quoteItemWorkflow({ ...item, electronicDrawingStage: 'MAPPING_PENDING' })
  noMissingBom(workflow)
  assert.equal(workflow.nextAction, 'RESOLVE_ELECTRONIC_DRAWING_MATERIAL')
})

test('已取得明细但尚未组好，不显示缺BOM，也不提前允许核算', () => {
  const workflow = quoteItemWorkflow(item, drawing({}, 'MATCHING'))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatusLabel, '已有图库明细')
  assert.equal(workflow.currentStatus, 'BOM_IN_PROGRESS')
  assert.equal(workflow.nextAction, 'VIEW_COSTING_GAP')
  assert.doesNotMatch(workflow.message, /已组好|已就绪/)
})

test('图库BOM就绪后继续显示真实技术资料缺口', () => {
  const workflow = quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'WAIT_TECH_DATA', lastErrorMessage: '缺少已生效包装资料' } }, drawing({}, 'E_DRAWING_COMPOSED'))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatus, 'AVAILABLE')
  assert.equal(workflow.bomStatusLabel, '电子图库BOM已就绪')
  assert.equal(workflow.currentStatus, 'MISSING_TECH_DATA')
  assert.equal(workflow.message, '缺少已生效包装资料')
  assert.equal(workflow.nextAction, 'VIEW_COSTING_GAP')
})

test('图库处理过的产品仍显示实际价格缺口和财务处理人', () => {
  const workflow = quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'WAIT_PRICE', lastErrorCode: 'FINANCE_BASE_PRICE_MISSING', lastErrorMessage: '料号PART-1缺少财务价格' } }, drawing({}, 'E_DRAWING_PUBLISHED'))
  noMissingBom(workflow)
  assert.equal(workflow.currentStatus, 'MISSING_PRICE')
  assert.equal(workflow.message, '料号PART-1缺少财务价格')
  assert.equal(workflow.assigneeName, '财务报价')
})

test('明细已接收但阶段信息滞后时，也不能覆盖后续技术资料缺口', () => {
  const workflow = quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'WAIT_TECH_DATA', lastErrorMessage: '缺少制造件工艺资料' } }, drawing({}, 'MATCHING'))
  noMissingBom(workflow)
  assert.equal(workflow.currentStatus, 'MISSING_TECH_DATA')
  assert.equal(workflow.message, '缺少制造件工艺资料')
})

test('图库BOM已组好仍有真实子BOM缺口时，保留具体缺口内容', () => {
  const workflow = quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'WAIT_BOM', lastErrorMessage: '制造件PART-2缺少U9子BOM' } }, drawing({}, 'E_DRAWING_COMPOSED'))
  assert.equal(workflow.bomStatus, 'AVAILABLE')
  assert.equal(workflow.currentStatusLabel, '待完善BOM资料')
  assert.equal(workflow.message, '制造件PART-2缺少U9子BOM')
  assert.equal(workflow.nextAction, 'VIEW_COSTING_GAP')
})

test('图库BOM已就绪时，旧U9根BOM缺失不再阻止继续原核算检查', () => {
  const workflow = quoteItemWorkflow(item, drawing({}, 'E_DRAWING_COMPOSED'))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatus, 'AVAILABLE')
  assert.equal(workflow.currentStatus, 'READY_FOR_COSTING')
  assert.equal(workflow.nextAction, 'START_COSTING')
  assert.equal(workflow.priceStatusLabel, '待检查')
  assert.match(workflow.message, /继续后续资料检查/)
})

test('图库就绪且资料齐全时继续核算；已有成功成本继续查看原结果', () => {
  const workspace = drawing({}, 'E_DRAWING_COMPOSED')
  const ready = quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'READY' } }, workspace)
  assert.equal(ready.currentStatus, 'READY_FOR_COSTING')
  assert.equal(ready.nextAction, 'START_COSTING')
  const success = quoteItemWorkflow({ ...item, calcStatus: '已核算', confirmedCostVersionId: 99, costingWorkspace: { workspaceStatus: 'SUCCESS' } }, workspace)
  assert.equal(success.currentStatus, 'COMPLETED')
  assert.equal(success.nextAction, 'VIEW_COSTING_RESULT')
})

test('已组好的来源尚无核算工作区时仍可发起原来的核算检查', () => {
  const workflow = quoteItemWorkflow({ ...item, costingWorkspace: null }, drawing({}, 'E_DRAWING_COMPOSED'))
  noMissingBom(workflow)
  assert.equal(workflow.currentStatus, 'READY_FOR_COSTING')
  assert.equal(workflow.nextAction, 'START_COSTING')
  assert.equal(workflow.priceStatusLabel, '待检查')
})

test('核算中和输入变化状态仍优先，不被残留图库进度覆盖', () => {
  const waiting = drawing({ taskState: 'WAIT_REVIEW', consumptionState: 'NOT_READY' })
  assert.equal(quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'RUNNING' } }, waiting).currentStatus, 'COSTING')
  assert.equal(quoteItemWorkflow({ ...item, costingWorkspace: { workspaceStatus: 'STALE', inputChanged: true } }, waiting).currentStatus, 'STALE')
})

test('消费失败保留已有明细并显示真实处理失败；不能回退成无BOM', () => {
  const workflow = quoteItemWorkflow(item, drawing({ consumptionState: 'FAILED', errorMessage: '图号PART-3数量格式错误' }))
  noMissingBom(workflow)
  assert.equal(workflow.bomStatusLabel, '已有图库明细')
  assert.equal(workflow.currentStatusLabel, '图库处理失败')
  assert.equal(workflow.message, '图号PART-3数量格式错误')
})

test('真实U9可用或图库已让位U9时，保留U9状态', () => {
  const u9 = { ...item, bomStatus: { bomStatus: 'U9_BOM_EXISTS' }, costingWorkspace: { workspaceStatus: 'READY' } }
  assert.equal(quoteItemWorkflow(u9, drawing({}, 'E_DRAWING_COMPOSED')).bomStatusLabel, 'U9有此BOM')
  assert.equal(quoteItemWorkflow(u9, drawing({ consumptionState: 'NOT_READY' })).currentStatus, 'READY_FOR_COSTING')
})

test('其他产品、其他月份和已替换任务不能覆盖本行状态', () => {
  for (const workspace of [{ ...drawing({}, 'E_DRAWING_COMPOSED'), itemId: 22 }, { ...drawing({}, 'E_DRAWING_COMPOSED'), accountingMonth: '2026-09' }, drawing({ taskState: 'SUPERSEDED' }, 'E_DRAWING_COMPOSED')]) {
    assert.equal(quoteItemWorkflow(item, workspace).bomStatus, 'NO_BOM')
  }
})

test('状态轮询到达后BOM、价格和当前状态一起更新；不更改原始业务记录', () => {
  const source = { items: [item] }, before = JSON.stringify(source), states = reactive({})
  const rows = computed(() => withQuoteItemWorkflow(source, states).items)
  assert.equal(rows.value[0].workflow.currentStatus, 'MISSING_BOM')
  states[21] = drawing({ taskState: 'WAIT_REVIEW' })
  assert.equal(rows.value[0].workflow.currentStatusLabel, '待图纸确认')
  assert.equal(rows.value[0].workflow.bomStatusLabel, '待图纸确认')
  states[21] = drawing({ consumptionState: 'PENDING' })
  assert.equal(rows.value[0].workflow.currentStatusLabel, '图库处理中')
  states[21] = drawing({}, 'MAPPING_PENDING')
  assert.equal(rows.value[0].workflow.currentStatusLabel, '待匹配料号')
  assert.equal(JSON.stringify(source), before)
})
