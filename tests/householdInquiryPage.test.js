import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createInquiryList } from '../src/pages/householdInquiryList.js'
import * as inquiryUtils from '../src/pages/householdInquiryUtils.js'

const renderer = Vue.createRenderer({
  createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null,
})
function component(file, bindings) {
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'household-month-test' }).content
    .replace(/import\s*\{([^}]+)\}\s*from ['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')
    .replace('export default', 'return')
  const values = { Vue, ...inquiryUtils, ...bindings }
  const result = new Function(...Object.keys(values), script)(...Object.values(values))
  result.render = () => null
  return result
}
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
function pageFixture(query) {
  const path = '/price/household-inquiry', requests = []
  const resolve = target => ({ fullPath: `${path}?${new URLSearchParams(Object.entries(target.query).filter(([, value]) => value !== undefined))}` })
  const route = Vue.reactive({ path, query, ...resolve({ query }) })
  const router = { resolve, replace: target => Object.assign(route, target, resolve(target)) }
  const user = Vue.reactive({ userId: 1, username: 'finance', businessUnitType: 'COMMERCIAL', permissions: ['*:*:*'] })
  const app = renderer.createApp(component('../src/pages/HouseholdInquiryPage.vue', {
    useRoute: () => route, useRouter: () => router, useUserStore: () => user, createInquiryList,
    fetchHouseholdInquiries: async query => { requests.push({ ...query }); return { rows: [], total: 0 } },
    fetchHouseholdImport() {}, downloadHouseholdImportOriginal() {},
    HouseholdInquiryImportDialog: {}, HouseholdInquiryDetail: {},
  }))
  const state = app.mount({}).$.setupState
  return { app, state, route, requests }
}

test('月份查询经过分页、刷新和返回重进后保持，切换月份重置到第一页', async () => {
  const f = pageFixture({ sourceMonth: '2026-10', materialCode: '001Ab', page: '3', size: '50' })
  try {
    await settle()
    assert.deepEqual(f.requests.at(-1), { sourceMonth: '2026-10', materialCode: '001Ab', page: 3, size: 50 })
    f.state.sourceMonth = '2026-11'; f.state.search(); await settle()
    assert.equal(f.route.query.sourceMonth, '2026-11'); assert.equal(f.state.page, 1)
    f.state.page = 2; f.state.paginate(); await settle()
    assert.equal(f.requests.at(-1).sourceMonth, '2026-11'); assert.equal(f.requests.at(-1).page, 2)
    await f.state.refresh()
    assert.equal(f.requests.at(-1).sourceMonth, '2026-11')
    const reentered = pageFixture({ ...f.route.query })
    try { await settle(); assert.equal(reentered.requests.at(-1).sourceMonth, '2026-11'); assert.equal(reentered.state.page, 2) }
    finally { reentered.app.unmount() }
    f.state.sourceMonth = ''; f.state.search(); await settle()
    assert.equal(f.requests.at(-1).sourceMonth, undefined)
  } finally { f.app.unmount() }
})

test('导入十月后切换到十月并清除原料号和分页条件，让导入结果可见', async () => {
  const f = pageFixture({ sourceMonth: '2026-11', materialCode: 'missing', page: '5' })
  try {
    await settle(); f.state.imported({ batchId: 17, sourceMonth: '2026-10' }); await settle()
    assert.deepEqual(f.requests.at(-1), { sourceMonth: '2026-10', materialCode: '', page: 1, size: 20 })
    assert.equal(f.route.query.batchId, '17'); assert.equal(f.route.query.sourceMonth, '2026-10')
  } finally { f.app.unmount() }
})

test('导入沿用列表所选月份，完成事件使用实际发布预览的来源月份', async () => {
  const events = [], session = {
    state: Vue.reactive({ preview: null, phase: 'EMPTY', busy: false, error: '' }),
    resume: async () => false, dispose() {}, canPublish: () => true, expired: () => false,
    publish: async () => ({ batchId: 19 }),
  }
  const app = renderer.createApp(component('../src/components/household-inquiry/HouseholdInquiryImportDialog.vue', {
    ElMessage: {}, householdImportApi: {}, downloadHouseholdImportOriginal() {}, sessionStorage: {},
    createInquiryImportSession: () => session,
  }), { modelValue: true, scope: 'finance/COMMERCIAL', sourceMonth: '2026-10', onImported: result => events.push(result) })
  try {
    const state = app.mount({}).$.setupState; await settle()
    assert.equal(state.form.sourceMonth, '2026-10')
    session.state.preview = { content: { sourceMonth: '2026-09' } }
    await state.publish()
    assert.deepEqual(events, [{ batchId: 19, sourceMonth: '2026-09' }])
  } finally { app.unmount() }
})
