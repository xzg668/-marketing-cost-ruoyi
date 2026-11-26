import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('../src/components/SupplierPriceReviewPanel.vue', import.meta.url), 'utf8')
  .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const workbench = { oaNo: 'OA-024', oaFormItemId: 217, periodMonth: '2026-11', readiness: { status: 'READY' } }

function fixture({ save, reprice, pending = async () => [] } = {}) {
  const review = { scopeKey: 'scope', fingerprint: 'fp', status: 'PENDING', scope: { materialCode: '9810000081224', pricingDate: '2026-11-17' } }
  const props = { oaNo: 'OA-024', itemId: 217, periodMonth: '2026-11', reviews: [review], materials: [], readonly: false, canConfirm: true }
  const messages = [], events = [], saves = [], reprices = []
  const saveApi = async (oa, item, requests) => {
    saves.push([oa, item, requests])
    return save ? save(oa, item, requests) : requests.map((row, index) => ({ ...row, decisionId: 43 + index, decision: row.hasNewApproval ? 'WAIT_IMPORT' : 'FALLBACK_HIGH' }))
  }
  const repriceApi = async (oa, item, ids) => {
    reprices.push([oa, item, ids])
    return reprice ? reprice(oa, item, ids) : { repriceStatus: 'COMPLETED', workbench }
  }
  const panel = new Function('computed', 'ref', 'watch', 'onUnmounted', 'defineProps', 'defineEmits',
    'saveSupplierPriceReviews', 'repriceSavedSupplierReviews', 'fetchPendingSupplierReprice', 'ElMessage',
    `${script};return {openReview,openBatch,checkedRows,confirm,choice,confirmVisible,saving,repricing,tableRows,importVisible,confirmationNotice,retryReprice,restorePendingReprice}`)(
    fn => ({ get value() { return fn() } }), value => ({ value }), () => {}, () => {}, () => props,
    () => (...args) => events.push(args), saveApi, repriceApi, pending,
    Object.fromEntries(['success', 'warning', 'error'].map(type => [type, message => messages.push({ type, message })])))
  panel.openReview(review)
  panel.choice.value = false
  return { panel, props, messages, events, saves, reprices }
}

test('a saved single choice closes the dialog before the price response and continues costing only on completion', async () => {
  let complete
  const f = fixture({ reprice: () => new Promise(resolve => { complete = resolve }) })
  const followUp = f.panel.confirm()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.panel.confirmVisible.value, false)
  assert.equal(f.panel.saving.value, false)
  assert.equal(f.panel.repricing.value, true)
  assert.equal(f.panel.tableRows.value[0].status, 'FALLBACK_HIGH')
  assert.deepEqual(f.events, [])
  complete({ repriceStatus: 'COMPLETED', workbench })
  await followUp
  assert.deepEqual(f.events, [['updated', workbench]])
})

test('failure before saving keeps the dialog open', async () => {
  const f = fixture({ save: async () => { throw new Error('候选价格或供货比率已变化') } })
  await f.panel.confirm()
  assert.equal(f.panel.confirmVisible.value, true)
  assert.equal(f.panel.tableRows.value[0].status, 'PENDING')
  assert.equal(f.messages[0].type, 'error')
  assert.deepEqual(f.reprices, [])
})

test('a failed follow-up can be retried using the existing decision', async () => {
  let retried = false
  const f = fixture({ reprice: async () => {
    if (!retried) throw new Error('CMS 工资待补')
    return { repriceStatus: 'COMPLETED', workbench }
  } })
  await f.panel.confirm()
  assert.match(f.panel.confirmationNotice.value, /选择已保存.*工资待补/)
  assert.equal(f.panel.confirmVisible.value, false)
  assert.deepEqual(f.events, [])
  retried = true
  await f.panel.retryReprice()
  assert.equal(f.saves.length, 1)
  assert.deepEqual(f.reprices, [['OA-024', 217, [43]], ['OA-024', 217, [43]]])
  assert.deepEqual(f.events, [['updated', workbench]])
})

test('old product responses cannot affect the new product or its import dialog', async () => {
  let resolve
  const f = fixture({ save: () => new Promise(done => { resolve = done }) })
  f.panel.choice.value = true
  const pending = f.panel.confirm()
  f.props.itemId = 218
  resolve([{ decisionId: 43, scopeKey: 'scope', fingerprint: 'fp', decision: 'WAIT_IMPORT' }])
  await pending
  assert.deepEqual(f.reprices, [['OA-024', 217, [43]]])
  assert.deepEqual(f.events, [])
  assert.equal(f.panel.importVisible.value, false)
})

test('batch confirmation saves two reviewed scopes and reprices once', async () => {
  const f = fixture()
  const second = { scopeKey: 'second', fingerprint: 'fp2', status: 'PENDING', scope: { pricingDate: '2026-11-17' } }
  f.props.reviews.push(second)
  f.panel.checkedRows.value = f.props.reviews
  f.panel.openBatch()
  f.panel.choice.value = false
  await f.panel.confirm()
  assert.deepEqual(f.saves[0][2].map(row => row.scopeKey), ['scope', 'second'])
  assert.deepEqual(f.reprices, [['OA-024', 217, [43, 44]]])
  assert.deepEqual(f.panel.tableRows.value.map(row => row.status), ['FALLBACK_HIGH', 'FALLBACK_HIGH'])
  f.props.reviews[0].fingerprint = 'changed'
  assert.equal(f.panel.tableRows.value[0].status, 'PENDING')
})

test('a saved repricing action resumes after reopening the page without saving again', async () => {
  const f = fixture({ pending: async () => [{ decisionId: 43, scopeKey: 'scope', fingerprint: 'fp', decision: 'FALLBACK_HIGH' }] })
  await f.panel.restorePendingReprice()
  assert.deepEqual(f.saves, [])
  assert.deepEqual(f.reprices, [['OA-024', 217, [43]]])
})

test('a replayed completed decision refreshes the page without continuing costing again', async () => {
  const f = fixture({ reprice: async () => ({ repriceStatus: 'CURRENT', workbench }) })
  await f.panel.confirm()
  assert.deepEqual(f.events, [['updated', workbench, false]])
})

test('the workbench continues costing only for a completed ready result', async () => {
  const page = readFileSync(new URL('../src/pages/QuoteProductCostingWorkbenchPage.vue', import.meta.url), 'utf8')
  const handler = page.slice(page.indexOf('async function completePriceSourceMaintenance('), page.indexOf('async function loadPricePrepare('))
  let costs = 0
  const call = new Function('historyViewMode','costRunActionLoading','oaNo','itemId','workbench','pricePrepare','submitProductCosting','loadWorkbench','loadCostRun','activeTab',`${handler};return completePriceSourceMaintenance`)(
    {value:false},{value:false},{value:'OA-024'},{value:'217'},{value:{periodMonth:'2026-11'}},{value:null},async()=>costs++,async()=>{},async()=>{},{value:''})
  await call(workbench, false)
  await call({ ...workbench, readiness: { status: 'PARTIAL' } })
  assert.equal(costs, 0)
  await call(workbench)
  assert.equal(costs, 1)
})
