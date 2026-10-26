import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reactive } from 'vue'
import { createInquiryList } from '../src/pages/householdInquiryList.js'

function fixture() {
  const access = reactive({ scope: 'finance/HOUSEHOLD', allowed: true }), pending = []
  const list = createInquiryList({ scope: () => access.scope, allowed: () => access.allowed, fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) })
  return { access, pending, list }
}
test('撤销列表权限立即清空既有数据并丢弃在途响应，恢复权限后重新读取', async () => {
  const f = fixture(); const first = f.list.load({}); f.pending[0].resolve({ rows: [{ id: 1 }], total: 1 }); await first
  assert.equal(f.list.state.total, 1)
  const old = f.list.load({}); f.access.allowed = false
  assert.equal(f.list.state.total, 0); assert.deepEqual(f.list.state.rows, []); assert.equal(f.list.state.loading, false)
  f.pending[1].resolve({ rows: [{ id: 2 }], total: 1 }); await old; assert.equal(f.list.state.total, 0)
  await f.list.load({}); assert.equal(f.pending.length, 2)
  f.access.allowed = true; const fresh = f.list.load({}); f.pending[2].resolve({ rows: [{ id: 3 }], total: 1 }); await fresh
  assert.equal(f.list.state.rows[0].id, 3); f.list.dispose()
})
test('相同权限切换账号业务单元时丢弃旧错误，卸载后不接收响应', async () => {
  const f = fixture(); const old = f.list.load({}); f.access.scope = 'other/COMMERCIAL'
  f.pending[0].reject(new Error('旧账号错误')); await old; assert.equal(f.list.state.error, '')
  const next = f.list.load({}); f.list.dispose(); f.pending[1].resolve({ rows: [{ id: 1 }], total: 1 }); await next
  assert.equal(f.list.state.total, 0)
})
