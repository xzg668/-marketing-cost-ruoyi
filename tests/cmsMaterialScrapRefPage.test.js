import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/cmsMaterialScrapRef.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/CmsMaterialScrapRefPage.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V70__cms_material_scrap_ref_menu.sql'
)
const MENU_REPAIR_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V71__cms_material_scrap_ref_menu_repair.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuContent = [
  fs.readFileSync(MENU_FILE, 'utf-8'),
  fs.readFileSync(MENU_REPAIR_FILE, 'utf-8'),
].join('\n')

describe('T8 CMS 原材料对应回收废料 API', () => {
  it('只封装 CMS 映射导入和当前有效映射查询', () => {
    assert.match(apiContent, /\/api\/v1\/cms-cost\/material-scrap-refs/)
    assert.match(apiContent, /export const importCmsMaterialScrapRefExcel/)
    assert.match(apiContent, /\/import/)
    assert.match(apiContent, /export const fetchCmsMaterialScrapRefsCurrent/)
    assert.match(apiContent, /\/current/)
    assert.doesNotMatch(apiContent, /fetchCmsMaterialScrapRefsRaw/)
    assert.doesNotMatch(apiContent, /\/raw/)
    assert.doesNotMatch(apiContent, /fetchCmsMaterialScrapRefImportRecords/)
    assert.doesNotMatch(apiContent, /\/import-records/)
    assert.doesNotMatch(apiContent, /fetchCmsMaterialScrapMissingPrices/)
    assert.doesNotMatch(apiContent, /\/missing-prices/)
    assert.doesNotMatch(apiContent, /fetchCmsMaterialScrapMultiRefs/)
    assert.doesNotMatch(apiContent, /\/multi-scrap/)
    assert.doesNotMatch(apiContent, /normalizeCmsMaterialScrapRefImportResult/)
  })
})

describe('T8 CMS 原材料对应回收废料页面', () => {
  it('挂在 CMS 成本数据页面壳下，只面向业务展示当前有效映射', () => {
    assert.match(pageContent, /CmsCostPageShell/)
    assert.doesNotMatch(pageContent, /trace-nav/)
    assert.match(pageContent, /当前有效映射/)
    assert.doesNotMatch(pageContent, /el-tabs/)
    assert.doesNotMatch(pageContent, /原始数据/)
    assert.doesNotMatch(pageContent, /导入\/同步记录/)
    assert.doesNotMatch(pageContent, /缺价检查/)
    assert.doesNotMatch(pageContent, /多废料映射/)
  })

  it('页面文案区分回收废料映射和废料回收价职责', () => {
    assert.match(pageContent, /Excel 导入 CMS 原材料与回收废料映射/)
    assert.match(pageContent, /后续 CMS 自动同步也会沉淀为当前有效映射/)
    assert.match(pageContent, /废料回收价仍在价格源管理维护/)
    assert.match(pageContent, /选择映射 Excel/)
    assert.match(pageContent, /导入映射/)
    assert.doesNotMatch(pageContent, /试导入/)
    assert.doesNotMatch(pageContent, /试运行/)
    assert.doesNotMatch(pageContent, /最近导入结果/)
    assert.doesNotMatch(pageContent, /原始行/)
    assert.doesNotMatch(pageContent, /A\/B\/C\/D/)
  })

  it('当前有效映射表展示样例数据所需字段', () => {
    assert.match(pageContent, /prop="materialCode" label="原材料料号"/)
    assert.match(pageContent, /prop="scrapCode" label="CMS回收废料料号"/)
    assert.match(pageContent, /prop="cmsPostingPeriod" label="CMS期间"/)
    assert.match(pageContent, /prop="cmsEffectiveDate" label="生效日期"/)
    assert.doesNotMatch(pageContent, /label="原始行ID"/)
  })

  it('菜单入口留在 CMS 成本数据页面，排查接口不暴露为业务页签', () => {
    assert.doesNotMatch(pageContent, /fetchCmsMaterialScrapMissingPrices/)
    assert.doesNotMatch(pageContent, /fetchCmsMaterialScrapMultiRefs/)
    assert.match(menuContent, /40420,\s*'CMS 回收废料映射',\s*40230/)
    assert.match(menuContent, /\/base\/cms-cost\/material-scrap-refs/)
    assert.doesNotMatch(menuContent, /\/price\//)
    assert.match(menuContent, /'pages:CmsMaterialScrapRefPage'/)
    assert.match(menuContent, /WHERE menu_id IN \(40230,\s*40231,\s*40237,\s*40239\)/)
  })
})
