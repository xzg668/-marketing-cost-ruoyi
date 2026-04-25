import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * T19：priceLinkedItems.js 的静态契约校验。
 *
 * 断言扩展后的 API client 含新增的三个接口：
 *   previewFormula(body)          → POST /formula/preview（T14）
 *   importLinkedItemsExcel(file,.)→ POST /items/import-excel（T18，multipart）
 *   fetchTrace(id)                → GET /items/:id/trace（T16；T24 校正路径，后端 controller 实际挂 /items/{id}/trace）
 */
const FILE = path.resolve(import.meta.dirname, '../src/api/priceLinkedItems.js')
const content = fs.readFileSync(FILE, 'utf-8')

describe('priceLinkedItems.js 原有接口保留', () => {
  it('fetchLinkedItems / createLinkedItem / updateLinkedItem / deleteLinkedItem 都导出', () => {
    for (const name of ['fetchLinkedItems', 'createLinkedItem', 'updateLinkedItem', 'deleteLinkedItem']) {
      assert.match(content, new RegExp(`export\\s+const\\s+${name}\\b`), `缺少 ${name}`)
    }
  })
})

describe('previewFormula (T14)', () => {
  it('导出 previewFormula 函数', () => {
    assert.match(content, /export\s+const\s+previewFormula\b/)
  })
  it('POST 到 /formula/preview', () => {
    assert.match(content, /previewFormula[\s\S]{0,120}\/formula\/preview/)
    assert.match(content, /previewFormula[\s\S]{0,200}method:\s*['"]POST['"]/)
  })
})

describe('importLinkedItemsExcel (T18)', () => {
  it('导出 importLinkedItemsExcel 函数', () => {
    assert.match(content, /export\s+const\s+importLinkedItemsExcel\b/)
  })
  it('使用 FormData 封装 file + pricingMonth', () => {
    assert.match(content, /new FormData\(\)/)
    assert.match(content, /append\(['"]file['"]\s*,\s*file\)/)
    assert.match(content, /append\(['"]pricingMonth['"]\s*,\s*pricingMonth\)/)
  })
  it('POST 到 /items/import-excel', () => {
    assert.match(content, /\/items\/import-excel/)
  })
})

describe('fetchTrace (T16)', () => {
  it('导出 fetchTrace 函数', () => {
    assert.match(content, /export\s+const\s+fetchTrace\b/)
  })
  it('GET 到 /items/:id/trace（不含 /calc/ 前缀）', () => {
    // 后端 controller 基址 /api/v1/price-linked + @GetMapping("/items/{id}/trace")
    assert.match(content, /\/items\/\$\{id\}\/trace/)
    assert.ok(
      !/\/calc\/items\/\$\{id\}\/trace/.test(content),
      'fetchTrace 不应走 /calc/items/.../trace —— 后端没有这条路径'
    )
  })
})
