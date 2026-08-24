import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { rangeTraceExplanation, rangeTraceMeta } from '../src/components/costRunTraceDrawerUtils.js'

const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunDetailPage.vue')
const DRAWER_FILE = path.resolve(import.meta.dirname, '../src/components/CostRunTraceDrawer.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/costRunDetail.js')

const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')
const drawerContent = fs.readFileSync(DRAWER_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('T10 成本一览表核算底稿抽屉', () => {
  it('详情页工具栏和金额列接入核算底稿抽屉', () => {
    assert.match(detailPageContent, /CostRunTraceDrawer/)
    assert.match(detailPageContent, />核算底稿</)
    assert.match(detailPageContent, /openTraceDrawer\(\)/)
    assert.match(detailPageContent, /openPartTrace\(item\)/)
    assert.match(detailPageContent, /openCostTrace\('DIRECT_LABOR'\)/)
    assert.match(detailPageContent, /openCostTrace\('MGMT_EXP'\)/)
    assert.match(detailPageContent, /openCostTrace\('TOTAL'\)/)
    assert.match(detailPageContent, /class="trace-link/)
    assert.match(detailPageContent, /productCode \|\| route\.query\.materialCode/)
  })

  it('上卷行显示父件和子件，底稿仍使用原始父件料号', () => {
    assert.match(detailPageContent, /displayPartName: toText\(item\.displayPartName \|\| item\.partName\)/)
    assert.match(detailPageContent, /displayPartCode: toText\(item\.displayPartCode \|\| item\.partCode\)/)
    assert.match(detailPageContent, /displayDrawingNo: toText\(item\.displayPartDrawingNo \|\| item\.partDrawingNo\)/)
    assert.match(detailPageContent, /class="part-identity">\{\{ item\.displayPartName \}\}/)
    assert.match(detailPageContent, /partCode: item\?\.partCode/)
    assert.match(detailPageContent, /wrapText: true/)
  })

  it('完整成本表不展示也不导出运费', () => {
    assert.doesNotMatch(detailPageContent, /OTHER_EXP_FREIGHT/)
    assert.doesNotMatch(detailPageContent, />运费</)
    assert.match(detailPageContent, /sheet\.spliceRows\(rowIndexAfterGap\(40\), 1\)/)
  })

  it('底稿抽屉按 costRunNo 拉列表和详情并展示通用 JSON 区块', () => {
    assert.match(drawerContent, /fetchCostRunTraces/)
    assert.match(drawerContent, /fetchCostRunTraceDetail/)
    assert.match(drawerContent, /PART_PRICE/)
    assert.match(drawerContent, /COST_ITEM/)
    assert.match(drawerContent, /TOTAL/)
    assert.match(drawerContent, /取数说明/)
    assert.match(drawerContent, /计算公式/)
    assert.match(drawerContent, /关键取值/)
    assert.match(drawerContent, /计算过程/)
    assert.match(drawerContent, /该版本未生成底稿快照/)
    assert.match(drawerContent, /findInitialTrace/)
    assert.match(drawerContent, /partItemId/)
    assert.match(drawerContent, /costItemId/)
    assert.match(drawerContent, /hasTraceSelector/)
    assert.match(drawerContent, /未找到对应底稿条目/)
  })

  it('costRunDetail API 封装底稿列表和单条详情接口', () => {
    assert.match(apiContent, /fetchCostRunTraces/)
    assert.match(apiContent, /fetchCostRunTraceDetail/)
    assert.match(apiContent, /\/api\/v1\/cost-run\/detail\/\$\{encodeURIComponent/)
    assert.match(apiContent, /\/traces\/\$\{encodeURIComponent/)
  })
})

describe('RPI1-11 区间价取价底稿和兜底原因', () => {
  const detail = {
    sourceSnapshotJson: JSON.stringify({
      rangePriceItem: {
        rangeBasis: 'FACTOR',
        factorCode: 'CU',
        supplierName: '供应商乙',
        supplierCode: 'SUP-B',
      },
      priceConclusion: {
        candidateSupplierCount: 2,
        mainSupplierName: '供应商乙',
        mainSupplierCode: 'SUP-B',
        supplyRatio: 0.7,
        supplierMatchMode: '供应商代码',
        finalPriceRowId: 9101,
        finalPriceExclTax: 0.392035,
        fallback: true,
        fallbackReason: '主供应商无价格记录',
      },
    }),
  }

  it('底稿元数据保留主供、比例、最终价格行和兜底原因', () => {
    const meta = rangeTraceMeta(detail)
    assert.equal(meta.candidateSupplierCount, 2)
    assert.equal(meta.mainSupplierCode, 'SUP-B')
    assert.equal(meta.supplyRatio, 0.7)
    assert.equal(meta.finalPriceRowId, 9101)
    assert.equal(meta.fallback, true)
    assert.equal(meta.fallbackReason, '主供应商无价格记录')
  })

  it('取数说明明确告诉报价员发生了什么兜底', () => {
    assert.match(rangeTraceExplanation(detail), /主供应商无价格记录/)
  })

  it('抽屉展示供应商代码、候选数量、供货比例和兜底原因', () => {
    assert.match(drawerContent, /供应商代码/)
    assert.match(drawerContent, /候选供应商数量/)
    assert.match(drawerContent, /供货比例/)
    assert.match(drawerContent, /是否兜底/)
    assert.match(drawerContent, /兜底原因/)
  })
})
