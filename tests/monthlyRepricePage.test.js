import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const api=fs.readFileSync(path.join(root,'src/api/monthlyReprice.js'),'utf8')
const page=fs.readFileSync(path.join(root,'src/pages/MonthlyRepricePage.vue'),'utf8')
describe('1130 调价入口与旧历史读取',()=>{
  it('一键、重试及确认使用新契约，不再调用六个停用操作',()=>{
    for(const route of ['/1130/current','/1130/start','/retry','/confirm']) assert.ok(api.includes(route))
    for(const name of ['createMonthlyRepriceBatch','expandMonthlyRepriceBatch','prepareMonthlyRepriceLinkedPrice','cancelMonthlyRepriceBatch','retryMonthlyRepriceFailedTasks']) assert.ok(!api.includes(name))
  })
  it('按钮使用服务端真实总监资格，确认绑定当前检查版本',()=>{
    assert.match(page,/view.canOperate/)
    assert.match(page,/batch.status === 'WAIT_CONFIRM'/)
    assert.match(page,/batch.value.checkedRevision/)
    assert.doesNotMatch(page,/v-hasPermi|v-hasRole/)
  })
  it('保留历史列表、结果分页及保存明细读取',()=>{
    for(const name of ['fetchMonthlyRepriceBatches','fetchMonthlyRepriceResults','fetchMonthlyRepricePartItems','fetchMonthlyRepriceCostItems']) assert.ok(page.includes(name))
    assert.match(page,/v.list/)
    assert.match(page,/resultPage/)
  })
  it('业务单元切换和离开页面使迟到请求失效',()=>{
    assert.match(page,/user.businessUnitType/)
    assert.match(page,/current===epoch/)
    assert.match(page,/onUnmounted/)
    assert.match(page,/clearInterval/)
  })
})
