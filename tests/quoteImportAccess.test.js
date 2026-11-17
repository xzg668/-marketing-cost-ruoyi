import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canImportQuote } from '../src/utils/quoteImport.js'

test('报价单导入只接受实际 admin 角色，报价员、总监及通配权限均不能替代', () => {
  for (const roles of [[], ['bu_staff'], ['bu_director'], ['finance_reviewer'], ['*:*:*'], ['ingest:quote:import'], ['admin_other'], null]) {
    assert.equal(canImportQuote(roles), false)
  }
  for (const roles of [['admin'], ['ADMIN'], ['bu_staff', 'admin']]) assert.equal(canImportQuote(roles), true)
})
