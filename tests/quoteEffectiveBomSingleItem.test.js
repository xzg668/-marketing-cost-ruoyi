import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('QEB-14 OA 多产品隔离', () => {
  it('所有最终树动作都使用路由中的当前 itemId', () => {
    assert.match(pageContent, /const itemId = computed\(\(\) => String\(route\.params\.itemId/)
    assert.match(pageContent, /fetchQuoteEffectiveBom\(oaNo\.value, itemId\.value\)/)
    assert.match(pageContent, /prepareQuoteEffectiveBomCosting\(oaNo\.value, itemId\.value\)/)
    assert.match(pageContent, /selectQuoteBomAlternative\(\s*oaNo\.value,\s*itemId\.value/)
  })

  it('接口不接受产品数组，不会因 OA 有 100 个产品批量重建或确认', () => {
    const effectiveApiBlock = apiContent.slice(
      apiContent.indexOf('export const fetchQuoteEffectiveBom'),
      apiContent.indexOf('export const fetchQuoteBomAlternativeGroups'),
    )
    assert.doesNotMatch(effectiveApiBlock, /itemIds|productCodes|Promise\.all|forEach/)
    assert.match(effectiveApiBlock, /items\/\$\{encodePath\(itemId\)\}/)
  })
})
