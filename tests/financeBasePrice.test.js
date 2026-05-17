import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T19：新建 financeBasePrice.js 的静态契约校验。
 *
 * 断言旧兼容导出 + V4 影响因素事实源导出：
 *   list(params)                         → GET /api/v1/base-prices
 *   importInfluenceFactors(file, month)  → POST /api/v1/base-prices/import-excel
 *   fetchFactorImportBatches(params)     → GET /api/v1/price-linked/factors/import-batches，404 时兼容旧 import-history
 *   fetchFactorImportBatchDetail(id)     → GET /api/v1/price-linked/factors/import-batches/{id}，404 时兼容旧 import-history/{id}
 *   adjustFactorMonthlyPrice(id, body)   → PATCH /api/v1/price-linked/factors/monthly-prices/{id}/adjust
 *   fetchFactorMonthlyPriceChangeLogs(id)→ GET /api/v1/price-linked/factors/monthly-prices/{id}/change-logs
 *   fetchFactorLinkedItems(id, params)   → GET /api/v1/factor-identities/{id}/linked-items
 *   fetchFactorMonthlyPrices(params)     → GET /api/v1/price-linked/factor-adjust/monthly-prices
 *   fetchFactorAdjustBatches(params)     → GET /api/v1/price-linked/factor-adjust/batches
 *   fetchFactorAdjustPrices(params)      → GET /api/v1/price-linked/factor-adjust/prices
 *   exportFactorAdjustTemplate(params)   → GET /api/v1/price-linked/factor-adjust/export-template
 *   importFactorAdjustExcel(file, opts)  → POST /api/v1/price-linked/factor-adjust/import
 */
const FILE = path.resolve(import.meta.dirname, '../src/api/financeBasePrice.js')
const content = fs.readFileSync(FILE, 'utf-8')

describe('financeBasePrice.js', () => {
  it('文件存在且从 http 模块导入 request', () => {
    assert.match(content, /import\s*\{\s*request\s*\}\s*from\s*['"]\.\/http['"]/)
  })

  it('导出 list(params) 并指向 /api/v1/base-prices', () => {
    assert.match(content, /export\s+const\s+list\b/)
    assert.match(content, /list\s*=\s*\(params\)[\s\S]{0,120}\/api\/v1\/base-prices/)
  })

  it('导出 importInfluenceFactors 并使用 FormData', () => {
    assert.match(content, /export\s+const\s+importInfluenceFactors\b/)
    assert.match(content, /new FormData\(\)/)
    assert.match(content, /append\(['"]file['"]\s*,\s*file\)/)
    assert.match(content, /append\(['"]priceMonth['"]\s*,\s*priceMonth\)/)
  })

  it('POST 到 /api/v1/base-prices/import-excel', () => {
    assert.match(content, /\/api\/v1\/base-prices\/import-excel/)
    assert.match(content, /method:\s*['"]POST['"]/)
  })

  it('导出 V4 影响因素导入批次列表接口', () => {
    assert.match(content, /export\s+const\s+fetchFactorImportBatches\b/)
    assert.match(content, /\/api\/v1\/price-linked\/factors\/import-batches/)
    assert.match(content, /\/api\/v1\/price-linked\/items\/import-history/)
  })

  it('导出 V4 影响因素导入批次明细接口', () => {
    assert.match(content, /export\s+const\s+fetchFactorImportBatchDetail\b/)
    assert.match(
      content,
      /\/api\/v1\/price-linked\/factors\/import-batches\/\$\{batchId\}/
    )
    assert.match(
      content,
      /\/api\/v1\/price-linked\/items\/import-history\/\$\{batchId\}/
    )
  })

  it('影响因素批次接口支持 404 时回退旧持久化接口', () => {
    assert.match(content, /requestWithFactorEndpointFallback/)
    assert.match(content, /资源不存在/)
    assert.match(content, /isNotFound/)
  })

  it('导出 V4-06 影响因素调价和日志接口', () => {
    assert.match(content, /export\s+const\s+adjustFactorMonthlyPrice\b/)
    assert.match(content, /method:\s*['"]PATCH['"]/)
    assert.match(
      content,
      /\/api\/v1\/price-linked\/factors\/monthly-prices\/\$\{factorMonthlyPriceId\}\/adjust/
    )
    assert.match(content, /export\s+const\s+fetchFactorMonthlyPriceChangeLogs\b/)
    assert.match(
      content,
      /\/api\/v1\/price-linked\/factors\/monthly-prices\/\$\{factorMonthlyPriceId\}\/change-logs/
    )
  })

  it('导出 V4-07 影响因素引用联动价反查接口', () => {
    assert.match(content, /export\s+const\s+fetchFactorLinkedItems\b/)
    assert.match(
      content,
      /\/api\/v1\/factor-identities\/\$\{factorIdentityId\}\/linked-items/
    )
    assert.match(content, /params/)
  })

  it('导出 V5-09 月度调价列表、批次和明细接口', () => {
    assert.match(content, /export\s+const\s+fetchFactorMonthlyPrices\b/)
    assert.match(content, /\/api\/v1\/price-linked\/factor-adjust\/monthly-prices/)
    assert.match(content, /export\s+const\s+fetchFactorAdjustBatches\b/)
    assert.match(content, /\/api\/v1\/price-linked\/factor-adjust\/batches/)
    assert.match(content, /export\s+const\s+fetchFactorAdjustPrices\b/)
    assert.match(content, /\/api\/v1\/price-linked\/factor-adjust\/prices/)
  })

  it('导出 V5-09 调价模板下载和调价 Excel 导入接口', () => {
    assert.match(content, /export\s+const\s+exportFactorAdjustTemplate\b/)
    assert.match(content, /content-disposition/)
    assert.match(content, /factor-adjust-template-/)
    assert.match(content, /export\s+const\s+importFactorAdjustExcel\b/)
    assert.match(content, /append\(['"]usageScope['"]\s*,\s*options\.usageScope\)/)
    assert.match(content, /\/api\/v1\/price-linked\/factor-adjust\/import/)
    assert.match(content, /method:\s*['"]POST['"]/)
  })
})
