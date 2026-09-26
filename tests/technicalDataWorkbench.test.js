import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { modulePresentation, nextTechnicalModule, validateTechnicalDataProfile, technicalEntryProgress, technicalModuleSummary } from '../src/utils/technicalDataWorkbench.js'

test('source check errors display the business reason and retain a fallback for missing explanations', () => {
  const row = { moduleType: 'PROFILE', sourceAvailability: 'ERROR', requirementReason: '产品 1053900000078 的料品档案名称不一致，请核实后重查' }
  assert.equal(technicalModuleSummary({ modules: [row] }, 'PROFILE'), row.requirementReason)
  assert.equal(technicalModuleSummary({ modules: [{ ...row, requirementReason: '' }] }, 'PROFILE'), '查询失败，请核实后重查')
})
import { workbenchRowKey, canDispatchWorkbenchRow, firstRequiredTechnicalModule, workbenchDispatchRow } from '../src/utils/technicalDataWorkbench.js'

const taskList = readFileSync(new URL('../src/views/technical-data/tasks/index.vue', import.meta.url), 'utf8')

test('costing gaps can be dispatched before a task exists without confusing quote and task identities', () => {
  const row = { taskId: null, taskStatus: 'UNASSIGNED', oaNo: 'QUOTE-1', accountingMonth: '2026-09',
    product: { oaFormItemId: 123, materialNo: 'M-1', modules: [{ required: true }] }, sourceCheck: { sharedModules: [] } }
  assert.equal(canDispatchWorkbenchRow(row), true)
  assert.equal(workbenchRowKey(row), 'quote:123:2026-09')
  assert.equal(workbenchDispatchRow(row).id, 123)
  assert.equal(workbenchDispatchRow(row).costingWorkspace.periodMonth, '2026-09')
  assert.equal(workbenchDispatchRow(row).oaNo, 'QUOTE-1')
  assert.equal(canDispatchWorkbenchRow({ ...row, taskId: 123 }), true)
  assert.equal(canDispatchWorkbenchRow({ ...row, taskId: 123, taskStatus: 'PENDING' }), false)
  assert.equal(canDispatchWorkbenchRow({ ...row, sourceCheck: { sharedModules: [{ status: 'IN_PROGRESS' }] } }), false)
  assert.equal(canDispatchWorkbenchRow({ ...row, product: { modules: [{ required: false }] } }), false)
  assert.equal(canDispatchWorkbenchRow(null), false)
  assert.notEqual(workbenchRowKey(row), workbenchRowKey({ ...row, taskId: 123 }))
})

test('unassigned products identify missing modules without creating a task on entry', () => {
  const data = { modules: [
    { moduleType: 'PROFILE', required: false },
    { moduleType: 'PACKAGE', required: true },
    { moduleType: 'PRICE', required: true },
  ] }
  assert.equal(firstRequiredTechnicalModule(data), 'PACKAGE')
  assert.equal(firstRequiredTechnicalModule({ modules: [] }), null)
  assert.doesNotMatch(taskList, /prepareTechnicalDataTask/)
  assert.doesNotMatch(taskList, /const check = await checkTechnicalDataSources[\s\S]*prepareTechnicalDataTask/)
})

const product = (states) => ({ modules: Object.entries(states).map(([moduleType, moduleStatus]) => ({ moduleType, moduleStatus, required: true, sourceAvailability: 'MISSING' })) })

test('start opens the first actual unfinished module assigned to the current person', () => {
  const data = product({ PROFILE: 'READY', DRAWING_BOM: 'PENDING', AUXILIARY: 'PENDING', SALARY: 'PENDING' })
  assert.equal(nextTechnicalModule(data, { editableModules: ['PROFILE', 'DRAWING_BOM', 'AUXILIARY'] }), 'DRAWING_BOM')
  assert.equal(nextTechnicalModule(data, { editableModules: ['SALARY'] }), 'SALARY')
})

test('next skips completed and other-person modules while following the business order', () => {
  const data = product({ PROFILE: 'READY', DRAWING_BOM: 'READY', PACKAGE: 'PENDING', AUXILIARY: 'EDITING', SALARY: 'PENDING' })
  const workflow = { editableModules: ['PROFILE', 'DRAWING_BOM', 'AUXILIARY', 'SALARY'] }
  assert.equal(nextTechnicalModule(data, workflow, 'DRAWING_BOM'), 'AUXILIARY')
  assert.equal(nextTechnicalModule(data, workflow, 'AUXILIARY'), 'SALARY')
  data.modules.find(module => module.moduleType === 'AUXILIARY').moduleStatus = 'READY'
  assert.equal(nextTechnicalModule(data, workflow, 'SALARY'), null)
})

test('admin continuous entry stays in the explicitly chosen person scope', () => {
  const data = product({ PROFILE: 'PENDING', PACKAGE: 'PENDING', SALARY: 'PENDING', PRICE: 'PENDING' })
  const workflow = { editableModules: ['PROFILE', 'PACKAGE', 'SALARY', 'PRICE'] }
  assert.equal(nextTechnicalModule(data, workflow, null, ['SALARY', 'PRICE']), 'SALARY')
  assert.equal(nextTechnicalModule(data, workflow, 'SALARY', ['SALARY', 'PRICE']), 'PRICE')
})

test('returned modules reopen in order; other approved submissions are not re-entered', () => {
  const data = product({ PROFILE: 'RETURNED', PACKAGE: 'RETURNED', SALARY: 'APPROVED' })
  const workflow = { editableModules: ['PROFILE', 'PACKAGE'] }
  assert.equal(nextTechnicalModule(data, workflow), 'PROFILE')
  assert.equal(nextTechnicalModule(data, workflow, 'PROFILE'), 'PACKAGE')
  assert.deepEqual(modulePresentation(data, 'PROFILE'), { label: '已退回', type: 'danger' })
  assert.deepEqual(modulePresentation(data, 'SALARY'), { label: '已通过', type: 'success' })
})

test('resolved, frozen and unavailable modules never become the next editable task', () => {
  const data = product({ PROFILE: 'FROZEN', SALARY: 'SUBMITTED', PACKAGE: 'PENDING' })
  data.modules[2].required = false
  assert.equal(nextTechnicalModule(data, { editableModules: ['PROFILE', 'SALARY', 'PACKAGE'] }), null)
  assert.equal(nextTechnicalModule({ modules: [] }, { editableModules: ['PROFILE'] }), null)
  assert.equal(nextTechnicalModule(data, null), null)
})

test('source uncertainty remains visible and an incomplete draft is never shown complete', () => {
  for (const [availability, label] of [['UNCONFIRMED', '待检查'], ['ERROR', '检查失败']]) {
    assert.equal(modulePresentation({ modules: [{ moduleType: 'PACKAGE', sourceAvailability: availability, moduleStatus: 'NOT_REQUIRED' }] }, 'PACKAGE').label, label)
  }
  assert.equal(modulePresentation(product({ PROFILE: 'EDITING' }), 'PROFILE').label, '草稿')
  assert.equal(modulePresentation(product({ PROFILE: 'READY' }), 'PROFILE').label, '已填完整')
})

test('profile source fields are optional while property and fee selection are required', () => {
  const input = { productProperty: '非标品', hasAdditionalFees: false, expectedVersion: 0 }
  assert.equal(validateTechnicalDataProfile(input), '')
  assert.notEqual(validateTechnicalDataProfile({ ...input, productProperty: '自制件' }), '')
  assert.notEqual(validateTechnicalDataProfile({ ...input, hasAdditionalFees: null }), '')
})

test('included fees must each be a positive unit amount or explicit no-fee slash', () => {
  const input = { productProperty: '非标品', hasAdditionalFees: true, unitMouldFee: '0.30', unitToolingFee: '/', unitCertificationFee: '/', expectedVersion: 0 }
  assert.equal(validateTechnicalDataProfile(input), '')
  for (const value of ['', '0', '-1', 'NaN', '1e4', '0.0000001', '1000000000000']) {
    assert.notEqual(validateTechnicalDataProfile({ ...input, unitMouldFee: value }), '', value)
  }
  assert.equal(validateTechnicalDataProfile({ ...input, hasAdditionalFees: false, unitCertificationFee: '' }), '')
})

// Presentation must not turn an inapplicable module or a failed lookup into found data.
test('module presentation distinguishes available sources from unneeded and failed sources', () => {
  const row = { moduleType: 'SALARY', required: false, moduleStatus: 'NOT_REQUIRED', sourceAvailability: 'NOT_APPLICABLE' }
  assert.equal(modulePresentation({ modules: [row] }, 'SALARY').label, '无需补录')
  assert.equal(modulePresentation({ modules: [{ ...row, sourceAvailability: 'AVAILABLE' }] }, 'SALARY').label, '已有资料')
  assert.equal(modulePresentation({ modules: [{ ...row, sourceAvailability: 'ERROR' }] }, 'SALARY').label, '检查失败')
})
test('entry progress counts only required modules belonging to this participant', () => {
  const data = product({ PROFILE: 'READY', PACKAGE: 'EDITING', SALARY: 'APPROVED', PRICE: 'PENDING' })
  assert.deepEqual(technicalEntryProgress(data, ['PROFILE', 'PACKAGE']), { total: 2, complete: 1, remaining: 1 })
  data.modules[1].required = false
  assert.deepEqual(technicalEntryProgress(data, ['PROFILE', 'PACKAGE']), { total: 1, complete: 1, remaining: 0 })
  assert.deepEqual(technicalEntryProgress(null, []), { total: 0, complete: 0, remaining: 0 })
})
test('module summary uses actual item counts and preserves source uncertainty', () => {
  const row = { moduleType: 'MANUFACTURING', required: true, itemCount: 3, sourceAvailability: 'MISSING' }
  assert.match(technicalModuleSummary({ modules: [row] }, 'MANUFACTURING'), /3 项/)
  assert.equal(technicalModuleSummary({ modules: [{ ...row, sourceAvailability: 'UNCONFIRMED', requirementReason: '待财务确认物料' }] }, 'MANUFACTURING'), '待财务确认物料')
})
