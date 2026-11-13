import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'

const page = fs.readFileSync(new URL('../src/pages/MaterialPriceSourcesPage.vue', import.meta.url), 'utf8')
const script = page.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const row = () => ({ materialCode: '00123', organization: '210', materialAttribute: null, automatic: false, version: 0, sourceType: 'FIXED', prices: [] })
function harness(fetch, update = async () => {}, refresh = async () => ({ months: 2, sourceRows: 4 })) {
  const calls = []
  const context = vm.createContext({
    computed: getter => ({ get value() { return getter() } }),
    reactive: value => value, ref: value => ({ value }), watch() {}, onMounted() {},
    useUserStore: () => ({ businessUnitType: 'COMMERCIAL', roles: ['finance_reviewer'], permissions: ['price:material-sources:edit', 'price:material-sources:refresh'] }),
    refreshMaterialPriceSources: refresh,
    fetchMaterialPriceSources: fetch, updateMaterialPriceAttribute: update,
    ElMessage: { success: value => calls.push(value), error: value => calls.push(value) },
  })
  vm.runInContext(script + '\nglobalThis.state = { filter, rows, total, error, loading, load, save, saving, refreshSources, refreshState, refreshing, rowKey, attributeOptions, attributeFilterOptions };', context)
  return { ...context.state, calls }
}

test('切换查询后迟到的响应不会覆盖新料号结果', async () => {
  const requests = []
  const state = harness(() => new Promise(resolve => requests.push(resolve)))
  const first = state.load()
  state.filter.materialCode = 'NEW'
  const second = state.load()
  requests[1]({ rows: [{ materialCode: 'NEW' }], total: 1 })
  await second
  requests[0]({ rows: [{ materialCode: 'OLD' }], total: 1 })
  await first
  assert.equal(state.rows.value[0].materialCode, 'NEW')
  assert.equal(state.loading.value, false)
})

test('保存使用已展示数据的月份并携带原版本，保留料号前导零', async () => {
  const bodies = []
  const original = row()
  const state = harness(async () => ({ rows: [original], total: 1 }), async body => {
    bodies.push(body)
    return { ...original, materialAttribute: body.materialAttribute, version: 1 }
  })
  state.filter.month = '2026-11'
  await state.load()
  state.filter.month = '2026-12'
  await state.save(original, 'OUTSOURCE')
  assert.equal(bodies[0].month, '2026-11')
  assert.equal(bodies[0].expectedVersion, 0)
  assert.equal(bodies[0].sourceType, 'FIXED')
  assert.equal(bodies[0].materialCode, '00123')
  assert.equal(original.materialAttribute, 'OUTSOURCE')
})

test('冲突或保存失败后重新读取服务端值，不能把未保存的选择显示为成功', async () => {
  const original = row()
  const state = harness(async () => ({ rows: [{ ...original, materialAttribute: 'PURCHASE', version: 2 }], total: 1 }),
    async () => { throw Error('已被其他报价员修改，请刷新') })
  await state.save(original, 'OUTSOURCE')
  assert.equal(original.materialAttribute, null)
  assert.equal(state.rows.value[0].materialAttribute, 'PURCHASE')
  assert.equal(state.calls.length, 1)
  assert.match(state.calls[0], /其他报价员/)
  assert.equal(state.saving.size, 0)
})

test('来源查询失败清空旧数据并展示错误，不能冒充来源为空', async () => {
  const state = harness(async () => { throw Error('来源读取失败') })
  state.rows.value = [row()]
  await state.load()
  assert.equal(state.rows.value.length, 0)
  assert.equal(state.error.value, '来源读取失败')
})


test('默认月份由已生成资料返回，不使用当天的月份', async () => {
  const state = harness(async () => ({ month: '2026-10', rows: [], total: 0, refresh: { generation: 1 } }))
  assert.equal(state.filter.month, '')
  await state.load()
  assert.equal(state.filter.month, '2026-10')
})

test('仅点击查询不会生成；财务更新后重新读取所选月份', async () => {
  let updates = 0
  const months = []
  const state = harness(async params => { months.push(params.month); return { month: params.month, rows: [], total: 0 } }, undefined,
    async () => { updates++; return { months: 2, sourceRows: 4 } })
  state.filter.month = '2026-10'
  await state.load()
  assert.equal(updates, 0)
  await state.refreshSources()
  assert.equal(updates, 1)
  assert.deepEqual(months, ['2026-10', '2026-10'])
})

test('更新失败保留旧清单及月份，不显示更新成功', async () => {
  const state = harness(async () => ({ rows: [], total: 0 }), undefined, async () => { throw Error('读取失败') })
  state.rows.value = [row()]
  state.filter.month = '2026-10'
  await state.refreshSources()
  assert.equal(state.rows.value.length, 1)
  assert.equal(state.filter.month, '2026-10')
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0], '读取失败')
})

test('同一料号的不同来源使用独立行身份', () => {
  const state = harness(async () => ({}))
  assert.notEqual(state.rowKey({ ...row(), sourceType: 'FIXED' }), state.rowKey({ ...row(), sourceType: 'ORDER' }))
})


test('手选项只有采购和委外，自制件仍能作为搜索条件', () => {
  const state = harness(async () => ({}))
  assert.deepEqual(Array.from(state.attributeOptions, item => item.value), ['PURCHASE', 'OUTSOURCE'])
  assert.equal(state.attributeFilterOptions.some(item => item.value === 'MANUFACTURE'), true)
})
