import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/makePartPriceCalc.js')
const PAGE_FILE = path.join(ROOT, 'src/views/price/make-calc/index.vue')
const MENU_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V100__make_part_price_calc_menu.sql'
)

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const menuContent = fs.readFileSync(MENU_FILE, 'utf-8')

describe('MPPG-09 制造件价格生成 API', () => {
  it('封装查询、生成、最新批次、详情、状态汇总和导出接口', () => {
    assert.match(apiContent, /\/api\/v1\/make-part-price-calc/)
    assert.match(apiContent, /fetchMakePartPriceCalcPage/)
    assert.match(apiContent, /generateMakePartPriceCalc/)
    assert.match(apiContent, /fetchLatestMakePartPriceCalcBatch/)
    assert.match(apiContent, /fetchMakePartPriceCalcDetail/)
    assert.match(apiContent, /fetchMakePartPriceCalcStatusSummary/)
    assert.match(apiContent, /exportMakePartPriceCalc/)
  })
})

describe('MPPG-09 制造件价格生成页面', () => {
  it('提供生成、按 OA 生成、按制造件料号生成、导出、追溯和异常过滤能力', () => {
    assert.match(pageContent, /全量生成/)
    assert.match(pageContent, /按 OA 生成/)
    assert.match(pageContent, /按制造件料号生成/)
    assert.match(pageContent, /导出 Excel/)
    assert.match(pageContent, /查看计算追溯/)
    assert.match(pageContent, /filters\.onlyError/)
  })

  it('主筛选区保持简洁，低频条件折叠到高级筛选', () => {
    assert.match(pageContent, /showAdvancedFilters = ref\(false\)/)
    assert.match(pageContent, /高级筛选/)
    assert.match(pageContent, /<template v-if="showAdvancedFilters">/)
    assert.match(pageContent, /label="生成批次"/)
    assert.match(pageContent, /label="原材料料号"/)
    assert.match(pageContent, /label="回收料号"/)
  })

  it('表格列符合新口径且标明重量和价格单位', () => {
    for (const label of [
      '料号',
      '名称',
      '图号',
      '料件类型',
      '毛重\\(g\\)',
      '净重\\(g\\)',
      '零件价格',
      '原材料代码',
      '原材料/毛坯',
      '原材料价格\\(元/kg 或 元/件\\)',
      '回收代码',
      '回收名称',
      '回收单价\\(元/kg\\)',
      '委外加工费',
      '状态',
      '备注',
    ]) {
      assert.match(pageContent, new RegExp(`label="${label}"`))
    }
    assert.doesNotMatch(pageContent, /外径|壁厚|净长1|净长2/)
  })

  it('菜单挂在价格源管理并对齐后端权限码', () => {
    assert.match(menuContent, /'制造件价格生成'/)
    assert.match(menuContent, /\/price\/make-part-calc/)
    assert.match(menuContent, /'price\/make-calc\/index'/)
    assert.match(menuContent, /price:make-part-calc:list/)
    assert.match(menuContent, /price:make-part-calc:generate/)
    assert.match(menuContent, /price:make-part-calc:export/)
    assert.match(menuContent, /ON DUPLICATE KEY UPDATE/)
  })
})
