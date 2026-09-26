import test from 'node:test'
import assert from 'node:assert/strict'
import { personalPendingProductCount, submittedDocumentRows, technicalSubmissionMessage } from '../src/utils/technicalDataDocument.js'

const module = (assigneeUserId, moduleStatus, required = true) => ({ assigneeUserId, moduleStatus, required })
const task = (id, modules) => ({ id, assigneeUserId: 7, products: [{ modules }] })
test('本单待提交数量只统计自己的产品，不等待另一个技术员', () => {
  const document = { tasks: [task(1, [module(7, 'READY'), module(8, 'PENDING')]), task(2, [module(7, 'SUBMITTED')]), task(3, [module(8, 'PENDING')])] }
  assert.equal(personalPendingProductCount(document, 7), 1)
  assert.equal(personalPendingProductCount(document, '7'), 1)
  assert.equal(personalPendingProductCount(document, 8), 2)
})
test('退回后只提示自己待重新提交的产品，保留他人审批状态', () => {
  const document = { lastSubmission: { status: 'SUCCESS' }, tasks: [task(1, [module(7, 'APPROVED'), module(8, 'RETURNED')])] }
  assert.equal(personalPendingProductCount(document, 7), 0)
  assert.equal(technicalSubmissionMessage(document, 7), '本人资料已提交，等待 OA 审批。')
  assert.match(technicalSubmissionMessage(document, 8), /部分资料需要修改/)
})
test('无独立模块负责人时使用任务负责人，非补录板块不计入提交', () => {
  const document = { tasks: [task(1, [module(null, 'READY'), module(7, 'PENDING', false)]), task(2, [module(7, 'APPROVED')])] }
  assert.equal(personalPendingProductCount(document, 7), 1)
})
test('固定提交版本只能生成只读列表，不改变原始提交数据', () => {
  const document = { tasks: [task(1, [module(7, 'SUBMITTED')])] }
  const rows = submittedDocumentRows(document)
  assert.equal(rows[0].taskId, 1)
  assert.equal(rows[0].product, document.tasks[0].products[0])
  assert.deepEqual(rows[0].editableModules, [])
  assert.equal(document.tasks[0].taskId, undefined)
})
test('失败和结果不明不能显示为已提交', () => {
  for (const status of ['REJECTED', 'NOT_SENT', 'UNKNOWN', 'SENDING', 'OA_ACCEPTED']) {
    assert.doesNotMatch(technicalSubmissionMessage({ tasks: [], lastSubmission: { status } }, 7), /本人资料已提交/)
  }
})
