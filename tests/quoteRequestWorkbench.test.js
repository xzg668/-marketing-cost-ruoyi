import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  CALC_STATUS_OPTIONS,
  canConfirmClassification,
  filterQuoteRequestRows,
  hasNoBom,
  mergeBomStatusToDetail,
  normalizeQuoteRequestPage,
  statusLabel,
} from '../src/utils/quoteRequestWorkbench.js'

const LIST_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-requests/index.vue')
const PRODUCT_BOM_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-request-products/bom/index.vue')
const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteRequestDetailPage.vue')
const listPageContent = fs.readFileSync(LIST_PAGE_FILE, 'utf-8')
const productBomPageContent = fs.readFileSync(PRODUCT_BOM_PAGE_FILE, 'utf-8')
const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')

describe('T11 报价单接入工作台工具', () => {
  const rows = [
    {
      oaNo: 'OA-T11-001',
      processCode: 'FI-SC-020',
      quoteScenario: 'DIRECT_SALE',
      customer: '华东客户',
      classificationStatus: 'CONFIRMED',
      bomAggregateStatus: 'SYNCED',
      calcStatus: '未核算',
      calculable: true,
    },
    {
      oaNo: 'OA-T11-002',
      processCode: 'FI-SR-005',
      quoteScenario: 'UNKNOWN',
      customer: '华南客户',
      classificationStatus: 'PENDING',
      bomAggregateStatus: 'NO_BOM',
      calcStatus: '已核算',
      calculable: false,
    },
  ]

  it('状态码展示为业务中文', () => {
    assert.equal(statusLabel('quoteScenario', 'DIRECT_SALE'), '板换直销')
    assert.equal(statusLabel('classificationStatus', 'PENDING'), '待确认')
    assert.equal(statusLabel('bomStatus', 'NO_BOM'), '无 BOM')
    assert.equal(statusLabel('calcStatus', 'CALCULATED'), '已核算')
    assert.equal(statusLabel('calcStatus', 'CALCULATING'), '试算中')
    assert.equal(statusLabel('calcStatus', 'PENDING'), '未核算')
  })

  it('支持报价单号、流程、客户、场景、分类、BOM、核算状态筛选', () => {
    assert.equal(filterQuoteRequestRows(rows, { oaNo: '001' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { processCode: 'FI-SR' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { customer: '华南' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { quoteScenario: 'UNKNOWN' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { classificationStatus: 'PENDING' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { bomAggregateStatus: 'NO_BOM' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { calcStatus: '已核算' }).length, 1)
    assert.equal(filterQuoteRequestRows([{ calcStatus: 'CALCULATED' }], { calcStatus: '已核算' }).length, 1)
  })

  it('核算状态下拉只展示业务状态，不重复展示兼容状态码', () => {
    assert.deepEqual(
      CALC_STATUS_OPTIONS.map((item) => item.label),
      ['未核算', '试算中', '已核算'],
    )
    assert.equal(new Set(CALC_STATUS_OPTIONS.map((item) => item.label)).size, CALC_STATUS_OPTIONS.length)
  })

  it('操作可见性由状态驱动', () => {
    assert.equal(canConfirmClassification(rows[0]), false)
    assert.equal(canConfirmClassification(rows[1]), true)
    assert.equal(
      canConfirmClassification({
        oaNo: 'OA-LEGACY-001',
        quoteScenario: 'UNKNOWN',
        classificationStatus: 'CONFIRMED',
      }),
      false,
    )
    assert.equal(hasNoBom(rows[1]), true)
  })

  it('兼容后端 PageResult 结构', () => {
    assert.deepEqual(normalizeQuoteRequestPage({ list: rows, total: 2 }), { list: rows, total: 2 })
    assert.deepEqual(normalizeQuoteRequestPage(null), { list: [], total: 0 })
  })

  it('BOM 检查结果可回填详情产品行', () => {
    const detail = { bomAggregateStatus: 'NOT_CHECKED', items: [{ id: 10, materialNo: 'MAT-1' }] }
    const merged = mergeBomStatusToDetail(detail, {
      items: [{ oaFormItemId: 10, bomStatus: 'SYNCED', bomSource: 'U9' }],
    })
    assert.equal(merged.bomAggregateStatus, 'SYNCED')
    assert.equal(merged.items[0].bomStatus.bomSource, 'U9')
  })
})

describe('T11 报价单接入页面契约', () => {
  it('列表页串联查询、确认分类和检查 BOM，不提供成本核算入口', () => {
    assert.match(listPageContent, /fetchQuoteRequests/)
    assert.match(listPageContent, /confirmQuoteRequestClassification/)
    assert.match(listPageContent, /checkQuoteBomStatus/)
    assert.doesNotMatch(listPageContent, /goCostRun/)
    assert.doesNotMatch(listPageContent, /转到成本核算/)
    assert.doesNotMatch(listPageContent, /查看核算结果/)
    assert.doesNotMatch(listPageContent, /\/cost\/run/)
  })

  it('T16 报价单列表不再内嵌产品 BOM 处理主表', () => {
    assert.match(listPageContent, /goProductBom/)
    assert.match(listPageContent, /产品 BOM 处理/)
    assert.doesNotMatch(listPageContent, /batchSyncQuoteBomStatus/)
    assert.doesNotMatch(listPageContent, /batchCreateBomSupplementOaTasks/)
    assert.doesNotMatch(listPageContent, /type="selection"/)
  })

  it('T16 独立产品 BOM 处理页支持多选、批量同步和 OA 任务入口', () => {
    assert.match(productBomPageContent, /报价单产品 BOM 处理/)
    assert.match(productBomPageContent, /type="selection"/)
    assert.match(productBomPageContent, /batchSyncQuoteBomStatus/)
    assert.match(productBomPageContent, /batchCreateBomSupplementOaTasks/)
    assert.match(productBomPageContent, /批量同步/)
    assert.match(productBomPageContent, /批量发起OA任务/)
    assert.match(productBomPageContent, /本地 U9 全量快照/)
    assert.match(productBomPageContent, /补录任务/)
    assert.doesNotMatch(productBomPageContent, /后续 T15/)
  })

  it('详情页展示产品、费用、扩展字段、接入原文和操作记录', () => {
    assert.match(detailPageContent, /fetchQuoteRequestDetail/)
    assert.match(detailPageContent, /产品明细/)
    assert.match(detailPageContent, /额外费用/)
    assert.match(detailPageContent, /扩展字段/)
    assert.match(detailPageContent, /接入原文/)
    assert.match(detailPageContent, /操作记录/)
    assert.match(detailPageContent, /checkQuoteBomStatus/)
    assert.match(detailPageContent, /openBomTree/)
    assert.match(detailPageContent, /\/base\/bomTree/)
    assert.match(detailPageContent, /topProductCode/)
    assert.doesNotMatch(detailPageContent, /showBomPlaceholder/)
    assert.doesNotMatch(detailPageContent, /goCostRun/)
    assert.doesNotMatch(detailPageContent, /转到成本核算/)
    assert.doesNotMatch(detailPageContent, /\/cost\/run/)
  })
})
