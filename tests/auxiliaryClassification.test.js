import test from 'node:test'
import assert from 'node:assert/strict'
import { classificationScope, canConfirmClassification } from '../src/utils/auxiliaryClassification.js'
test('classification cannot confirm a preview from another product, month or file state', () => {
  const scope=classificationScope('OA',123,'2026-09')
  const valid={valid:true,fingerprint:'approved-basis'}
  assert.equal(canConfirmClassification(valid,{},scope,scope),true)
  for(const current of [classificationScope('OTHER',123,'2026-09'),classificationScope('OA',124,'2026-09'),classificationScope('OA',123,'2026-10')]) {
    assert.equal(canConfirmClassification(valid,{},scope,current),false)
  }
  assert.equal(canConfirmClassification(valid,null,scope,scope),false)
  assert.equal(canConfirmClassification({valid:false,fingerprint:'x'},{},scope,scope),false)
})

import { isEffectiveBomNotPreparedError, effectiveBomStateMeta } from '../src/utils/quoteEffectiveBom.js'
test('first entry without a prepared BOM is pending while real source failures remain errors', () => {
  assert.equal(isEffectiveBomNotPreparedError(new Error('EFFECTIVE_BOM_NOT_FOUND: 当前报价产品没有有效的BOM准备记录')),true)
  assert.equal(effectiveBomStateMeta('NOT_PREPARED').label,'待发起核算')
  for(const message of ['连接失败','EFFECTIVE_BOM_SOURCE_INVALID: 来源不一致','没有权限']) {
    assert.equal(isEffectiveBomNotPreparedError(new Error(message)),false)
  }
})
