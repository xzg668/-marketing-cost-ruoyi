import test from 'node:test'
import assert from 'node:assert/strict'
import { quoteItemCostStatus, quoteItemCostAmount, withQuoteItemWorkflow } from '../src/utils/quoteItemWorkflow.js'

test('only a valid current success supplies the current cost, including exact zero', () => {
  for (const status of ['STALE', 'NOT_READY', 'RUNNING']) assert.equal(quoteItemCostAmount({ status, totalCost: '7.11906600' }), null)
  assert.equal(quoteItemCostAmount({ status: 'READY', totalCost: '7.11906600' }), '7.11906600')
  assert.equal(quoteItemCostAmount({ status: 'READY', totalCost: '0.00000000' }), '0.00000000')
})

test('a saved amount does not replace the actual current gap status with generic recalculation', () => {
  const item = withQuoteItemWorkflow({ items: [{ id: 12, confirmedCostVersionId: 44, costingWorkspace: {
    workspaceStatus: 'WAIT_PRICE', inputChanged: true, lastErrorMessage: '原料价格待核对：301110039',
  } }] }).items[0]
  assert.equal(item.workflow.currentStatus, 'MISSING_PRICE')
  assert.deepEqual(quoteItemCostStatus(item, { status: 'STALE', totalCost: '7.11906600' }), { code: 'MISSING_PRICE', label: '价格待核对' })
  assert.deepEqual(quoteItemCostStatus({ ...item, costingWorkspace: { workspaceStatus: 'WAIT_PRICE', lastErrorCode: 'SUPPLIER_RATIO_REVIEW_REQUIRED' } }, { status: 'STALE' }), { code: 'MISSING_SUPPLIER_RATIO', label: '缺供货比率' })
})
test('current success remains success and only an actual stale result needs recalculation', () => {
  const item = withQuoteItemWorkflow({ items: [{ id: 12, calcStatus: '已核算', confirmedCostVersionId: 44, costingWorkspace: { workspaceStatus: 'SUCCESS' } }] }).items[0]
  assert.deepEqual(quoteItemCostStatus(item, { status: 'READY', totalCost: '7.11906600' }), { code: 'COMPLETED', label: '核算完成' })
  assert.deepEqual(quoteItemCostStatus({ ...item, calcStatus: '待核算' }, { status: 'READY' }), { code: 'COMPLETED', label: '核算完成' })
  assert.deepEqual(quoteItemCostStatus(item, { status: 'STALE' }), { code: 'STALE', label: '待重新核算' })
})
