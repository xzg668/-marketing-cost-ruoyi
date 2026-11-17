import assert from 'node:assert/strict'
import test from 'node:test'
import { modulePresentation, unassignedModulePresentation } from '../src/utils/technicalDataWorkbench.js'
import { TECHNICAL_WORKBENCH_COLUMNS, bomEntryModule, bomModuleStates, bomGroup, manufacturingNodeRows } from '../src/utils/technicalBomWorkbench.js'

const row = () => ({ assignedModules: ['MANUFACTURING'], editableModules: ['MANUFACTURING'], taskStatus: 'PENDING', product: { modules: [
  { moduleType: 'DRAWING_BOM', required: false, sourceAvailability: 'AVAILABLE', moduleStatus: 'NOT_REQUIRED', requirementReasonCode: 'DRAWING_SOURCE_AVAILABLE', assigneeName: '王工' },
  { moduleType: 'MANUFACTURING', required: true, sourceAvailability: 'MISSING', moduleStatus: 'PENDING', assigneeName: '李工' },
] } })
test('one BOM column preserves every unrelated module and original module scope', () => {
  assert.deepEqual(TECHNICAL_WORKBENCH_COLUMNS.map(x => x.code), ['PROFILE', 'BOM', 'PACKAGE', 'AUXILIARY', 'SOLDER', 'SALARY', 'NET_LOSS', 'PRICE'])
  assert.deepEqual(bomGroup(['DRAWING_BOM', 'MANUFACTURING', 'PRICE']), ['BOM', 'PRICE'])
})
test('a manufacturing-only assignee enters their module without gaining drawing permission', () => {
  const product = row()
  assert.equal(bomEntryModule(product), 'MANUFACTURING')
  const states = bomModuleStates(product)
  assert.equal(states[0].module.assigneeName, '王工')
  assert.equal(states[1].module.assigneeName, '李工')
  assert.deepEqual(product.editableModules, ['MANUFACTURING'])
  assert.equal(bomEntryModule({ ...product, assignedModules: [], editableModules: [] }), null)
  assert.equal(bomEntryModule({ ...product, assignedModules: [], editableModules: [] }, true), 'MANUFACTURING')
})
test('node filter separates identical materials under distinct source nodes and retains input collection', () => {
  const rows = [{ sourceNodeId: 10, parentMaterialNo: '001' }, { sourceNodeId: 11, parentMaterialNo: '001' }]
  assert.deepEqual(manufacturingNodeRows(rows, '11'), [rows[1]])
  assert.equal(manufacturingNodeRows(rows, null), rows)
  assert.equal(rows.length, 2)
})

test('complete BOM has one detail status and no gallery manufacturing label', () => {
  const value = row()
  value.product.modules[1] = { ...value.product.modules[1], required: false, moduleStatus: 'NOT_REQUIRED', sourceAvailability: 'AVAILABLE', requirementReasonCode: 'TECH_BOM_MATERIALS_AVAILABLE' }
  assert.deepEqual(bomModuleStates(value).map(state => state.code), ['DRAWING_BOM'])
  for (const moduleType of ['AUXILIARY', 'SOLDER']) {
    value.product.modules.push({ moduleType, required: true, moduleStatus: 'READY', sourceAvailability: 'MISSING', requirementReasonCode: 'TECH_BOM_COVERED', assigneeUserId: 12 })
    assert.equal(modulePresentation(value.product, moduleType).label, '已有（来自BOM）')
    assert.equal(unassignedModulePresentation(value.product, moduleType).label, '已有（来自BOM）')
  }
})
