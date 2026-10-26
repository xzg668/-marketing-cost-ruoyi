import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reactive } from 'vue'
import { createMonthlyRead, monthlyFilter, monthlyQuantity, monthlyAnnualUsage, monthlySource, monthlyCondition } from '../src/pages/monthlyMaterialPriceQuery.js'
import { inquiryPercent } from '../src/pages/householdInquiryUtils.js'

function setup() {
  const access = reactive({ scope: 'finance/COMMERCIAL', allowed: true }), pending = []
  const read = createMonthlyRead({ scope: () => access.scope, allowed: () => access.allowed, fetch: input => new Promise((resolve, reject) => pending.push({ input, resolve, reject })) })
  return { access, pending, read }
}
test('月价筛选保存显式月份和前导零，分页拒绝小数和越界值', () => {
  const q = monthlyFilter({ month: '2025-02', materialCode: '001a', organization: '220', page: '2', size: '1' }, '2026-10')
  assert.equal(q.month, '2025-02'); assert.equal(q.materialCode, '001a'); assert.equal(q.page, 2); assert.equal(q.size, 1)
  assert.equal(monthlyFilter({ page: '-1', size: '101' }, '2026-10').page, 1)
  assert.equal(monthlyFilter({ page: '1.5', size: '0' }, '2026-10').size, 20)
})
test('月价零费率与空白不同，高精度费率不经过浮点计算', () => {
  assert.equal(inquiryPercent(null), ''); assert.equal(inquiryPercent('0'), '0%')
  assert.equal(inquiryPercent('0.085123456789'), '8.5123456789%')
  assert.equal(monthlyQuantity({ lower: '0', lowerInclusive: true, upper: '10', upperInclusive: false }), '[0, 10)')
  assert.equal(monthlyCondition({ mode: 'ANY', values: [] }), '通用条件')
  assert.match(monthlyCondition({ mode: 'EXCLUDING', values: [{ boardTerms: null }] }), /^排除/)
})
test('快速切换月价时旧详情和旧错误不能覆盖新选择', async () => {
  const f = setup(), one = f.read.load(1), two = f.read.load(2)
  f.pending[1].resolve({ id: 2 }); await two; f.pending[0].resolve({ id: 1 }); await one
  assert.equal(f.read.state.data.id, 2)
  const old = f.read.load(3), fresh = f.read.load(4)
  f.pending[3].resolve({ id: 4 }); await fresh; f.pending[2].reject(new Error('旧错误')); await old
  assert.equal(f.read.state.data.id, 4); assert.equal(f.read.state.error, ''); f.read.dispose()
})
test('撤权或切换业务单元立即清空月价、引用与在途结果', async () => {
  const f = setup(), load = f.read.load(1); f.pending[0].resolve({ id: 1 }); await load
  f.access.allowed = false; assert.equal(f.read.state.data, null)
  await f.read.load(2); assert.equal(f.pending.length, 1)
  f.access.allowed = true; const next = f.read.load(3); f.access.scope = 'other/HOUSEHOLD'
  f.pending[1].resolve({ id: 3 }); await next; assert.equal(f.read.state.data, null); f.read.dispose()
})
test('关闭详情和卸载后丢弃旧响应；重试保留当前错误语义', async () => {
  const f = setup(), load = f.read.load(1); f.pending[0].reject(new Error('无权限')); await load
  assert.equal(f.read.state.error, '无权限'); const next = f.read.load(2); f.read.clear()
  f.pending[1].resolve({ id: 2 }); await next; assert.equal(f.read.state.data, null)
  const last = f.read.load(3); f.read.dispose(); f.pending[2].resolve({ id: 3 }); await last; assert.equal(f.read.state.data, null)
})

test('订单阶梯来源和独立成品年用量范围可读，旧月价默认不限年用量', () => {
  assert.equal(monthlySource('ODS_ORDER'), '订单价')
  assert.equal(monthlySource('ODS_TIER'), '阶梯价')
  assert.equal(monthlyAnnualUsage(undefined), '不限年用量')
  assert.equal(monthlyAnnualUsage({ quantities: null, includesUnknown: true }), '未提供年用量')
  assert.equal(monthlyAnnualUsage({ quantities: { lower: '240000', lowerInclusive: true, upper: null, upperInclusive: false }, includesUnknown: false }), '[240000, 不限)')
})
