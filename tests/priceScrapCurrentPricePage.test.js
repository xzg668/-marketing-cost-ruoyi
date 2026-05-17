import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGE_FILE = path.join(ROOT, 'src/pages/PriceScrapPage.vue')
const API_FILE = path.join(ROOT, 'src/api/priceScrap.js')

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('T9 价格源管理-废料管理当前价 API', () => {
  it('保留 CRUD 和导入接口，并新增当前价查询端点', () => {
    assert.match(apiContent, /export const fetchScrapItems/)
    assert.match(apiContent, /export const createScrapItem/)
    assert.match(apiContent, /export const updateScrapItem/)
    assert.match(apiContent, /export const importScrapItems/)
    assert.match(apiContent, /export const fetchCurrentScrapItem/)
    assert.match(apiContent, /\/api\/v1\/price-scrap\/items\/current/)
  })
})

describe('T9 价格源管理-废料管理页面', () => {
  it('页面明确维护 CMS 回收料号当前价，不引导 A/B/C/D 或历史废料代号', () => {
    assert.match(pageContent, /CMS 回收废料当前价/)
    assert.match(pageContent, /CMS回收料号/)
    assert.match(pageContent, /当前回收单价/)
    assert.match(pageContent, /只按 CMS 回收料号取当前有效价/)
    assert.doesNotMatch(pageContent, /A\/B\/C\/D/)
    assert.doesNotMatch(pageContent, /placeholder="废紫铜"/)
    assert.doesNotMatch(pageContent, /废料代号必填/)
  })

  it('来源月份只用于追溯和筛选，不作为新增编辑必填项', () => {
    assert.match(pageContent, /label="来源月份"/)
    assert.match(pageContent, /placeholder="可选，仅追溯"/)
    assert.match(pageContent, /不参与报价期间匹配/)
    assert.doesNotMatch(pageContent, /<el-form-item label="来源月份" required>/)
    assert.doesNotMatch(pageContent, /pricingMonth:\s*getCurrentMonth\(\)/)
  })

  it('新增和编辑走同一当前价保存链路，相同 CMS 回收料号由后端 upsert', () => {
    assert.match(pageContent, /新增 CMS 回收废料当前价/)
    assert.match(pageContent, /编辑 CMS 回收废料当前价/)
    assert.match(pageContent, /createScrapItem\(body\)/)
    assert.match(pageContent, /updateScrapItem\(editingId\.value,\s*body\)/)
    assert.match(pageContent, /相同 CMS 回收料号会更新当前价/)
  })

  it('导入按 CMS 回收料号当前价解析，不处理 CMS 原材料映射导入', () => {
    assert.match(pageContent, /CMS回收料号:\s*'scrapCode'/)
    assert.match(pageContent, /CMS回收废料料号:\s*'scrapCode'/)
    assert.match(pageContent, /当前回收单价:\s*'recyclePrice'/)
    assert.match(pageContent, /importScrapItems\(\{ rows: dataRows \}\)/)
    assert.match(pageContent, /已导入\/更新/)
    assert.doesNotMatch(pageContent, /material-scrap-refs\/import/)
    assert.doesNotMatch(pageContent, /原材料对应回收废料导入/)
  })
})
