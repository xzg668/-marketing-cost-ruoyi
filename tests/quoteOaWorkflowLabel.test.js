import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quoteOaWorkflowLabel } from '../src/utils/quoteOaWorkflowLabel.js'

const ready = { status: 'READY', totalProducts: 1, readyProducts: 1 }
test('报价员核算完成显示待提交，价格费率变化不改变保存结果状态', () => {
  for (const state of ['COSTING', 'RECOSTING', 'TECHNICAL']) {
    assert.equal(quoteOaWorkflowLabel({ state, label: '待核算' }, ready), '已核算，待提交 OA')
  }
})
test('未完成、部分完成、读取中仍保留原流程状态', () => {
  const workflow = { state: 'COSTING', label: '待核算' }
  for (const submission of [null, { totalProducts: 0, readyProducts: 0 }, { totalProducts: 2, readyProducts: 1 }]) {
    assert.equal(quoteOaWorkflowLabel(workflow, submission), '待核算')
  }
})
test('完成成本不能覆盖流程同步问题或其他办理节点', () => {
  assert.equal(quoteOaWorkflowLabel({ state: 'COSTING', label: '待核算', syncError: '未同步' }, ready), '待核算')
  assert.equal(quoteOaWorkflowLabel({ state: 'CANCELLED', label: '已取消' }, ready), '已取消')
})
test('提交处理、未知、审批和完成显示真实提交状态', () => {
  for (const [status, label] of Object.entries({ PENDING: '成本提交中', UNKNOWN: 'OA 提交结果待确认', SUBMITTED: '成本审批中', COMPLETED: '已完成' })) {
    assert.equal(quoteOaWorkflowLabel({ state: 'COSTING', label: '待核算' }, { ...ready, status }), label)
  }
})
