import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('QEB-14 核算工作台最终有效 BOM 接入', () => {
  it('查询和进入第 2 步的自动生成接口全部限定到当前 OA 产品行', () => {
    assert.match(apiContent, /fetchQuoteEffectiveBom/)
    assert.match(apiContent, /prepareQuoteEffectiveBomCosting/)
    assert.match(apiContent, /items\/\$\{encodePath\(itemId\)\}\/effective-bom/)
    assert.match(apiContent, /effective-bom\/prepare-costing/)
  })

  it('第 1 步只展示本次计价树、必要规则证据和替代选择', () => {
    assert.match(pageContent, /本次计价 BOM/)
    assert.match(pageContent, /计价物料树/)
    assert.match(pageContent, /effectiveBomStateInfo/)
    assert.match(pageContent, /选择计价方案/)
    assert.doesNotMatch(pageContent, /确认产品明细并生成计价 BOM/)
    assert.doesNotMatch(pageContent, />\s*重新预览\s*</)
    assert.match(pageContent, /规则：/)
    assert.match(pageContent, /effectiveSupplierText/)
    assert.doesNotMatch(pageContent, /规则自动处理/)
    assert.doesNotMatch(pageContent, /未选中的标准\/替代分支：/)
    assert.match(pageContent, /preparePricingBomForNextStep/)
  })

  it('标准替代单选先实时预览，应用前不写入当前 BOM', () => {
    assert.match(apiContent, /previewQuoteEffectiveBomAlternative/)
    assert.match(apiContent, /effective-bom\/alternative-preview/)
    assert.match(pageContent, /effectiveBomPreview/)
    assert.match(pageContent, /previewAlternativeSelection/)
    assert.match(pageContent, /预览中 · 尚未保存/)
    assert.match(pageContent, /@restore-preview="clearAlternativePreview"/)
  })

  it('标准替代可反复调整，保存后仅标记待重算，不再由确认状态锁定', () => {
    assert.match(pageContent, /按当前规则重新生成/)
    assert.match(pageContent, /workspaceStatus \|\| ''\)\.toUpperCase\(\) === 'STALE'/)
    assert.doesNotMatch(pageContent, /isBomConfirmed|effectiveBomIsReadOnly|:confirmed=/)
    assert.match(pageContent, /await refreshAfterAlternativeSelection\(\)/)
  })

  it('当前 BOM 就绪后加载价格类型，并在每次重新进入第三步时刷新只读投影', () => {
    assert.match(
      pageContent,
      /pricingBomReadyForNextStep\.value \? loadPriceType\(false\) : Promise\.resolve\(\)/,
    )
    assert.match(pageContent, /workbenchCanLoadPriceType\(workbench\.value\)/)
    const activeTabWatcher = pageContent.match(
      /watch\(activeTab, async \(tabCode\) => \{[\s\S]*?\n\}\)/,
    )?.[0] || ''
    assert.match(activeTabWatcher, /isPriceTypeTab\(tabCode\)[\s\S]*await loadPriceType\(false\)/)
    assert.doesNotMatch(activeTabWatcher, /priceType\.value\.rows/)
  })

  it('工作台没有新增价格组织或事业部选择控件', () => {
    assert.doesNotMatch(pageContent, /label="价格组织"/)
    assert.doesNotMatch(pageContent, /label="事业部"/)
    assert.doesNotMatch(pageContent, /v-model="[^\"]*priceOrg/)
  })

  it('核算工作台只保留最终有效 BOM 主链', () => {
    assert.doesNotMatch(pageContent, /effectiveBomEnabled|effectiveBomFeatureEnabled/)
    assert.doesNotMatch(pageContent, /getBomHierarchy|旧版原始 BOM|最终有效 BOM 当前未启用/)
    assert.match(pageContent, /function beforeWorkbenchTabLeave\(\)[\s\S]*return true/)
    assert.match(pageContent, /await loadEffectiveBom\(\)/)
  })
})
