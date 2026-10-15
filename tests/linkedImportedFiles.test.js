import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('../src/components/LinkedImportedFiles.vue')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'imported-files-test' }).content
  .replace(/import\s*\{([^}]+)\}\s*from 'vue'/, 'const {$1} = Vue')
  .replace(/^import .+ from .+$/gm, '')
  .replace('export default', 'return')

const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})
const mount = request => {
  const user = Vue.reactive({ roles: [], permissions: [] })
  const component = new Function('Vue', 'useUserStore', 'fetchLinkedImportedFiles', 'BasePagination', script)(Vue, () => user, request, {})
  component.render = () => null
  const app = renderer.createApp(component, { pricingMonth: '2026-10', businessUnitType: 'COMMERCIAL' })
  const instance = app.mount({}).$
  return { app, props: instance.props, state: instance.setupState, user }
}
const settle = async () => { await Promise.resolve(); await Vue.nextTick(); await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('文件清单分页超过50条仍可读取，换月份重置页码且旧请求不能覆盖新月份', async () => {
  const calls = []
  const screen = mount(params => { const task = deferred(); calls.push({ params, ...task }); return task.promise })
  try {
    assert.deepEqual(calls[0].params, { pricingMonth: '2026-10', businessUnitType: 'COMMERCIAL', page: 1, pageSize: 20 })
    calls[0].resolve({ list: [{ id: 1 }], total: 75 }); await settle()
    assert.equal(screen.state.total, 75)
    screen.state.page = 4; await settle()
    assert.equal(calls[1].params.page, 4)
    screen.props.pricingMonth = '2026-11'; await settle()
    assert.equal(calls.at(-1).params.pricingMonth, '2026-11')
    assert.equal(calls.at(-1).params.page, 1)
    calls.at(-1).resolve({ list: [{ id: 80 }], total: 1 }); await settle()
    calls[1].resolve({ list: [{ id: 70 }], total: 75 }); await settle()
    assert.deepEqual(screen.state.rows, [{ id: 80 }])
    assert.equal(screen.state.total, 1)
  } finally { screen.app.unmount() }
})

test('失败显示原因并可重试，关闭后忽略未完成请求', async () => {
  const tasks = []
  const screen = mount(() => { const task = deferred(); tasks.push(task); return task.promise })
  tasks[0].reject(new Error('读取失败')); await settle()
  assert.equal(screen.state.error, '读取失败')
  assert.equal(screen.state.loading, false)
  const retry = screen.state.loadFiles()
  tasks[1].resolve({ list: [], total: 0 }); await retry
  assert.equal(screen.state.error, '')
  assert.equal(screen.state.total, 0)
  const late = screen.state.loadFiles()
  screen.app.unmount()
  tasks[2].resolve({ list: [{ id: 99 }], total: 1 }); await late
  assert.deepEqual(screen.state.rows, [])
})

test('普通用户明确显示本人范围，授权用户可显示完整范围', async () => {
  const screen = mount(async () => ({ list: [], total: 0 }))
  try {
    await settle()
    assert.equal(screen.state.canViewAll, false)
    screen.user.permissions = ['price:linked-item:import-history:all']
    assert.equal(screen.state.canViewAll, true)
    assert.match(source, /仅本人/)
  } finally { screen.app.unmount() }
})

test('主列表不再加载历史面板，文件清单只随导入弹窗打开', () => {
  const page = read('../src/pages/PriceLinkedResultPage.vue')
  assert.doesNotMatch(page, /showImportHistoryPanel|loadImportHistory|fetchLinkedImportBatchDetail|月度导入结果|批次导入结果/)
  const dialog = read('../src/components/OriginalLinkedImportDialog.vue')
  assert.match(dialog, /<LinkedImportedFiles v-if="modelValue"/)
  assert.match(page, /lastImportResult\.value = result \|\| \{\}/)
  assert.match(page, /补录公式逐项结果/)
})
