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
  it('API 保留历史查询，移除无产品身份的生成调用', () => {
    assert.match(apiContent, /fetchPricePrepareCandidates/)
    assert.match(apiContent, /\/candidates/)
    assert.doesNotMatch(apiContent, /generatePricePrepare|\/generate-bulk/)
  })

  it('页面默认以候选行为主表，不再使用 OA 汇总和顶级产品两段入口', () => {
    assert.match(pageContent, /<strong>候选行<\/strong>/)
    assert.match(pageContent, /fetchPricePrepareCandidates/)
    assert.match(pageContent, /prop="topProductCode" label="成品料号"/)
    assert.match(pageContent, /@row-click="selectCandidate"/)
    assert.doesNotMatch(pageContent, /fetchPricePrepareOaSummary/)
    assert.doesNotMatch(pageContent, /fetchPricePrepareTopProductSummary/)
    assert.doesNotMatch(pageContent, /<strong>OA汇总<\/strong>/)
    assert.doesNotMatch(pageContent, /<strong>顶级产品汇总<\/strong>/)
  })

  it('有全量权限的账号默认查询全部候选，避免进入页面被我的候选空关键词过滤为空', () => {
    assert.match(pageContent, /const defaultOwnerScope = \(\) => \(hasPermission\('cost:price-prepare:list-all'\) \? 'ALL' : 'MINE'\)/)
    assert.match(pageContent, /ownerScope: defaultOwnerScope\(\)/)
  })

  it('默认不限定核算状态，已核算 OA 的历史价格准备也能查出来', () => {
    assert.match(pageContent, /placeholder="全部状态"/)
    assert.match(pageContent, /calcStatus: '',/)
    assert.doesNotMatch(pageContent, /calcStatus: '未核算'/)
    assert.doesNotMatch(pageContent, /默认未核算/)
  })

  it('仅从选中记录打开原报价单，不保留 OA 粘贴/批量生成入口', () => {
    assert.match(pageContent, /打开报价单/)
    assert.match(pageContent, /@click="openQuotation"/)
    assert.match(pageContent, /:disabled="!selectedCandidate"/)
    assert.doesNotMatch(pageContent, /generatePricePrepare|submitGenerate|generateDialogVisible|oaNosText/)
  })

  it('查询使用当前月，选中历史记录保留该记录月份', () => {
    assert.match(pageContent, /const currentMonthText = \(\) =>/)
    assert.match(pageContent, /periodMonth: currentMonthText\(\),/)
    assert.match(pageContent, /periodMonth: selectedCandidate\.value\?\.periodMonth \|\| currentMonthText\(\),/)
  })

  it('NSC-05：缺废料映射行提供可审计处理动作', () => {
    assert.match(apiContent, /MISSING_SCRAP_MAPPING/)
    assert.match(pageContent, /displayGapTypeLabel\(row\)/)
    assert.match(pageContent, /补充废料映射/)
    assert.match(pageContent, /确认无废料，按0处理/)
    assert.match(pageContent, /确认状态/)
    assert.match(pageContent, /noScrapConfirmationLabel/)
    assert.match(pageContent, /confirmPricePrepareNoScrap/)
  })
})
