import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  costingBomMatchesPreparedBuild,
  effectiveBomCanPrepare,
  workbenchCanLoadPriceType,
  workbenchHasCurrentCostingBom,
} from '../src/utils/quoteEffectiveBom.js'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('本次计价 BOM 进入第 2 步', () => {
  it('只有无阻断且至少有一个节点的草稿可以自动生成报价物料明细', () => {
    assert.equal(effectiveBomCanPrepare({ state: 'DRAFT', nodes: [{ nodeKey: 'P' }] }), true)
    assert.equal(effectiveBomCanPrepare({ state: 'DRAFT', nodes: [] }), false)
    assert.equal(effectiveBomCanPrepare({ state: 'DRAFT', nodes: [{ nodeKey: 'P' }], blockIssues: [{}] }), false)
    assert.equal(effectiveBomCanPrepare({ state: 'BLOCKED', nodes: [{ nodeKey: 'P' }] }), false)
  })

  it('single-flight 标志阻止连续点击步骤重复生成', () => {
    const prepareFunction = pageContent.match(/async function preparePricingBomForNextStep\(force = false\) \{[\s\S]*?\n\}/)?.[0] || ''
    assert.match(prepareFunction, /if \(effectiveBomPreparing\.value\) return false/)
    assert.match(prepareFunction, /effectiveBomPreparing\.value = true[\s\S]*await prepareQuoteEffectiveBomCosting/)
    assert.match(prepareFunction, /finally[\s\S]*effectiveBomPreparing\.value = false/)
  })

  it('返回重进或刷新第 2 步只复用工作区指针匹配的当前 BOM', () => {
    assert.equal(workbenchHasCurrentCostingBom({
      buildBatchId: 'QEB-CURRENT',
      costingWorkspace: { currentBomBuildBatchId: 'QEB-CURRENT' },
      bomRows: [{ id: 1 }],
    }), true)
    assert.equal(workbenchHasCurrentCostingBom({
      buildBatchId: 'QEB-OLD',
      costingWorkspace: { currentBomBuildBatchId: 'QEB-CURRENT' },
      bomRows: [{ id: 1 }],
    }), false)
    assert.equal(workbenchHasCurrentCostingBom({
      buildBatchId: 'QEB-CURRENT',
      costingWorkspace: { currentBomBuildBatchId: 'QEB-CURRENT' },
      bomRows: [],
    }), false)
    assert.doesNotMatch(pageContent, /effectiveBomMatchesCostingBuild/)
    assert.doesNotMatch(pageContent, /preparedPricingBomBuildBatchId/)
  })

  it('第三步优先使用工作区指针，旧 worker 漏指针时可用实时识别的同批次证据加载树', () => {
    assert.equal(workbenchCanLoadPriceType({
      buildBatchId: 'QEB-CURRENT',
      costingWorkspace: { workspaceStatus: 'BOM_READY', currentBomBuildBatchId: 'QEB-CURRENT' },
      bomRows: [{ id: 1 }],
    }), true)
    assert.equal(workbenchCanLoadPriceType({
      buildBatchId: 'qbp-LEGACY',
      costingWorkspace: { workspaceStatus: 'WAIT_PRICE', currentBomBuildBatchId: null },
      workflowStatus: { quoteBomStatus: 'DONE' },
      latestPriceTypeRecognition: { bomBuildBatchId: 'qbp-LEGACY' },
      bomRows: [{ id: 1 }],
    }), true)
    assert.equal(workbenchCanLoadPriceType({
      buildBatchId: 'qbp-OLD',
      costingWorkspace: { workspaceStatus: 'WAIT_PRICE', currentBomBuildBatchId: null },
      workflowStatus: { quoteBomStatus: 'DONE' },
      latestPriceTypeRecognition: { bomBuildBatchId: 'qbp-CURRENT' },
      bomRows: [{ id: 1 }],
    }), false)
    assert.equal(workbenchCanLoadPriceType({
      buildBatchId: 'QEB-CURRENT',
      costingWorkspace: { workspaceStatus: 'STALE', currentBomBuildBatchId: 'QEB-CURRENT' },
      bomRows: [{ id: 1 }],
    }), false)
    assert.match(pageContent, /workbenchCanLoadPriceType\(workbench\.value\)/)
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

  it('切换页签不隐式重建，只有明确点击重算才生成并刷新当前产品', () => {
    assert.match(pageContent, /function beforeWorkbenchTabLeave\(\)[\s\S]*return true/)
    assert.doesNotMatch(pageContent, /beforeWorkbenchTabLeave[\s\S]{0,500}preparePricingBomForNextStep/)
    assert.match(pageContent, /@click="regenerateCurrentBom"/)
    assert.match(pageContent, /preparePricingBomForNextStep\(true\)/)
    assert.match(pageContent, /const prepared = await prepareQuoteEffectiveBomCosting\(oaNo\.value, itemId\.value\)/)
    assert.match(pageContent, /await loadWorkbench\(\{ resetTab: false, loadChildren: true \}\)/)
    assert.match(pageContent, /costingBomMatchesPreparedBuild\(prepared, workbench\.value\)/)
    assert.doesNotMatch(pageContent, /确认产品明细并生成计价 BOM/)
  })

  it('只保留生成当前报价物料接口，不再保留确认和撤销确认接口', () => {
    assert.match(apiContent, /prepareQuoteEffectiveBomCosting/)
    assert.match(apiContent, /effective-bom\/prepare-costing/)
    assert.doesNotMatch(apiContent, /confirmQuoteEffectiveBom|confirmCostingBom|cancelCostingBomConfirm/)
    assert.doesNotMatch(pageContent, /确认报价物料明细|撤销确认/)
  })
})
