import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, ref } from 'vue'
import { useCostingGapAvailability } from '../src/composables/useCostingGapAvailability.js'
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness(fetch, pending = 1) {
  const scope = effectScope(), oaNo = ref('A'), count = ref(pending), revision = ref(1)
  const state = scope.run(() => useCostingGapAvailability(oaNo, count, revision, fetch))
  return { ...state, scope, oaNo, count, revision }
}
test('only a category with actual records is visible; an unrelated pending product does not show empty categories', async () => {
  const calls = []
  const h = harness(async (oa, category) => { calls.push([oa,category]);return { records: category === 'PRICE' ? [{ materialCode: '0001' }] : [] } })
  await flush()
  assert.deepEqual(h.counts.value, { RATIO: 0, PRICE: 1, OTHER: 0 })
  assert.deepEqual(h.details.value.PRICE, [{ materialCode: '0001' }])
  assert.equal(calls.length, 3); h.scope.stop()
})
test('all zero and fully ready states have no categories, and ready products cause no extra reads', async () => {
  let calls = 0
  const h = harness(async () => { calls++; return { materialCount: 0, records: [] } })
  await flush(); assert.deepEqual(h.counts.value, { RATIO: 0, PRICE: 0, OTHER: 0 })
  h.count.value = 0;await flush();assert.deepEqual(h.counts.value, {});assert.equal(calls, 3)
  h.scope.stop()
})
test('a delayed old quote response cannot display its categories on a new quote', async () => {
  const delayed = []
  const h = harness((oa, category) => oa === 'A' ? new Promise(resolve => delayed.push(resolve))
    : Promise.resolve({ records: category === 'OTHER' ? [{}] : [] }))
  h.oaNo.value = 'B';await flush()
  for (const resolve of delayed) resolve({ records: [{ materialCode: 'OLD' }] })
  await flush();assert.deepEqual(h.counts.value, { RATIO: 0, PRICE: 0, OTHER: 1 });h.scope.stop()
})
test('failed reads remain an error instead of being presented as no gaps; refresh can recover', async () => {
  let failed = true
  const h = harness(async (_, category) => { if (failed && category === 'PRICE') throw new Error('读取失败'); return { records: [] } })
  await flush();assert.equal(h.error.value, '读取失败');assert.equal(h.counts.value.PRICE, undefined)
  failed = false;await h.refresh();assert.equal(h.error.value, '');assert.equal(h.counts.value.PRICE, 0);h.scope.stop()
})
