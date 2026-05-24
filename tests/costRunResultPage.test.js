import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunResultPage.vue')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('成本试算结果页', () => {
  it('展示价格准备前置校验提示', () => {
    assert.match(pageContent, /pricePrepareMessage/)
    assert.match(pageContent, /class="price-prepare-alert"/)
    assert.match(pageContent, /syncProgressMessage/)
  })
})
