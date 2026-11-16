import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
const api = readFileSync(new URL('../src/api/makePartPriceCalc.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/import\.meta\.env\.VITE_API_BASE_URL/g, "''").replace(/export /g, '')
const normalize = new Function(`${api}; return normalizeMakePartPriceGroups`)()
test('grouped page keeps exact decimal strings and uses server total, variant status and distinct quote count', () => {
  const input = { total: 35, records: [{ id: 901, row: { id: 12, parentTotalCostPrice: '0.57415929', status: 'OK' }, status: 'MISSING_WEIGHT', quoteCount: 4, detailCount: 2 }], statusSummary: { OK: 34, MISSING_WEIGHT: 1 } }
  const output = normalize(input)
  assert.equal(output.total, 35); assert.equal(output.list[0].id, 901); assert.equal(output.list[0].parentTotalCostPrice, '0.57415929')
  assert.equal(output.list[0].status, 'MISSING_WEIGHT'); assert.equal(output.list[0].quoteCount, 4); assert.equal(input.records[0].row.status, 'OK')
  assert.deepEqual(normalize(null), { total: 0, list: [], statusSummary: {} })
})
const { descriptor } = parse(readFileSync(new URL('../src/components/MakePartPriceGroupDetails.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'make-price-groups' }).content.replace(/import\s*\{([^}]+)\}\s*from 'vue'/, 'const {$1} = Vue').replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
const settle = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
test('association pagination ignores late responses and reports failure without displaying stale quote links', async () => {
  const pending = []
  const bindings = { Vue, BasePagination: {}, grossWeightWithSource() {}, manufacturingGrossWeightSource() {}, fetchMakePartPriceGroupDetails: (id, query) => new Promise((resolve, reject) => pending.push({ id, query, resolve, reject })) }
  const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings)); component.render = () => null
  const app = renderer.createApp(component, { groupId: 91, initialTab: 'quotes' }); const s = app.mount({}).$.setupState
  try {
    assert.equal(s.tab, 'quotes'); assert.equal(pending.length, 1)
    s.page = 2; await settle(); assert.equal(pending[1].query.page, 2)
    pending[1].resolve({ quoteTotal: 30, quotations: [{ oaNo: 'SECOND' }] }); await settle()
    pending[0].resolve({ quoteTotal: 30, quotations: [{ oaNo: 'FIRST' }] }); await settle()
    assert.equal(s.data.quotations[0].oaNo, 'SECOND'); assert.equal(s.loading, false)
    s.page = 3; await settle(); pending[2].reject(new Error('读取失败')); await settle()
    assert.equal(s.data, null); assert.equal(s.error, '读取失败')
    const retry = s.load(); pending[3].resolve({ quoteTotal: 30, quotations: [] }); await retry
    assert.equal(s.error, ''); assert.equal(s.loading, false)
  } finally { app.unmount() }
})
