import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/pages/MonthlyRepricePage.vue', import.meta.url), 'utf8')
  .match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/import[\s\S]*?from ['"][^'"]+['"]/g, '')

function mount(status = 'CONFIRMED', fetcher) {
  let poll, unmount, mounted, calls = 0, cleared = false
  const context = {
    ref: value => ({ value }),
    computed: get => ({ get value() { return get() } }),
    watch: () => {},
    nextTick: async () => {},
    onMounted: callback => { mounted = callback },
    onUnmounted: callback => { unmount = callback },
    useUserStore: () => ({ businessUnitType: 'COMMERCIAL' }),
    useRouter: () => ({ push() {} }),
    monthlyRepricePublication: () => ({}),
    fetchRepriceCurrent: () => { calls++; return fetcher ? fetcher() : Promise.resolve({ batch: { status } }) },
    fetchMonthlyRepriceBatches: async () => ({ list: [], total: 0 }),
    window: { addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible' },
    setInterval: callback => { poll = callback; return 1 },
    clearInterval: () => { cleared = true },
  }
  runInNewContext(source + '\nglobalThis.page = { view, refresh };', context)
  mounted()
  return { context, poll: () => poll(), unmount: () => unmount(), calls: () => calls, cleared: () => cleared }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

for (const status of ['CONFIRMED', 'WAIT_CONFIRM', 'FAILED']) {
  test(`${status} 批次结束后不再每两秒轮询`, async () => {
    const page = mount(status)
    await flush()
    page.poll(); await flush(); page.poll(); await flush()
    assert.equal(page.calls(), 1)
    page.unmount()
    assert.equal(page.cleared(), true)
  })
}

for (const status of ['QUEUED', 'RUNNING', 'CHECKING']) {
  test(`${status} 保留进度轮询，完成后停止`, async () => {
    const page = mount(status)
    await flush()
    page.poll(); await flush()
    assert.equal(page.calls(), 2)
    page.context.page.view.value = { batch: { status: 'CONFIRMED' } }
    page.poll(); await flush()
    assert.equal(page.calls(), 2)
  })
}

test('当前没有批次时不持续空查，手动刷新仍有效', async () => {
  const page = mount(null, async () => ({ batch: null }))
  await flush()
  page.poll(); await flush()
  assert.equal(page.calls(), 1)
  await page.context.page.refresh()
  assert.equal(page.calls(), 2)
})

test('慢请求期间不重叠轮询或焦点刷新', async () => {
  let complete
  const page = mount('RUNNING', () => new Promise(resolve => { complete = resolve }))
  page.context.page.view.value = { batch: { status: 'RUNNING' } }
  page.poll(); page.poll(); page.context.page.refresh()
  assert.equal(page.calls(), 1)
  complete({ batch: { status: 'CONFIRMED' } }); await flush()
  page.poll(); await flush()
  assert.equal(page.calls(), 1)
})

test('隐藏页面暂停进度轮询，恢复显示后继续', async () => {
  const page = mount('RUNNING')
  await flush()
  page.context.document.visibilityState = 'hidden'
  page.poll(); await flush()
  assert.equal(page.calls(), 1)
  page.context.document.visibilityState = 'visible'
  page.poll(); await flush()
  assert.equal(page.calls(), 2)
})
