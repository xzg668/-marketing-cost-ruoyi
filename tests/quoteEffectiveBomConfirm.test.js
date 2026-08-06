import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  costingBomMatchesPreparedBuild,
  effectiveBomCanConfirm,
  effectiveBomMatchesCostingBuild,
} from '../src/utils/quoteEffectiveBom.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('本次计价 BOM 进入第 2 步', () => {
  it('只有无阻断且至少有一个节点的草稿可以自动生成报价物料明细', () => {
    assert.equal(effectiveBomCanConfirm({ state: 'DRAFT', nodes: [{ nodeKey: 'P' }] }), true)
    assert.equal(effectiveBomCanConfirm({ state: 'DRAFT', nodes: [] }), false)
    assert.equal(effectiveBomCanConfirm({ state: 'DRAFT', nodes: [{ nodeKey: 'P' }], blockIssues: [{}] }), false)
    assert.equal(effectiveBomCanConfirm({ state: 'FROZEN', nodes: [{ nodeKey: 'P' }] }), false)
  })

  it('single-flight 标志阻止连续点击步骤重复生成', () => {
    const confirmFunction = pageContent.match(/async function preparePricingBomForNextStep\(\) \{[\s\S]*?\n\}/)?.[0] || ''
    assert.match(confirmFunction, /if \(effectiveBomConfirming\.value\) return/)
    assert.match(confirmFunction, /effectiveBomConfirming\.value = true[\s\S]*await prepareQuoteEffectiveBomCosting/)
    assert.match(confirmFunction, /finally[\s\S]*effectiveBomConfirming\.value = false/)
  })

  it('自动进入或刷新第 2 步只复用后端已校验为当前规则版本的草稿', () => {
    assert.equal(effectiveBomMatchesCostingBuild(
      { state: 'DRAFT', buildBatchId: 'QEB-CURRENT' },
      { buildBatchId: 'QEB-CURRENT', bomRows: [{ id: 1 }] },
    ), true)
    assert.equal(effectiveBomMatchesCostingBuild(
      { state: 'DRAFT', buildBatchId: 'QEB-OLD' },
      { buildBatchId: 'QEB-CURRENT', bomRows: [{ id: 1 }] },
    ), false)
    assert.match(pageContent, /effectiveBomMatchesCostingBuild\(effectiveBom\.value, workbench\.value\)/)
    assert.doesNotMatch(pageContent, /preparedPricingBomBuildBatchId/)
  })

  it('暂存成功后按接口构建编号核对工作台，不因 DRAFT 预览没有编号而误报失败', () => {
    const prepared = { buildBatchId: 'QEB-NEW' }
    assert.equal(costingBomMatchesPreparedBuild(prepared, {
      buildBatchId: 'QEB-NEW',
      bomRows: [{ id: 1 }],
    }), true)
    assert.equal(costingBomMatchesPreparedBuild(prepared, {
      buildBatchId: 'QEB-OLD',
      bomRows: [{ id: 1 }],
    }), false)
    assert.equal(costingBomMatchesPreparedBuild(prepared, {
      buildBatchId: 'QEB-NEW',
      bomRows: [],
    }), false)
  })

  it('发起核算自动进入第 2 步时采用当前计价树并刷新当前产品', () => {
    assert.match(pageContent, /async function beforeWorkbenchTabLeave/)
    assert.match(pageContent, /return preparePricingBomForNextStep\(\)/)
    assert.match(pageContent, /const prepared = await prepareQuoteEffectiveBomCosting\(oaNo\.value, itemId\.value\)/)
    assert.match(pageContent, /await loadWorkbench\(\{ resetTab: false, loadChildren: true \}\)/)
    assert.match(pageContent, /costingBomMatchesPreparedBuild\(prepared, workbench\.value\)/)
    assert.doesNotMatch(pageContent, /确认产品明细并生成计价 BOM/)
  })

  it('第 2 步确认明确绑定当前最终 BOM，关闭新功能时才兼容旧确认接口', () => {
    assert.match(apiContent, /confirmQuoteEffectiveBom/)
    assert.match(apiContent, /effective-bom\/confirm/)
    assert.match(pageContent, /if \(effectiveBomFeatureEnabled\.value\) \{\s+await confirmQuoteEffectiveBom/)
    assert.match(pageContent, /else \{\s+await confirmCostingBom/)
  })
})
