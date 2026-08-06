import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  effectiveBomMatchesCostingBuild,
  effectiveBomStateMeta,
  normalizeQuoteEffectiveBom,
} from '../src/utils/quoteEffectiveBom.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('QEB-14 阻断状态', () => {
  it('保留后端的可读阻断信息且不能进入下一步', () => {
    const result = normalizeQuoteEffectiveBom({
      state: 'BLOCKED',
      blockIssues: [{ issueCode: 'SUPPLIER_RATIO_MISSING', materialCode: 'P', message: '未找到有效供货比例' }],
    })
    assert.equal(result.blockIssues[0].message, '未找到有效供货比例')
    assert.deepEqual(effectiveBomStateMeta(result.state), { label: '需处理', type: 'danger' })
    assert.equal(effectiveBomMatchesCostingBuild(
      result,
      { buildBatchId: 'QEB-1', bomRows: [{ id: 1 }] },
    ), false)
  })

  it('tab before-leave 和路由直达都会拦截未确认或阻断产品', () => {
    assert.match(pageContent, /:before-leave="beforeWorkbenchTabLeave"/)
    assert.match(pageContent, /function beforeWorkbenchTabLeave/)
    assert.match(pageContent, /暂时不能进入下一步/)
    assert.match(pageContent, /requestedTab !== 'PRODUCT_DETAIL'[\s\S]*!pricingBomReadyForNextStep/)
  })
})
