import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  effectiveBomMatchesCostingBuild,
  effectiveBomIsReadOnly,
  effectiveBomStateMeta,
  effectiveBomStepCompleted,
} from '../src/utils/quoteEffectiveBom.js'

describe('QEB-14 冻结和复用状态', () => {
  it('FROZEN 显示本月已确定、只读并自动完成第 1 步', () => {
    assert.deepEqual(effectiveBomStateMeta('FROZEN'), { label: '本月已确定', type: 'success' })
    assert.equal(effectiveBomIsReadOnly('FROZEN'), true)
    assert.equal(effectiveBomStepCompleted('FROZEN'), true)
    assert.equal(effectiveBomMatchesCostingBuild(
      { state: 'FROZEN', buildBatchId: 'QEB-1' },
      { buildBatchId: 'QEB-1', bomRows: [{ id: 1 }] },
    ), true)
  })

  it('REUSED 显示本月已沿用、只读并允许进入第 2 步', () => {
    assert.deepEqual(effectiveBomStateMeta('REUSED'), { label: '本月已沿用', type: 'success' })
    assert.equal(effectiveBomIsReadOnly('REUSED'), true)
    assert.equal(effectiveBomMatchesCostingBuild(
      { state: 'REUSED', buildBatchId: 'QEB-1' },
      { buildBatchId: 'QEB-1', bomRows: [{ id: 1 }] },
    ), true)
  })
})
