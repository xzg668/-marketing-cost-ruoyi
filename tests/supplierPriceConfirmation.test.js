import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('../src/components/SupplierPriceReviewPanel.vue', import.meta.url), 'utf8')
  .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
function fixture(confirmApi) {
  const review = { scopeKey: 'scope', fingerprint: 'fp', status: 'PENDING', scope: { materialCode: '9810000081224', pricingDate: '2026-11-17' } }
  const props = { oaNo: 'OA-024', itemId: 217, periodMonth: '2026-11', reviews: [review], materials: [], readonly: false }
  const messages = [], events = []
  const panel = new Function('computed', 'ref', 'watch', 'onUnmounted', 'defineProps', 'defineEmits', 'confirmSupplierPriceReview', 'ElMessage', `${script};return {openReview,confirm,choice,confirmVisible,saving,tableRows,importVisible}`)(
    fn => ({ get value() { return fn() } }), value => ({ value }), () => {}, () => {}, () => props,
    () => (...args) => events.push(args), confirmApi,
    Object.fromEntries(['success', 'warning', 'error'].map(type => [type, message => messages.push({ type, message })])))
  panel.openReview(review); panel.choice.value = false
  return { panel, props, messages, events }
}
test('saved confirmation closes the dialog, shows the saved choice and warns about blocked repricing without starting costing', async () => {
  const message = '最高价选择已保存；重新取价未完成：CMS 已完成核实，本产品两项工资均不存在'
  const f = fixture(async () => ({ decisionId: 43, decision: 'FALLBACK_HIGH', repriceStatus: 'BLOCKED', message, workbench: null }))
  await f.panel.confirm()
  assert.equal(f.panel.confirmVisible.value, false)
  assert.equal(f.panel.tableRows.value[0].status, 'FALLBACK_HIGH')
  assert.deepEqual(f.messages, [{ type: 'warning', message }])
  assert.deepEqual(f.events, [])
  assert.equal(f.panel.saving.value, false)
})
test('completed repricing forwards the actual workbench and keeps the original continuation', async () => {
  const workbench = { oaNo: 'OA-024', oaFormItemId: 217, periodMonth: '2026-11', readiness: { status: 'READY' } }
  const f = fixture(async () => ({ decisionId: 43, decision: 'FALLBACK_HIGH', repriceStatus: 'COMPLETED', message: '最高价选择已保存，取价结果已更新', workbench }))
  await f.panel.confirm()
  assert.deepEqual(f.events, [['updated', workbench]])
  assert.equal(f.messages[0].type, 'success')
})
test('failure before the confirmation commit leaves the choice unconfirmed', async () => {
  const f = fixture(async () => { throw new Error('候选价格或供货比率已变化') })
  await f.panel.confirm()
  assert.equal(f.panel.confirmVisible.value, true)
  assert.equal(f.panel.tableRows.value[0].status, 'PENDING')
  assert.equal(f.messages[0].type, 'error')
  assert.deepEqual(f.events, [])
})
test('an old response cannot update a different product or open its import dialog', async () => {
  let resolve
  const f = fixture(() => new Promise(done => { resolve = done }))
  f.panel.choice.value = true
  const pending = f.panel.confirm()
  f.props.itemId = 218
  resolve({ decisionId: 43, decision: 'WAIT_IMPORT', repriceStatus: 'BLOCKED', message: '等待补录', workbench: null })
  await pending
  assert.deepEqual(f.events, [])
  assert.deepEqual(f.messages, [])
  assert.equal(f.panel.importVisible.value, false)
})

test('confirming multiple materials retains each saved choice without hiding changed candidates', async () => {
  const f = fixture(async () => ({ decisionId: 43, decision: 'FALLBACK_HIGH', repriceStatus: 'BLOCKED', message: '已保存；工资待补', workbench: null }))
  const second = { scopeKey: 'second', fingerprint: 'fp2', status: 'PENDING', scope: { pricingDate: '2026-11-17' } }
  f.props.reviews.push(second)
  await f.panel.confirm()
  f.panel.openReview(second); f.panel.choice.value = false
  await f.panel.confirm()
  assert.deepEqual(f.panel.tableRows.value.map(row => row.status), ['FALLBACK_HIGH', 'FALLBACK_HIGH'])
  f.props.reviews[0].fingerprint = 'changed'
  assert.equal(f.panel.tableRows.value[0].status, 'PENDING')
})

test('blocked repricing refreshes actual price gaps without continuing to costing', async () => {
  const workbench = { oaNo: 'OA-024', oaFormItemId: 217, periodMonth: '2026-11', readiness: { status: 'READY' } }
  const f = fixture(async () => ({ decisionId: 43, decision: 'FALLBACK_HIGH', repriceStatus: 'BLOCKED', message: '选择已保存；工资待补', workbench }))
  await f.panel.confirm()
  assert.deepEqual(f.events, [['updated', workbench, false]])
  assert.equal(f.messages[0].type, 'warning')
  const page = readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')
  const handler = page.slice(page.indexOf('async function completePriceSourceMaintenance('), page.indexOf('async function loadPricePrepare('))
  let costs = 0
  const call = new Function('historyViewMode','costRunActionLoading','oaNo','itemId','workbench','pricePrepare','submitProductCosting','loadWorkbench','loadCostRun','activeTab',`${handler};return completePriceSourceMaintenance`)(
    {value:false},{value:false},{value:'OA-024'},{value:'217'},{value:{periodMonth:'2026-11'}},{value:null},async()=>costs++,async()=>{},async()=>{},{value:''})
  await call(workbench,false)
  assert.equal(costs,0)
  await call(workbench)
  assert.equal(costs,1)
})
