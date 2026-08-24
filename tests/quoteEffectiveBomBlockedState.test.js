import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  effectiveBomStateMeta,
  normalizeQuoteEffectiveBom,
  workbenchHasCurrentCostingBom,
} from '../src/utils/quoteEffectiveBom.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('QEB-14 阻断状态', () => {
  it('保留后端的可读阻断信息且不能生成当前报价物料', () => {
    const result = normalizeQuoteEffectiveBom({
      state: 'BLOCKED',
      blockIssues: [{ issueCode: 'SUPPLIER_RATIO_MISSING', materialCode: 'P', message: '未找到有效供货比例' }],
    })
    assert.equal(result.blockIssues[0].message, '未找到有效供货比例')
    assert.deepEqual(effectiveBomStateMeta(result.state), { label: '需处理', type: 'danger' })
    assert.equal(workbenchHasCurrentCostingBom({
      buildBatchId: 'QEB-1',
      bomRows: [{ id: 1 }],
    }), false)
  })

  it('页签允许查看，但不会因切换或路由直达隐式生成报价物料', () => {
    assert.match(pageContent, /:before-leave="beforeWorkbenchTabLeave"/)
    assert.match(pageContent, /function beforeWorkbenchTabLeave\(\)[\s\S]*return true/)
    assert.doesNotMatch(pageContent, /requestedTab !== 'PRODUCT_DETAIL'[\s\S]*!pricingBomReadyForNextStep/)
    assert.match(pageContent, /按当前规则重新生成/)
    assert.match(pageContent, /请先处理本次计价 BOM 的数据问题/)
  })
})
