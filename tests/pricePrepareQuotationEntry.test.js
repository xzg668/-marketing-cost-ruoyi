import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'

const source = fs.readFileSync(new URL('../src/views/cost/price-prepare/index.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'mpp12-price-prepare-entry' }).content
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace('export default', 'return')
const renderer = Vue.createRenderer({
  createComment: () => ({}), insert: () => {}, remove: () => {},
  parentNode: () => null, nextSibling: () => null,
})
const mount = () => {
  const navigation = [], reads = [], writes = []
  const empty = async params => { reads.push(params); return { total: 0, records: [] } }
  const dependencies = {
    ...Vue, useRouter: () => ({ push: value => navigation.push(value) }),
    useUserStore: () => ({ permissions: ['*:*:*'] }),
    ElMessage: { error: message => { throw new Error(message) }, warning: () => {}, success: () => {} },
    Operation: {}, RefreshLeft: {}, RefreshRight: {}, Search: {}, BasePagination: {},
    PRICE_PREPARE_GAP_PUSH_STATUS_OPTIONS: [], PRICE_PREPARE_GAP_TYPE_OPTIONS: [],
    PRICE_PREPARE_ITEM_STATUS_OPTIONS: [], PRICE_PREPARE_ITEM_TYPE_OPTIONS: [], PRICE_PREPARE_SUMMARY_STATUS_OPTIONS: [],
    fetchPricePrepareCandidates: empty, fetchPricePrepareGaps: empty, fetchPricePrepareItems: empty,
    confirmPricePrepareNoScrap: body => writes.push(body), revokePricePrepareNoScrap: body => writes.push(body),
    normalizePricePreparePage: response => ({ total: response.total, list: response.records }),
  }
  const component = new Function(...Object.keys(dependencies), script)(...Object.values(dependencies))
  component.render = () => null
  const app = renderer.createApp(component)
  const instance = app.mount({}).$
  return { app, state: instance.setupState, navigation, reads, writes }
}

test('历史准备页查询与刷新只读取记录，未选择产品时不会启动准备或跳转', async () => {
  const screen = mount()
  try {
    await Vue.nextTick(); await Promise.resolve()
    screen.state.openQuotation()
    await screen.state.refreshAll()
    assert.ok(screen.reads.length >= 2)
    assert.deepEqual(screen.navigation, [])
    assert.deepEqual(screen.writes, [])
    assert.equal(screen.state.submitGenerate, undefined)
  } finally { screen.app.unmount() }
})

test('打开报价单携带选中记录的原OA身份，不按成品料号推断产品行或批量采用', async () => {
  const screen = mount()
  try {
    await screen.state.selectCandidate({ oaNo: 'MPP12-OA/A', topProductCode: 'SAME-PRODUCT', periodMonth: '2026-10' })
    screen.state.openQuotation()
    assert.deepEqual(screen.navigation, [{ name: 'ingest-quote-request-detail', params: { oaNo: 'MPP12-OA/A' } }])
    assert.deepEqual(screen.writes, [])
  } finally { screen.app.unmount() }
})
