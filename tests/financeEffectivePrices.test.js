import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { originalPublicationMessage, financePublicationMessage, effectivePriceStatusLabel } from '../src/components/originalPriceDisplay.js'

const source = readFileSync(new URL('../src/api/originalPriceTrials.js', import.meta.url), 'utf8')
  .replace("import { request } from './http'", 'const request = async (path, options = {}) => ({ path, ...options })')
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('两类列表批量读取原稿ID和请求月，详情使用只读GET', async () => {
  for (const kind of ['Linked', 'Range']) {
    const response = await api[`fetch${kind}EffectivePrices`]([1, 2, 3], '2026-10')
    assert.deepEqual(response.body, { originalIds: [1, 2, 3], pricingMonth: '2026-10' })
    assert.match(response.path, /original-effective-prices$/)
    const detail = await api[`fetch${kind}EffectiveDetail`](1, '2026-10')
    assert.equal(detail.method ?? 'GET', 'GET')
    assert.deepEqual(detail.params, { pricingMonth: '2026-10' })
    assert.equal(detail.body, undefined)
  }
})

test('发布提示区分待基价、已就绪和基价已发布但尚无适用原稿', () => {
  assert.match(originalPublicationMessage({ effectivePriceStatus: 'WAIT_FINANCE_BASE' }, '联动'), /已保存.*待发布/)
  assert.match(originalPublicationMessage({ effectivePrices: { waitingRules: 2, generated: 0 } }, '区间'), /待发布/)
  assert.match(originalPublicationMessage({ effectivePrices: { waitingRules: 0, generated: 4 } }, '区间'), /已就绪.*4 条/)
  assert.match(originalPublicationMessage({ effectivePriceStatus: 'READY', effectivePriceGeneratedCount: 0 }, '联动'), /已就绪/)
  assert.match(financePublicationMessage({ effectivePrices: { generated: 0, reused: 0 } }), /尚无/)
  assert.match(financePublicationMessage({ effectivePrices: { generated: 4, reused: 2 } }), /已就绪.*4 条.*2 条/)
  assert.equal(effectivePriceStatusLabel('WAIT_FINANCE_BASE'), '待基价')
  assert.equal(effectivePriceStatusLabel('ERROR'), '待处理')
})

// 执行页面真实加载函数，替换HTTP边界；验证请求次数和返回顺序，不复制加载实现。
const page = readFileSync(new URL('../src/pages/PriceLinkedResultPage.vue', import.meta.url), 'utf8')
const loader = page.slice(page.indexOf('const loadRowTraces = async () => {'), page.indexOf('const fetchVariables = async () => {'))
const createLoader = new Function('tableRows', 'filters', 'rowTraceMap', 'fetchLinkedEffectivePrices', 'fetchTrace', 'parseTraceJson',
  `let traceRequest = 0; ${loader}; return loadRowTraces`)

test('30行公共原稿只发一个有效价请求，不发逐行试算或trace请求', async () => {
  const rows = { value: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, formulaExpr: '[cu]', expressionVersion: 'ORIGINAL_V1' })) }
  const prices = { value: {} }
  let requests = 0
  const load = createLoader(rows, { value: { pricingMonth: '2026-10' } }, prices, async ids => {
    requests++
    assert.equal(ids.length, 30)
    return ids.map(originalId => ({ originalId, status: 'READY', unitPrice: '12.345678' }))
  }, () => assert.fail('公共原稿不应读逐行trace'), JSON.parse)
  await load()
  assert.equal(requests, 1)
  assert.equal(Object.keys(prices.value).length, 30)
  assert.equal(prices.value[30].calcPrice, '12.345678')
})

test('切换月份后迟到的旧读取不能覆盖新结果；缺价和请求失败不补零', async () => {
  const rows = { value: [{ id: 1, formulaExpr: '[cu]', expressionVersion: 'ORIGINAL_V1' }] }
  const scope = { value: { pricingMonth: '2026-10' } }, prices = { value: {} }
  let finishOld
  const load = createLoader(rows, scope, prices, async (_, month) => {
    if (month === '2026-10') return new Promise(resolve => { finishOld = resolve })
    if (month === '2026-12') throw new Error('读取失败')
    return [{ originalId: 1, status: 'WAIT_FINANCE_BASE', unitPrice: null, message: '待基价' }]
  }, () => assert.fail('原稿不应读取trace'), JSON.parse)
  const old = load()
  scope.value.pricingMonth = '2026-11'
  await load()
  finishOld([{ originalId: 1, status: 'READY', unitPrice: '99' }])
  await old
  assert.equal(prices.value[1].status, 'WAIT_FINANCE_BASE')
  assert.equal(prices.value[1].calcPrice, null)
  scope.value.pricingMonth = '2026-12'
  await load()
  assert.equal(prices.value[1].status, 'ERROR')
  assert.equal(prices.value[1].calcPrice, null)
})
