import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, babelParse } from '@vue/compiler-sfc'
const ref = value => ({ value })
function functions(path, names) {
  const source = parse(readFileSync(new URL(path, import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const body = babelParse(source, { sourceType: 'module' }).program.body
  return names.map(name => { const node = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name); return source.slice(node.start, node.end) }).join('\n')
}
const entry = functions('../src/views/technical-data/tasks/index.vue', ['isUnassigned', 'startAdmin'])
function startHarness(allowed = true) {
  const calls = []
  const deps = { canAdminDirect: ref(allowed), adminStarting: ref(false),
    startAdminTechnicalDataEntry: async (...args) => { calls.push(['start', ...args]); return { id: 25 } },
    load: async () => calls.push(['load']), openPanel: async id => calls.push(['open', id]),
    showErrorOnce: error => calls.push(['error', error.message]) }
  return { calls, start: new Function(...Object.keys(deps), `${entry}; return startAdmin`)(...Object.values(deps)) }
}
const product = { taskId: null, taskStatus: 'UNASSIGNED', product: { oaFormItemId: 10 }, accountingMonth: '2026-10' }
test('admin directly starts an unassigned product, with no switch or OA dispatch', async () => {
  const h = startHarness(); await h.start(product)
  assert.deepEqual(h.calls, [['start', 10, '2026-10'], ['load'], ['open', 25]])
})
test('finance and assigned products cannot enter the admin path', async () => {
  const finance = startHarness(false); await finance.start(product); assert.deepEqual(finance.calls, [])
  const admin = startHarness(); await admin.start({ ...product, taskId: 11, taskStatus: 'PENDING' }); assert.deepEqual(admin.calls, [])
})
const after = functions('../src/components/technical-data/TechnicalDataProductEditor.vue', ['afterSave'])
function saveHarness(direct, result) {
  const calls = [], validation = ref(null)
  const deps = { dirty: ref(true), load: async () => {}, emit: (...args) => calls.push(args),
    task: ref({ id: 25 }), product: ref({ rowVersion: 3 }), nextModule: ref(null), activeModule: ref('MANUFACTURING'),
    props: { adminDirect: direct }, validation, confirmationReady: ref(false),
    saveAdminTechnicalDataForQuote: async (...args) => { calls.push(['direct', ...args]); return result },
    validateTechnicalDataTask: async () => { calls.push(['validate-normal']); return result?.validation || { valid: true } },
    ElMessage: { success: text => calls.push(['success', text]) }, showErrorOnce: error => calls.push(['error', error.message]) }
  return { calls, validation, save: new Function(...Object.keys(deps), `${after}; return afterSave`)(...Object.values(deps)) }
}
test('saving the last admin module validates the draft without confirming or publishing it', async () => {
  const missing = { valid: false, issues: [{ moduleType: 'MANUFACTURING', message: '原材料未填完整' }] }
  const h = saveHarness(true, { effectiveVersionId: null, validation: missing }); await h.save({ next: true })
  assert.deepEqual(h.validation.value, missing)
  assert.ok(h.calls.some(call => call[0] === 'validate-normal'))
  assert.ok(!h.calls.some(call => ['direct', 'close'].includes(call[0])))
})

const confirm = functions('../src/components/technical-data/TechnicalDataProductEditor.vue', ['confirmSave'])
function confirmHarness(overrides = {}) {
  const calls = []
  const deps = { props: { adminDirect: true }, confirmationReady: ref(true), dirty: ref(false), busy: ref(false),
    confirming: ref(false), task: ref({ id: 25 }), product: ref({ rowVersion: 3 }), validation: ref(null),
    saveAdminTechnicalDataForQuote: async (...args) => { calls.push(['confirm', ...args]); return { effectiveVersionId: 99 } },
    ElMessage: { success: text => calls.push(['success', text]) }, emit: (...args) => calls.push(args),
    showErrorOnce: error => calls.push(['error', error.message]), ...overrides }
  return { calls, deps, confirm: new Function(...Object.keys(deps), `${confirm}; return confirmSave`)(...Object.values(deps)) }
}
test('only explicit admin confirmation publishes the current saved version', async () => {
  const h = confirmHarness(); await h.confirm()
  assert.deepEqual(h.calls[0], ['confirm', 25, 3])
  assert.ok(h.calls.some(call => call[0] === 'close'))
  assert.equal(h.deps.busy.value, false)
})
test('technicians and unsaved or incomplete admin drafts cannot confirm', async () => {
  for (const override of [{ props: { adminDirect: false } }, { dirty: ref(true) },
    { confirmationReady: ref(false) }, { busy: ref(true) }, { confirming: ref(true) }]) {
    const h = confirmHarness(override); await h.confirm(); assert.deepEqual(h.calls, [])
  }
})
test('failed confirmation keeps the editor and saved draft available', async () => {
  const h = confirmHarness({ saveAdminTechnicalDataForQuote: async () => { throw new Error('版本已变化') } })
  await h.confirm()
  assert.ok(h.calls.some(call => call[0] === 'error'))
  assert.ok(!h.calls.some(call => call[0] === 'close'))
  assert.equal(h.deps.busy.value, false)
})
test('admin waits for explicit confirmation while ordinary technician completion keeps its original path', async () => {
  const admin = saveHarness(true, { effectiveVersionId: 99, validation: { valid: true } }); await admin.save({ next: true })
  assert.ok(!admin.calls.some(call => ['direct', 'close'].includes(call[0])))
  const tech = saveHarness(false); await tech.save({ next: true })
  assert.ok(tech.calls.some(call => call[0] === 'validate-normal'))
  assert.ok(!tech.calls.some(call => call[0] === 'direct'))
})

test('viewing shared data stays in the current signed-in workbench', async () => {
  const body = functions('../src/views/technical-data/tasks/index.vue', ['open', 'openPanel'])
  const calls = []
  const deps = { submissionBusy: ref(false), moduleAction: () => '查看原资料',
    findModule: () => ({ sourceReference: 'TECH_SHARED:42::' }),
    route: { query: { oaNo: 'QUOTE-1' } }, router: { push: target => calls.push(target) } }
  const open = new Function(...Object.keys(deps), `${body}; return open`)(...Object.values(deps))
  await open({ product: {} }, 'PROFILE')
  assert.deepEqual(calls, [{ query: { oaNo: 'QUOTE-1', supplement: '42', module: 'PROFILE' } }])
})
