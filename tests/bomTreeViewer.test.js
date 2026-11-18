import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as Vue from 'vue'

const { descriptor } = parse(readFileSync(new URL('../src/pages/BomTreeViewerPage.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'bom-tree-test' }).content
  .replace(/^import .+ from .+$/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
function mount(read, routeQuery = {}) {
  const calls = [], errors = [], route = Vue.reactive({ query: routeQuery })
  const deps = { ...Vue, BomNodeDetailDrawer: {}, useRoute: () => route, useUserStore: () => ({ businessUnitType: 'COMMERCIAL' }),
    ElMessage: { error: message => errors.push(message), warning: message => errors.push(message) },
    getBomHierarchy: async (...args) => { calls.push(args); return read(...args) } }
  const component = new Function(...Object.keys(deps), script)(...Object.values(deps))
  component.render = () => null
  const app = renderer.createApp(component)
  return { app, state: app.mount({}).$.setupState, calls, errors, route }
}
const tree = code => ({ materialCode: code, path: `/${code}/`, children: [{ materialCode: 'RAW', path: `/${code}/RAW/`, children: [] }] })
test('top and make-part input use the same query with all chosen filters', async () => {
  const h = mount(code => tree(code))
  try {
    h.state.query.topProductCode = ' TOP '
    await h.state.loadTree()
    assert.equal(h.state.tree.materialCode, 'TOP')
    h.state.query.topProductCode = ' MAKE '
    h.state.query.priceOrgCode = '220'; h.state.query.asOfDate = '2026-10-01'
    h.state.query.bomPurpose = '主制造'; h.state.query.sourceType = 'MANUAL'
    assert.equal(h.state.tree, null)
    await h.state.loadTree()
    assert.deepEqual(h.calls[1], ['MAKE', { bomPurpose: '主制造', priceOrgCode: '220', asOfDate: '2026-10-01', sourceType: 'MANUAL' }])
    assert.equal(h.state.tree.children[0].materialCode, 'RAW')
  } finally { h.app.unmount() }
})
test('missing BOM and failed read are distinct from the initial prompt', async () => {
  const h = mount(code => { if (code === 'BAD') throw Error('存在不同的下级 BOM'); return null })
  try {
    assert.equal(h.state.queried, false)
    h.state.query.topProductCode = 'NONE'; await h.state.loadTree()
    assert.equal(h.state.queried, true); assert.equal(h.state.tree, null); assert.equal(h.state.queryError, '')
    h.state.query.topProductCode = 'BAD'; await h.state.loadTree()
    assert.match(h.state.queryError, /不同的下级/); assert.equal(h.state.tree, null)
  } finally { h.app.unmount() }
})
test('late success and late failure cannot replace a newer material result', async () => {
  const pending = new Map(), h = mount(code => new Promise((resolve, reject) => pending.set(code, { resolve, reject })))
  try {
    h.state.query.topProductCode = 'A'; const first = h.state.loadTree()
    h.state.query.topProductCode = 'B'; const second = h.state.loadTree()
    pending.get('B').resolve(tree('B')); await second
    pending.get('A').resolve(tree('A')); await first
    assert.equal(h.state.tree.materialCode, 'B')
    h.state.query.topProductCode = 'C'; const third = h.state.loadTree()
    h.state.query.topProductCode = 'D'; const fourth = h.state.loadTree()
    pending.get('D').resolve(tree('D')); await fourth
    pending.get('C').reject(Error('old failure')); await third
    assert.equal(h.state.tree.materialCode, 'D'); assert.deepEqual(h.errors, [])
  } finally { h.app.unmount() }
})
test('editing organization during a request invalidates it before another query', async () => {
  let resolve; const h = mount(() => new Promise(done => { resolve = done }))
  try {
    h.state.query.topProductCode = 'MAKE'; const request = h.state.loadTree()
    h.state.query.priceOrgCode = '220'; resolve(tree('MAKE')); await request
    assert.equal(h.state.tree, null); assert.equal(h.state.queried, false); assert.equal(h.state.loading, false)
  } finally { h.app.unmount() }
})
test('existing route query loads a part on entry and after navigation', async () => {
  const h = mount(code => tree(code), { topProductCode: 'MAKE', priceOrgCode: '220', asOfDate: '2026-11-01' })
  try {
    await Vue.nextTick(); await Vue.nextTick()
    assert.equal(h.state.tree.materialCode, 'MAKE'); assert.equal(h.calls[0][1].priceOrgCode, '220')
    h.route.query = { topProductCode: 'TOP' }; await Vue.nextTick(); await Vue.nextTick()
    assert.equal(h.state.tree.materialCode, 'TOP')
  } finally { h.app.unmount() }
})
test('blank input never queries and expand/collapse visits every returned node', async () => {
  const h = mount(code => tree(code))
  try {
    h.state.query.topProductCode = '   '; await h.state.loadTree(); assert.equal(h.calls.length, 0)
    h.state.query.topProductCode = 'MAKE'; await h.state.loadTree()
    const nodes = new Map([['/MAKE/', {}], ['/MAKE/RAW/', {}]])
    h.state.treeRef = { getNode: path => nodes.get(path) }
    h.state.expandAll(); assert.ok([...nodes.values()].every(node => node.expanded))
    h.state.collapseAll(); assert.ok([...nodes.values()].every(node => !node.expanded))
  } finally { h.app.unmount() }
})
