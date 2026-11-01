import test from 'node:test'
import assert from 'node:assert/strict'
import { withQuoteItemWorkflow, hasQuoteItemCostingGap } from '../src/utils/quoteItemWorkflow.js'
import { currentPriceGaps, currentPriceGapCount, currentSupplementWorkspace, productSupplement } from '../src/utils/technicalDataGaps.js'
import { modulePresentation } from '../src/utils/technicalDataWorkbench.js'

const modules = ['PROFILE', 'PACKAGE', 'AUXILIARY', 'SOLDER', 'SALARY', 'NET_LOSS', 'PRICE']
const saved = { workspaceStatus: 'WAIT_TECH_DATA', periodMonth: '2026-10', gapCount: 7, lastErrorMessage: '旧补录缺口' }
const submitted = { oaFormItemId: 1, accountingMonth: '2026-10', status: 'SUBMITTED', requiredModules: modules,
  pendingModules: [], remainingPriceGapCount: 0, resolvedPriceGapKeys: ['A|MISSING_PRICE|MISSING'] }
const detail = { items: [{ id: 1, costingWorkspace: saved }, { id: 2, costingWorkspace: saved }] }

test('提交即消除七项补录缺口，整产品退回后恢复，再提交后消除；不影响其他产品或历史', () => {
  const original = structuredClone(detail)
  for (const status of [submitted, { ...submitted, status: 'RETURNED', pendingModules: modules, resolvedPriceGapKeys: [] }, submitted]) {
    const rows = withQuoteItemWorkflow(detail, {}, { supplements: [status] }).items
    const returned = status.status === 'RETURNED'
    assert.equal(hasQuoteItemCostingGap(rows[0]), returned)
    assert.equal(rows[0].costingWorkspace.gapCount, returned ? 7 : 0)
    assert.equal(rows[0].workflow.nextAction, returned ? 'VIEW_COSTING_GAP' : 'START_COSTING')
    assert.equal(hasQuoteItemCostingGap(rows[1]), true)
    assert.equal(rows[1].costingWorkspace.lastErrorMessage, '旧补录缺口')
  }
  assert.deepEqual(detail, original)
})

test('已提交只消除对应缺价，未解决的财务价格、冲突和供应商问题继续显示', () => {
  const gaps = [
    { gapMaterialCode: 'A', gapType: 'MISSING_PRICE', reasonCode: 'MISSING' },
    { gapMaterialCode: 'B', gapType: 'MISSING_PRICE', reasonCode: 'MISSING' },
    { gapMaterialCode: 'A', gapType: 'MISSING_PRICE', reasonCode: 'INVALID_INPUT' },
    { gapMaterialCode: 'A', gapType: 'SUPPLIER_RATIO', reasonCode: '' },
  ]
  assert.deepEqual(currentPriceGaps(gaps, submitted), gaps.slice(1))
  assert.equal(currentPriceGapCount(6, gaps, submitted), 5)
  assert.equal(currentPriceGapCount(6, [], submitted), 6)
  assert.equal(currentPriceGapCount(undefined, gaps, submitted), 3)
  assert.deepEqual(currentPriceGaps(gaps, { ...submitted, resolvedPriceGapKeys: [] }), gaps)
  const view = currentSupplementWorkspace({ ...saved, workspaceStatus: 'WAIT_PRICE' }, { ...submitted, remainingPriceGapCount: 3 })
  assert.equal(view.workspaceStatus, 'WAIT_PRICE')
  assert.equal(view.gapCount, 3)
  assert.match(view.lastErrorMessage, /仍有 3 项/)
})

test('月份隔离，运行中任务不覆盖；补录已提交不等于已有成功成本', () => {
  assert.equal(productSupplement({ supplements: [submitted] }, 1, '2026-11'), null)
  assert.equal(currentSupplementWorkspace({ workspaceStatus: 'RUNNING' }, submitted).workspaceStatus, 'RUNNING')
  const row = withQuoteItemWorkflow({ items: [detail.items[0]] }, {}, { supplements: [submitted] }).items[0]
  assert.equal(row.workflow.currentStatusLabel, '补录已提交')
  assert.equal(row.workflow.priceStatusLabel, '待核算')
})

test('整产品退回时七个模块都待重新提交，保存草稿不清除退回缺口；无需补录项不受影响', () => {
  const product = { productStatus: 'EDITING', modules: [...modules.map(moduleType => ({ moduleType, required: true, moduleStatus: 'READY' })),
    { moduleType: 'DRAWING_BOM', required: false, moduleStatus: 'NOT_REQUIRED', sourceAvailability: 'AVAILABLE' }] }
  for (const type of modules) assert.match(modulePresentation(product, type, 'PARTIALLY_RETURNED').label, /已退回/)
  assert.equal(modulePresentation(product, 'DRAWING_BOM', 'PARTIALLY_RETURNED').label, '已有资料')
})
