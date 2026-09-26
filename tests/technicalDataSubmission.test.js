import test from 'node:test'
import { canEditTechnicalModule } from '../src/utils/technicalDataWorkbench.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const api = readFileSync(new URL('../src/api/technicalDataTasks.js', import.meta.url), 'utf8')
const workbench = readFileSync(new URL('../src/components/technical-data/TechnicalDataProductEditor.vue', import.meta.url), 'utf8')
const submission = readFileSync(new URL('../src/components/technical-data/TechnicalDataDocumentSubmit.vue', import.meta.url), 'utf8')
const auxiliaryPage = readFileSync(new URL('../src/components/technical-data/TechnicalDataAuxiliaryForm.vue', import.meta.url), 'utf8')
const salaryPage = readFileSync(new URL('../src/components/technical-data/TechnicalDataSalaryForm.vue', import.meta.url), 'utf8')

test('document submission keeps personal validation and sends one group request', () => {
  assert.match(api, /\/tasks\/\$\{id\(taskId\)\}\/validate/)
  assert.match(api, /\/forms\/\$\{id\(formId\)\}\/submit/)
  assert.doesNotMatch(api, /submitTechnicalDataTask/)
  assert.match(submission, /idempotencyKey/)
  assert.match(submission, /确认提交/)
})

test('validation problems open the actual module form', () => {
  assert.match(workbench, /prop="lineNo"/)
  assert.match(workbench, /selectModule\(row.moduleType\)/)
})

test('T9 keeps one idempotency key across retries and submits the current task version', () => {
  assert.match(submission, /technical-document-submit:/)
  assert.match(submission, /sessionStorage\.getItem\(keyName.value\)/)
  assert.match(submission, /crypto\.randomUUID/)
  assert.match(submission, /submitTechnicalDataDocument\(props.document.formId, pendingRequest.value\)/)
  assert.match(submission, /if \(!pendingRequest.value\) pendingRequest.value/)
})

test('TW-04 frozen personal modules stay readonly while other participants continue', () => {
  assert.equal(canEditTechnicalModule({ editableModules: ['PACKAGE'] }, 'PACKAGE', 'READY'), true)
  assert.equal(canEditTechnicalModule({ editableModules: ['PACKAGE'] }, 'PRICE', 'READY'), false)
  assert.equal(canEditTechnicalModule({ editableModules: ['PACKAGE'] }, 'PACKAGE', 'FROZEN'), false)
  assert.equal(canEditTechnicalModule({ editableModules: ['PACKAGE'] }, 'PACKAGE', 'SUBMITTED'), false)
  assert.equal(canEditTechnicalModule({ editableModules: ['PACKAGE'] }, 'PACKAGE', 'RETURNED'), true)
  assert.equal(canEditTechnicalModule(null, 'PACKAGE', 'READY'), false)
  assert.match(workbench, /editable: editable.value/)
  assert.match(auxiliaryPage, /props\.editable && workspace\.value\?\.editable/)
  assert.match(auxiliaryPage, /:disabled="!canEdit \|\| busy"/)
  assert.match(salaryPage, /props\.editable && workspace\.value\?\.editable/)
  assert.match(salaryPage, /v-if="canEdit"/)
  assert.match(salaryPage, /if \(!canEdit\.value \|\| busy\.value\) return/)

})

test('T9 submission remains inside new technical-data boundary', () => {
  assert.doesNotMatch(api, /\/api\/v1\/collaboration/)
  assert.doesNotMatch(workbench, /<el-upload|type="file"/)
})
