import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
const source = readFileSync(new URL('../src/components/quotation/QuoteOrderBomAlternatives.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'order-alternatives' }).content
  .replace(/import\s*\{([^}]+)\}\s*from ['"]vue['"]/g, (_, names) => `const {${names.replace(/\bas\b/g, ':')}} = Vue`)
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '').replace('export default', 'return')
const settle = async () => { await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick() }
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const row = (selected = 'STD') => ({ key: 'relation', periodMonth: '2026-11', organization: '210', standardMaterialCode: 'STD', materialName: '芯体', materialSpec: 'STD-SPEC',
  selectedMaterialCode: selected, mixedSelection: selected === null, reviewRequired: false,
  candidates: [{ materialCode: 'STD', childType: 'STANDARD', materialSpec: 'STD-SPEC' }, { materialCode: 'ALT', childType: 'ALTERNATIVE', materialSpec: 'ALT-SPEC' }],
  occurrences: [{ itemId: 1, productCode: '1145900000437', productName: '阀', group: { alternativeGroupKey: 'g1', selectedMaterialCode: selected } },
    { itemId: 2, productCode: 'SECOND', group: { alternativeGroupKey: 'g2', selectedMaterialCode: selected } }] })
function fixture(options = {}) {
  const events = [], requests = [], user = Vue.reactive({ userId: 1, businessUnitType: 'COMMERCIAL', roles: ['bu_staff'], permissions: [], ...options.user })
  const props = Vue.reactive({ oaNo: '0580', active: true, readonly: false, busy: false, ...options.props })
  let stored = options.row || row()
  const view = () => ({ fingerprint: `fp-${stored.selectedMaterialCode}`, enabled: true, rows: [stored], problems: [], ...options.view })
  const bindings = { Vue, useUserStore: () => user, ElMessage: { success: message => events.push(['message', message]) },
    fetchQuoteOrderBomAlternatives: async oa => { requests.push(['get', oa]); return options.fetch ? options.fetch(oa) : view() },
    prepareQuoteOrderBomAlternatives: async oa => { requests.push(['prepare', oa]); return view() },
    saveQuoteOrderBomAlternatives: async (oa, body) => {
      requests.push(['save', oa, body]); if (options.save) return options.save(oa, body)
      stored = row(body.selections[0].selectedMaterialCode)
      return { changedMaterials: 1, changedOccurrences: 2, affectedItemIds: [1, 2] }
    },
  }
  const page = new Function(...Object.keys(bindings), script)(...Object.values(bindings)); page.render = () => null
  let instance
  const host = { setup: () => () => Vue.h(page, { ...props, ref: ref => { instance = ref }, onSaved: data => events.push(['saved', data]), onCost: () => events.push(['cost']) }) }
  const app = renderer.createApp(host); app.mount({})
  return { app, get state() { return instance.$.setupState }, events, requests, user, props, view }
}
test('one order action switches all consumers to alternative and back to standard', async () => {
  const f = fixture()
  try {
    await settle(); assert.equal(f.state.canEdit, true)
    f.state.choose(f.state.view.rows[0], 'ALT'); assert.equal(f.state.affectedProducts, 2)
    await f.state.save(true); await settle()
    assert.deepEqual(f.requests.find(r => r[0] === 'save'), ['save', '0580', { expectedFingerprint: 'fp-STD', selections: [{ key: 'relation', selectedMaterialCode: 'ALT' }] }])
    assert.equal(f.events.filter(e => e[0] === 'cost').length, 1)
    assert.equal(f.state.currentSelection(f.state.view.rows[0]), 'ALT')
    f.state.choose(f.state.view.rows[0], 'STD'); await f.state.save(false); await settle()
    assert.equal(f.requests.filter(r => r[0] === 'save').at(-1)[2].selections[0].selectedMaterialCode, 'STD')
    assert.equal(f.state.currentSelection(f.state.view.rows[0]), 'STD')
    assert.equal(f.events.filter(e => e[0] === 'cost').length, 1)
  } finally { f.app.unmount() }
})
test('opening only reads; missing BOMs block saving until explicit preparation', async () => {
  const f = fixture({ view: { problems: [{ itemId: 3, productCode: 'MISSING', preparable: true, message: 'BOM未准备' }] } })
  try {
    await settle(); assert.deepEqual(f.requests, [['get', '0580']])
    f.state.choose(f.state.view.rows[0], 'ALT'); await f.state.save(true); assert.equal(f.requests.length, 1)
    await f.state.load(true, true); assert.equal(f.requests.at(-1)[0], 'prepare')
  } finally { f.app.unmount() }
})
test('mixed choices accept standard or alternative; search includes product and candidate specifications', async () => {
  const f = fixture({ row: row(null) })
  try {
    await settle(); assert.equal(f.state.changes.length, 0)
    f.state.choose(f.state.view.rows[0], 'FAKE'); assert.equal(f.state.changes.length, 0)
    f.state.choose(f.state.view.rows[0], 'STD'); assert.equal(f.state.changes[0].selectedMaterialCode, 'STD')
    f.state.choose(f.state.view.rows[0], 'ALT'); assert.equal(f.state.changes[0].selectedMaterialCode, 'ALT')
    f.state.search = '1145900000437'; assert.equal(f.state.filteredRows.length, 1)
    f.state.search = 'alt-spec'; assert.equal(f.state.filteredRows.length, 1)
  } finally { f.app.unmount() }
})
test('officially absent BOM is shown separately and does not block existing relationships', async () => {
  const f = fixture({ view: { problems: [{ itemId: 3, productCode: 'NO-BOM', preparable: false, blocking: false }] } })
  try {
    await settle(); assert.equal(f.state.unavailableProducts.length, 1); assert.equal(f.state.blockingProblems.length, 0)
    f.state.choose(f.state.view.rows[0], 'ALT'); assert.equal(f.state.saveBlocked, false)
    await f.state.save(false); assert.equal(f.requests.filter(r => r[0] === 'save').length, 1)
  } finally { f.app.unmount() }
})
test('read-only, disabled feature, busy, and unrelated-role pages cannot save or prepare', async () => {
  for (const options of [{ props: { readonly: true } }, { props: { busy: true } }, { user: { roles: ['viewer'], permissions: ['ingest:quote:list'] } }, { view: { enabled: false } }]) {
    const f = fixture(options)
    try { await settle(); f.state.choose(f.state.view.rows[0], 'ALT'); await f.state.save(true); await f.state.load(false, true); assert.deepEqual(f.requests, [['get', '0580']]) }
    finally { f.app.unmount() }
  }
})
test('failed save keeps drafts, blocks retry and never starts costing', async () => {
  const f = fixture({ save: async () => { throw Error('选择已变化') } })
  try {
    await settle(); f.state.choose(f.state.view.rows[0], 'ALT'); await f.state.save(true)
    assert.match(f.state.error, /已变化/); assert.equal(f.state.currentSelection(f.state.view.rows[0]), 'ALT'); assert.equal(f.state.refreshRequired, true)
    await f.state.save(true); assert.equal(f.requests.filter(r => r[0] === 'save').length, 1)
    assert.equal(f.events.filter(e => e[0] === 'cost').length, 0)
    await f.state.load(true); assert.equal(f.state.changes.length, 0); assert.equal(f.state.refreshRequired, false)
  } finally { f.app.unmount() }
})
test('late save from another order or hidden tab cannot trigger costing', async () => {
  for (const change of [f => { f.props.oaNo = 'OTHER' }, f => { f.props.active = false }, f => { f.user.businessUnitType = 'HOUSEHOLD' }]) {
    const pending = deferred(), f = fixture({ save: () => pending.promise })
    try {
      await settle(); f.state.choose(f.state.view.rows[0], 'ALT'); const saving = f.state.save(true)
      await f.state.save(true); assert.equal(f.requests.filter(r => r[0] === 'save').length, 1)
      change(f); await settle(); pending.resolve({ changedMaterials: 1, affectedItemIds: [1, 2] }); await saving
      assert.equal(f.events.filter(e => ['saved', 'cost'].includes(e[0])).length, 0)
    } finally { f.app.unmount() }
  }
})
