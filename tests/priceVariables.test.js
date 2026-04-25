import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T19：priceVariables.js 的静态契约校验 —— 增补 fetchCatalog（T15 后端目录接口）。
 */
const FILE = path.resolve(import.meta.dirname, '../src/api/priceVariables.js')
const content = fs.readFileSync(FILE, 'utf-8')

describe('priceVariables.js', () => {
  it('保留 fetchPriceVariables', () => {
    assert.match(content, /export\s+const\s+fetchPriceVariables\b/)
  })

  it('新增 fetchCatalog 并指向 /variables/catalog', () => {
    assert.match(content, /export\s+const\s+fetchCatalog\b/)
    assert.match(content, /\/variables\/catalog/)
  })

  it('fetchCatalog 不带 params（GET 无查询参数）', () => {
    // 允许 request('<url>') 或 request('<url>', {...}) 但不应出现 params:
    const match = content.match(/fetchCatalog\s*=\s*\(\)\s*=>[\s\S]*?\)\s*$/m)
    assert.ok(match, '应有 fetchCatalog 箭头函数体')
    assert.ok(!/fetchCatalog[\s\S]*?params:/.test(content), 'fetchCatalog 不应带 params')
  })
})
