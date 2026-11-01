import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as packaging from '../src/utils/technicalDataPackage.js'

const source = fs.readFileSync(new URL('../src/components/technical-data/TechnicalDataPackageForm.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'package-form-test' }).content
  .replace(/^import .+ from .+$/gm, '').replace('export default', 'return')
const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})

function reference(parentNodeId = 511903, base = 150) {
  return {
    evidence: { parentNodeId, parentBaseQuantity: base, topProductCode: '1145900000060',
      parentMaterialNo: '9830000025710', parentName: '包装组件', fingerprint: `source-${parentNodeId}` },
    children: [{ sourceNodeId: parentNodeId + 1, materialNo: '250011406', name: '瓦楞纸箱',
      model: 'BZ-YCQ-04-001', quantity: 1, unit: '只' }],
  }
}
function component(sources = [reference()]) {
  return { key: 'packaging-structure', materialNo: '9830000025710', name: '包装组件', sources }
}

async function mount(components) {
  const sent = [], messages = []
  const workspace = { editable: true, expectedVersion: 1, packaging: null, items: [], issues: [] }
  const dependencies = {
    ...Vue, ...packaging,
    ElMessage: { warning: text => messages.push(text), success: text => messages.push(text) },
    showErrorOnce: error => messages.push(error.message),
    fetchTechnicalDataPackage: async () => workspace,
    fetchTechnicalDataPackageReferences: async () => ({ components }),
    fetchTechnicalDataPackageChildren: async () => [],
    saveTechnicalDataPackage: async (id, payload) => {
      sent.push({ id, payload })
      if (payload.entryMode === 'REFERENCE' && (!payload.referenceParentNodeId || !payload.referenceFingerprint)) {
        throw new Error('请选择明确的包装来源')
      }
      return { ...workspace, expectedVersion: 2, packaging: {
        entryMode: payload.entryMode, parentBaseQuantity: payload.parentBaseQuantity,
        source: components.flatMap(c => c.sources).find(s => s.evidence.parentNodeId === payload.referenceParentNodeId)?.evidence,
      }, items: [] }
    },
  }
  const form = new Function(...Object.keys(dependencies), script)(...Object.values(dependencies))
  form.render = () => null
  const app = renderer.createApp(form, { productId: 6, editable: true })
  const instance = app.mount({}).$
  await Promise.resolve(); await Vue.nextTick()
  instance.setupState.mode = 'REFERENCE'
  instance.setupState.keyword = '9830000025710'
  return { app, state: instance.setupState, sent, messages }
}

test('查询到唯一包装来源后自动带出母件底数与子件，并以完整来源保存', async () => {
  const screen = await mount([component()])
  try {
    await screen.state.searchReferences()
    assert.equal(screen.state.form.parentBaseQuantity, '150')
    assert.equal(screen.state.form.source.parentNodeId, 511903)
    assert.equal(screen.state.form.items.length, 1)
    await screen.state.save(false)
    assert.equal(screen.sent[0].payload.referenceParentNodeId, 511903)
    assert.equal(screen.sent[0].payload.referenceFingerprint, 'source-511903')
    assert.equal(screen.sent[0].payload.items[0].sourceNodeId, 511904)
    assert.ok(!screen.messages.includes('请选择明确的包装来源'))
  } finally { screen.app.unmount() }
})

test('多个来源明确等待选择，未选择时阻止空来源请求，选定后带出对应底数', async () => {
  const options = [reference(), reference(600000, 200)]
  const screen = await mount([component(options)])
  try {
    await screen.state.searchReferences()
    screen.state.form.parentBaseQuantity = '150'
    await screen.state.save(false)
    assert.equal(screen.sent.length, 0)
    assert.ok(screen.messages.some(message => message.includes('来源')))
    assert.equal(screen.state.selectedComponent.sources.length, 2)
    screen.state.selectSourceById(600000)
    assert.equal(screen.state.form.parentBaseQuantity, '200')
    assert.equal(screen.state.form.items[0].sourceNodeId, 600001)
    await screen.state.save(false)
    assert.equal(screen.sent[0].payload.referenceParentNodeId, 600000)
  } finally { screen.app.unmount() }
})

test('同一包装多个来源底数一致时直接带出底数，并保留原来源选择', async () => {
  const screen = await mount([component([reference(), reference(600000, '150.00000000')])])
  try {
    await screen.state.searchReferences()
    assert.equal(screen.state.form.parentBaseQuantity, '150')
    assert.equal(screen.state.form.source, null)
    assert.equal(screen.state.selectedComponent.sources.length, 2)
    screen.state.selectSourceById(600000)
    assert.equal(Number(screen.state.form.parentBaseQuantity), 150)
    await screen.state.save(false)
    assert.equal(screen.sent[0].payload.referenceParentNodeId, 600000)
    assert.equal(screen.sent[0].payload.items[0].sourceParentNodeId, 600000)
  } finally { screen.app.unmount() }
})

test('多个组件不默认取第一项，选定来源后可修改本次底数且不改来源值', async () => {
  const first = component()
  const second = { ...component([reference(600000, 200)]), key: 'another-package', materialNo: 'OTHER' }
  const screen = await mount([first, second])
  try {
    await screen.state.searchReferences()
    assert.equal(screen.state.selectedComponent, null)
    assert.equal(screen.state.form.source, null)
    await screen.state.save(false)
    assert.equal(screen.sent.length, 0)
    screen.state.selectComponent(second)
    assert.equal(screen.state.form.parentBaseQuantity, '200')
    screen.state.form.parentBaseQuantity = '250'
    await screen.state.save(false)
    assert.equal(screen.sent[0].payload.parentBaseQuantity, '250')
    assert.equal(screen.sent[0].payload.referenceParentNodeId, 600000)
    assert.equal(second.sources[0].evidence.parentBaseQuantity, 200)
  } finally { screen.app.unmount() }
})

test('来源缺少底数时保留空值，仍允许技术员核实填写；手工方式不要求参考来源', async () => {
  const screen = await mount([component([reference(511903, null)])])
  try {
    await screen.state.searchReferences()
    assert.equal(screen.state.form.parentBaseQuantity, '')
    assert.equal(screen.state.form.source.parentNodeId, 511903)
    screen.state.form.parentBaseQuantity = '150'
    await screen.state.save(false)
    assert.equal(screen.sent[0].payload.parentBaseQuantity, '150')
    screen.state.mode = 'MANUAL'
    screen.state.form.parentBaseQuantity = '6'
    screen.state.form.items.push(packaging.packageRow({ componentModel: 'BOX', componentName: '纸箱', quantity: 1, unit: '只' }))
    await screen.state.save(false)
    assert.equal(screen.sent[1].payload.entryMode, 'MANUAL')
    assert.equal(screen.sent[1].payload.referenceParentNodeId, null)
  } finally { screen.app.unmount() }
})
