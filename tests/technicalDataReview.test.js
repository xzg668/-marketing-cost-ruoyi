import test from 'node:test'
import { canEditTechnicalModule } from '../src/utils/technicalDataWorkbench.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workbench = readFileSync(new URL('../src/components/technical-data/TechnicalDataProductEditor.vue', import.meta.url), 'utf8')

test('TW-04 returning Wang leaves Li approved and readonly', () => {
  const state = { editableModules: ['PACKAGE'] }
  assert.equal(canEditTechnicalModule(state, 'PACKAGE', 'RETURNED'), true)
  assert.equal(canEditTechnicalModule(state, 'PRICE', 'APPROVED'), false)
  assert.match(workbench, /canEditTechnicalModule\(workflow.value, activeModule.value/)
  assert.match(workbench, /editable: editable.value/)
})
