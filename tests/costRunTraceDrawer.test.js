import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { formatTraceMoney, formatTraceValue, rangeTraceExplanation, rangeTraceMeta } from '../src/components/costRunTraceDrawerUtils.js'

const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunDetailPage.vue')
const DRAWER_FILE = path.resolve(import.meta.dirname, '../src/components/CostRunTraceDrawer.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/costRunDetail.js')

const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')
const drawerContent = fs.readFileSync(DRAWER_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('T10 成本一览表核算底稿抽屉', () => {
  it('保存金额的十进制文本不丢精度，空白与明确零分开', () => {
    assert.equal(formatTraceMoney('999999999999.999999'), '999999999999.999999')
    assert.equal(formatTraceMoney('999999999999.99999900'), '999999999999.999999')
    assert.equal(formatTraceMoney('1.234567'), '1.234567')
    assert.equal(formatTraceMoney('10.000000'), '10')
    assert.equal(formatTraceMoney('0.000000'), '0')
    assert.equal(formatTraceMoney(null), '-')
    const variables = JSON.parse('{"amount":"999999999999.999999","source":"PROFILE"}')
    assert.equal(formatTraceValue(variables.amount), '999999999999.999999')
    assert.equal(formatTraceValue(variables.source), 'PROFILE')
    assert.equal(formatTraceValue('0.00000000'), '0')
    assert.equal(formatTraceValue(null), '-')
  })
  it('详情页工具栏和金额列接入核算底稿抽屉', () => {
    assert.match(detailPageContent, /CostRunTraceDrawer/)
    assert.match(detailPageContent, />核算底稿</)
    assert.match(detailPageContent, /openTraceDrawer\(\)/)
    assert.match(detailPageContent, /<JjbSheet[^>]+@trace="openSheetTrace"/)
    assert.match(detailPageContent, /rowKey: row.key/)
    assert.match(detailPageContent, /partItemId: row.partItemIds/)
    assert.match(detailPageContent, /costItemId: row.costItemIds/)
    assert.match(detailPageContent, /productCode \|\| route\.query\.materialCode/)
  })

  it('共用展示模型把保存行身份传到底稿，显示名称不改变定位', () => {
    const body = detailPageContent.match(/function openSheetTrace\(row\) \{([\s\S]*?)\n\}/)[1]
    let selected
    const open = new Function('row', 'openTraceDrawer', body)
    open({ key: 'saved-part-17', code: '显示子件', name: '父件 / 子件', partItemIds: [17], costItemIds: [21] }, value => { selected = value })
    assert.deepEqual(selected, { rowKey: 'saved-part-17', partItemId: 17, costItemId: 21, costCode: '显示子件' })
  })

  it('完整成本表不展示也不导出运费', () => {
    assert.doesNotMatch(detailPageContent, /OTHER_EXP_FREIGHT/)
    assert.doesNotMatch(detailPageContent, />运费</)
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
