import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { monthlyRepricePublication } from '../src/utils/monthlyRepricePublication.js'

const state = (fields) => monthlyRepricePublication({ batch: { totalCount: 3, successCount: 2, unresolvedSourceCount: 1, ...fields } })
describe('成功子集发布与独立补算', () => {
  it('存在少量失败也可检查成功结果，检查通过当前修订才可确认', () => {
    assert.equal(state({ status: 'FAILED', checkStatus: 'PENDING' }).canCheck, true)
    assert.equal(state({ status: 'RUNNING' }).canCheck, true)
    assert.equal(state({ status: 'WAIT_CONFIRM', checkStatus: 'PASSED', checkedRevision: 8, resultRevision: 8 }).canConfirm, true)
    assert.equal(state({ status: 'WAIT_CONFIRM', checkStatus: 'PASSED', checkedRevision: 8, resultRevision: 9 }).canConfirm, false)
    assert.equal(state({ status: 'WAIT_CONFIRM', checkStatus: 'FAILED', checkedRevision: 8, resultRevision: 8 }).canConfirm, false)
  })
  it('没有成功成本或没有检查依据不能显示确认按钮', () => {
    assert.equal(state({ status: 'WAIT_CONFIRM', checkStatus: 'PASSED' }).canConfirm, false)
    assert.equal(state({ status: 'WAIT_CONFIRM', checkStatus: 'PASSED', checkedRevision: 8, resultRevision: 8, successCount: 0 }).canConfirm, false)
  })
  it('已放行补算期间不会被显示为整月未确认或全部完成', () => {
    for (const status of ['RUNNING', 'FAILED', 'CHECKING', 'WAIT_CONFIRM', 'CONFIRMED']) {
      const current = state({ status, confirmedAt: '2026-11-06T09:00:00' })
      assert.equal(current.released, true)
      assert.equal(current.allDone, false)
      assert.equal(current.uncalculated, 1)
      assert.equal(current.unresolved, 1)
      assert.match(current.confirmLabel, /本次补算/)
    }
  })
  it('缺客户来源也必须解决，全部计算且确认后才能显示本月完成', () => {
    assert.equal(state({ status: 'CONFIRMED', successCount: 3, confirmedAt: 'saved' }).allDone, false)
    assert.equal(state({ status: 'WAIT_CONFIRM', successCount: 3, unresolvedSourceCount: 0, confirmedAt: 'saved' }).allDone, false)
    assert.equal(state({ status: 'CONFIRMED', successCount: 3, unresolvedSourceCount: 0, confirmedAt: 'saved' }).allDone, true)
  })
})
