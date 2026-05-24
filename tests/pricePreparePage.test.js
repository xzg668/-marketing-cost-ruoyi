import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/pricePrepare.js')
const PAGE_FILE = path.join(ROOT, 'src/views/cost/price-prepare/index.vue')

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('PPR-13 价格准备候选行入口', () => {
  it('API 封装候选查询和 targets 批量生成入口', () => {
    assert.match(apiContent, /fetchPricePrepareCandidates/)
    assert.match(apiContent, /\/candidates/)
    assert.match(apiContent, /generatePricePrepareBulk/)
    assert.match(apiContent, /\/generate-bulk/)
  })

  it('页面默认以候选行为主表，不再使用 OA 汇总和顶级产品两段入口', () => {
    assert.match(pageContent, /<strong>候选行<\/strong>/)
    assert.match(pageContent, /fetchPricePrepareCandidates/)
    assert.match(pageContent, /prop="topProductCode" label="成品料号"/)
    assert.match(pageContent, /@selection-change="handleCandidateSelection"/)
    assert.doesNotMatch(pageContent, /fetchPricePrepareOaSummary/)
    assert.doesNotMatch(pageContent, /fetchPricePrepareTopProductSummary/)
    assert.doesNotMatch(pageContent, /<strong>OA汇总<\/strong>/)
    assert.doesNotMatch(pageContent, /<strong>顶级产品汇总<\/strong>/)
  })

  it('生成优先提交 OA+成品 targets，粘贴 OA 作为高级兜底入口', () => {
    assert.match(pageContent, /<el-cascader/)
    assert.match(pageContent, /candidateTreeOptions/)
    assert.match(pageContent, /candidateCascaderProps/)
    assert.match(pageContent, /fetchGenerateCandidates/)
    assert.match(pageContent, /targetKeys/)
    assert.match(pageContent, /selectedTargets/)
    assert.match(pageContent, /targets:\s*targets\.length \? targets : undefined/)
    assert.match(pageContent, /高级：粘贴 OA 单号/)
    assert.match(pageContent, /oaNos:\s*targets\.length \? undefined : oaNos/)
  })
})
