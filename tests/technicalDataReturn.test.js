import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReturnRequest, pendingReturn, returnMessage } from '../src/utils/technicalDataReturn.js'
const row = { formId: 1, taskId: 2, taskVersion: 3, productNo: 'P1', modules: [{ moduleType: 'SALARY', employeeNo: '00123' }, { moduleType: 'PACKAGE' }], selectedModules: ['SALARY'], reason: ' 调整工资 ' }
test('只提交选中的产品和板块，不允许前端指定技术员', () => {
  const value = buildReturnRequest([row, { ...row, taskId: 5, selectedModules: [] }], 'return-1')
  assert.deepEqual(value, { requestKey: 'return-1', targets: [{ taskId: 2, expectedTaskVersion: 3, modules: ['SALARY'], reason: '调整工资' }] })
})
test('拒绝跨单、空原因和变化后的退回范围', () => {
  assert.throws(() => buildReturnRequest([row, { ...row, formId: 2 }], 'x'), /同一张/)
  assert.throws(() => buildReturnRequest([{ ...row, reason: ' ' }], 'x'), /原因/)
  assert.throws(() => buildReturnRequest([{ ...row, selectedModules: ['PRICE'] }], 'x'), /范围已变化/)
})
test('处理中和未知结果禁止再次退回，明确失败可新建请求', () => {
  for (const status of ['PREPARED', 'SENDING', 'REJECT_READY', 'RETURN_FAILED', 'OA_ACCEPTED', 'UNKNOWN']) assert.equal(pendingReturn({ status }), true)
  for (const status of ['REJECTED', 'NOT_SENT', 'SUCCESS']) assert.equal(pendingReturn({ status }), false)
  assert.match(returnMessage({ status: 'REJECTED', oaResult: { errorCode: '200031', message: '查不到人员' } }), /200031/)
  assert.match(returnMessage({ status: 'UNKNOWN' }), /仍为只读/)
})
test('第一步成功第二步失败仍只读，提示具体失败步骤和OA错误', () => {
  assert.match(returnMessage({ status: 'REJECT_READY', step: 'REJECT' }), /技术员已回传.*尚未退回/)
  assert.match(returnMessage({ status: 'RETURN_FAILED', step: 'REJECT', oaResult: { errorCode: '1200308', message: '退回节点不在可选范围内' } }), /资料仍为只读.*1200308/)
  assert.match(returnMessage({ status: 'UNKNOWN', step: 'REJECT' }), /流程退回结果尚未确认/)
})
test('人员更新未知必须由原报价员核实，节点退回未知不能提示继续发送', () => {
  assert.match(returnMessage({ status: 'UNKNOWN', step: 'PEOPLE' }), /原报价员核实OA更新成功/)
  assert.doesNotMatch(returnMessage({ status: 'UNKNOWN', step: 'REJECT' }), /可继续/)
})
