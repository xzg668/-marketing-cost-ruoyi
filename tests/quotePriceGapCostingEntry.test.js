import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasQuoteItemCostingGap, withQuoteItemWorkflow } from '../src/utils/quoteItemWorkflow.js'

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
