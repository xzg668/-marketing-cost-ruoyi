import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { inquiryPercent, inquiryMessage } from '../src/pages/householdInquiryUtils.js'

const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function fixture(fetch = async request => ({ adjustedPrice: request.customerCopperPerTon || '18.9343' })) {
  const file = new URL('../src/components/household-inquiry/HouseholdInquiryTrial.vue', import.meta.url)
  const { descriptor } = parse(readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: 'household-trial-test' }).content
    .replace(/import\s*\{([^}]+)\}\s*from ['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '').replace('export default', 'return')
  const requests = []
  const values = { Vue, inquiryPercent, inquiryMessage, trialHouseholdInquiry: async (id, request) => {
    requests.push({ id, ...request }); return fetch(request)
  } }
  const component = new Function(...Object.keys(values), script)(...Object.values(values))
  component.render = () => null
  const app = renderer.createApp(component, { modelValue: true, entry: { id: 7, sourceMonth: '2026-11' }, scope: 'COMMERCIAL/admin', sourceMonth: '2026-12' })
  const state = app.mount({}).$.setupState
  return { app, state, requests, props: app._instance.props }
}
test('打开试算用列表适用月份和空客户价；精确十进制文本不转浮点', async () => {
  const f = fixture()
  try {
    await settle()
    assert.deepEqual(f.requests[0], { id: 7, pricingMonth: '2026-12', customerCopperPerTon: null, customerZincPerTon: null })
    f.state.copper = '120000.123456789123456789'; f.state.zinc = '28000'
    await f.state.calculate()
    assert.equal(f.requests.at(-1).customerCopperPerTon, '120000.123456789123456789')
    assert.equal(f.requests.at(-1).customerZincPerTon, '28000')
    assert.equal(f.state.dirty, false)
  } finally { f.app.unmount() }
})
test('编辑条件立即隐藏上次结果；无效或零客户价不发试算请求', async () => {
  const f = fixture()
  try {
    await settle(); f.state.copper = '120000'; f.state.changed(); assert.equal(f.state.dirty, true)
    for (const invalid of ['0', '-1', '1e5', 'abc']) {
      f.state.copper = invalid; const before = f.requests.length
      await f.state.calculate(); assert.equal(f.requests.length, before)
      assert.match(f.state.error, /大于0/); assert.equal(f.state.result, null)
    }
  } finally { f.app.unmount() }
})
test('输入在请求中变化时旧响应不能显示为新条件试算结果', async () => {
  const deferred = pending(), f = fixture(() => deferred.promise)
  try {
    f.state.copper = '120000'; f.state.changed()
    deferred.resolve({ adjustedPrice: 'old' }); await settle()
    assert.equal(f.state.result, null); assert.equal(f.state.dirty, true)
  } finally { f.app.unmount() }
})
test('后发请求优先；关闭窗口后未完成请求不能回填', async () => {
  const first = pending(), second = pending(); let n = 0
  const f = fixture(() => (++n === 1 ? first : second).promise)
  try {
    f.state.copper = '130000'; const next = f.state.calculate()
    second.resolve({ adjustedPrice: 'new' }); await next
    first.resolve({ adjustedPrice: 'old' }); await settle()
    assert.equal(f.state.result.adjustedPrice, 'new')
    f.props.modelValue = false; await settle()
    assert.equal(f.state.result, null)
  } finally { f.app.unmount() }
})
test('月份切换重新读取基价，范围变化清空客户输入和原结果', async () => {
  const f = fixture()
  try {
    await settle(); f.state.month = '2027-01'; f.state.resetMonth(); await settle()
    assert.equal(f.requests.at(-1).pricingMonth, '2027-01')
    f.state.copper = '120000'; f.props.scope = ''; await settle()
    assert.equal(f.state.copper, ''); assert.equal(f.state.result, null)
    const before = f.requests.length; await f.state.calculate(); assert.equal(f.requests.length, before)
  } finally { f.app.unmount() }
})
