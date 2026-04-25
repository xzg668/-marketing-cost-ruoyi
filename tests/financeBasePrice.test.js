import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T19：新建 financeBasePrice.js 的静态契约校验。
 *
 * 断言两个导出：
 *   list(params)                        → GET  /api/v1/base-prices
 *   importInfluenceFactors(file, month) → POST /api/v1/base-prices/import-excel (multipart)
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
})
