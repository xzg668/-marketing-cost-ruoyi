import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasQuoteItemCostingGap, withQuoteItemWorkflow } from '../src/utils/quoteItemWorkflow.js'

test('上次成本待重算且本次有缺口时，仍计入待处理汇总；只有输入变化不冒充缺资料', () => {
  assert.equal(hasQuoteItemCostingGap({ costingWorkspace: { workspaceStatus: 'STALE', gapCount: 1, lastErrorMessage: '材料301210119未取得价格' } }), true)
  assert.equal(hasQuoteItemCostingGap({ costingWorkspace: { workspaceStatus: 'STALE', gapCount: 0 } }), false)
})

for (const workspaceStatus of ['WAIT_PRICE', 'WAIT_PRICE_TYPE']) {
  for (const hasCost of [false, true]) {
    test(`${workspaceStatus} ${hasCost ? '已有成本' : '首次核算'}：补录后可重新检查核算，同时保留缺口入口`, () => {
      const detail = { items: [{
        id: 991396,
        materialNo: '1145100050625',
        calcStatus: hasCost ? '已核算' : '未核算',
        confirmedCostVersionId: hasCost ? 100 : null,
        electronicDrawingStage: 'E_DRAWING_PUBLISHED',
        costingWorkspace: {
          workspaceStatus,
          lastErrorMessage: '已读取BOM结算明细并完成价格准备，存在待补充缺口',
          gapCount: 10,
        },
      }] }
      const before = structuredClone(detail)
      const [item] = withQuoteItemWorkflow(detail).items

      assert.equal(item.workflow.nextAction, hasCost ? 'RESTART_COSTING' : 'START_COSTING')
      assert.equal(item.workflow.nextActionLabel, hasCost ? '重新核算本产品' : '核算本产品')
      assert.equal(item.workflow.actionEnabled, true)
      assert.equal(hasQuoteItemCostingGap(item), true)
      assert.equal(item.workflow.currentStatus, 'MISSING_PRICE')
      assert.deepEqual(detail, before, '展示核算入口不能把旧缺口改成资料齐全')
    })
  }
}

for (const [code, label, status] of [
  ['SUPPLIER_RATIO_REVIEW_REQUIRED', '缺供货比率', 'MISSING_SUPPLIER_RATIO'],
  ['PRICE_AND_SUPPLIER_RATIO_MISSING', '价格/供货比率待处理', 'MISSING_PRICE'],
  ['PRICE_MISSING', '价格待核对', 'MISSING_PRICE'],
]) {
  test(`真实缺口${code}：显示具体原因且保留再次核算`, () => {
    const [item] = withQuoteItemWorkflow({ items: [{ id: 162, costingWorkspace: {
      workspaceStatus: 'WAIT_PRICE', lastErrorCode: code, lastErrorMessage: '具体缺口：301260158',
    } }] }).items
    assert.equal(item.workflow.currentStatusLabel, label)
    assert.equal(item.workflow.currentStatus, status)
    assert.equal(item.workflow.message, '具体缺口：301260158')
    assert.equal(item.workflow.actionEnabled, true)
    assert.equal(item.workflow.nextAction, 'START_COSTING')
    assert.equal(hasQuoteItemCostingGap(item), true)
  })
}
