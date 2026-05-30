import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  CALC_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  OA_TODO_PUSH_STATUS_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  canConfirmClassification,
  filterQuoteRequestRows,
  hasNoBom,
  isCostReadyBomStatus,
  mergeBomStatusToDetail,
  normalizeQuoteRequestPage,
  statusLabel,
  statusTagType,
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
      sourceType: 'EXCEL',
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
      sourceType: 'WEAVER_OA',
      customer: '华南客户',
      classificationStatus: 'PENDING',
      bomAggregateStatus: 'NO_BOM',
      calcStatus: '已核算',
      calculable: false,
    },
  ]

  it('状态码展示为业务中文', () => {
    assert.equal(statusLabel('quoteScenario', 'DIRECT_SALE'), '板换直销')
    assert.equal(statusLabel('sourceType', 'EXCEL'), 'Excel 导入')
    assert.equal(statusLabel('sourceType', 'WEAVER_OA'), '泛微 OA')
    assert.equal(statusLabel('classificationStatus', 'PENDING'), '待确认')
    assert.equal(statusLabel('bomStatus', 'NO_BOM'), '无 BOM')
    assert.equal(statusLabel('bomStatus', 'REUSED_CURRENT_MONTH'), '已沿用')
    assert.equal(statusLabel('bomStatus', 'SYNCING'), '同步中')
    assert.equal(statusLabel('productType', 'BARE'), '裸品')
    assert.equal(statusLabel('reviewStatus', 'APPROVED'), '已通过')
    assert.equal(statusTagType('bomStatus', 'REUSED_CURRENT_MONTH'), 'success')
    assert.equal(statusTagType('bomStatus', 'SYNCING'), 'warning')
    assert.equal(statusTagType('productType', 'BARE'), 'warning')
    assert.equal(statusTagType('reviewStatus', 'APPROVED'), 'success')
    assert.equal(statusLabel('calcStatus', 'CALCULATED'), '已核算')
    assert.equal(statusLabel('calcStatus', 'CALCULATING'), '试算中')
    assert.equal(statusLabel('calcStatus', 'PENDING'), '未核算')
  })

  it('支持报价单号、流程、来源、客户、场景、分类、BOM、核算状态筛选', () => {
    assert.equal(filterQuoteRequestRows(rows, { oaNo: '001' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { processCode: 'FI-SR' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { sourceType: 'WEAVER_OA' }).length, 1)
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

  it('来源类型支持区分 Excel 和未来泛微 OA', () => {
    assert.deepEqual(
      SOURCE_TYPE_OPTIONS.map((item) => item.value).slice(0, 2),
      ['EXCEL', 'WEAVER_OA'],
    )
  })

  it('报价产品 BOM 准备筛选枚举覆盖产品形态和财务审核', () => {
    assert.deepEqual(PRODUCT_TYPE_OPTIONS.map((item) => item.value), ['NON_BARE', 'BARE', 'UNKNOWN'])
    assert.ok(REVIEW_STATUS_OPTIONS.some((item) => item.value === 'APPROVED' && item.label === '已通过'))
    assert.ok(OA_TODO_PUSH_STATUS_OPTIONS.some((item) => item.value === 'FAILED' && item.label === '推送失败'))
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

  it('已沿用参与 BOM 聚合和可核算判断，同步中不可核算', () => {
    const reused = mergeBomStatusToDetail({ items: [{ id: 11 }, { id: 12 }] }, {
      items: [
        { oaFormItemId: 11, bomStatus: 'REUSED_CURRENT_MONTH' },
        { oaFormItemId: 12, bomStatus: 'MANUAL_ENTERED' },
      ],
    })
    const syncing = mergeBomStatusToDetail({ items: [{ id: 13 }] }, {
      items: [{ oaFormItemId: 13, bomStatus: 'SYNCING' }],
    })

    assert.equal(reused.bomAggregateStatus, 'SYNCED')
    assert.equal(syncing.bomAggregateStatus, 'SYNCING')
    assert.equal(isCostReadyBomStatus('REUSED_CURRENT_MONTH'), true)
    assert.equal(isCostReadyBomStatus('ENTRY_PENDING'), false)
    assert.equal(isCostReadyBomStatus('EXPIRED'), false)
    assert.equal(isCostReadyBomStatus('SYNCING'), false)
  })
})

describe('T11 报价单接入页面契约', () => {
  it('列表页串联查询、确认分类和检查 BOM，不提供成本核算入口', () => {
    assert.match(listPageContent, /fetchQuoteRequests/)
    assert.match(listPageContent, /confirmQuoteRequestClassification/)
    assert.match(listPageContent, /checkQuoteBomStatus/)
    assert.match(listPageContent, /来源类型/)
    assert.match(listPageContent, /申请单位/)
    assert.match(listPageContent, /申请部门/)
    assert.match(listPageContent, /申请处室/)
    assert.match(listPageContent, /接入时间/)
    assert.doesNotMatch(listPageContent, /goCostRun/)
    assert.doesNotMatch(listPageContent, /转到成本核算/)
    assert.doesNotMatch(listPageContent, /查看核算结果/)
    assert.doesNotMatch(listPageContent, /\/cost\/run/)
  })

  it('T16 报价单列表不再内嵌产品 BOM 处理主表', () => {
    assert.match(listPageContent, /goProductBom/)
    assert.match(listPageContent, /产品 BOM 准备/)
    assert.doesNotMatch(listPageContent, /batchSyncQuoteBomStatus/)
    assert.doesNotMatch(listPageContent, /batchCreateBomSupplementOaTasks/)
    assert.doesNotMatch(listPageContent, /type="selection"/)
  })

  it('T16 独立产品 BOM 处理页支持多选、批量同步和 OA 任务入口', () => {
    const quoteIngestApiContent = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/api/quoteIngest.js'),
      'utf-8',
    )
    assert.match(productBomPageContent, /报价产品 BOM 准备/)
    assert.match(productBomPageContent, /type="selection"/)
    assert.match(productBomPageContent, /fetchQuoteProductBomPage/)
    assert.match(productBomPageContent, /batchPrepareQuoteProductBom/)
    assert.match(productBomPageContent, /createQuoteProductBomTasks/)
    assert.match(productBomPageContent, /pushQuoteProductBomOaTodo/)
    assert.match(productBomPageContent, /fetchQuoteProductBomPreparationPreview/)
    assert.match(productBomPageContent, /buildQuoteProductBomCostingRows/)
    assert.match(productBomPageContent, /批量检查\/准备/)
    assert.match(productBomPageContent, /批量推送 OA 待办/)
    assert.match(productBomPageContent, /裸品\/非裸品/)
    assert.match(productBomPageContent, /本体 BOM/)
    assert.match(productBomPageContent, /包装参考/)
    assert.match(productBomPageContent, /财务审核/)
    assert.match(productBomPageContent, /OA待办/)
    assert.match(productBomPageContent, /推送状态/)
    assert.match(productBomPageContent, /推送失败原因/)
    assert.match(productBomPageContent, /完整预览/)
    assert.match(productBomPageContent, /重新生成结算行/)
    assert.match(quoteIngestApiContent, /\/api\/v1\/quote-product-bom-preparation\/batch-prepare/)
    assert.match(quoteIngestApiContent, /\/oa-todo\/push/)
    assert.match(quoteIngestApiContent, /fetchQuoteProductBomPreparationPreview[\s\S]*\/preview/)
    assert.match(quoteIngestApiContent, /\/build-costing-rows/)
    assert.match(productBomPageContent, /包装方式/)
    assert.match(productBomPageContent, /缺口说明/)
    assert.doesNotMatch(productBomPageContent, /fetchQuoteRequestDetail/)
    assert.doesNotMatch(productBomPageContent, /fetchQuoteRequests/)
    assert.doesNotMatch(productBomPageContent, /batchCreateBomSupplementOaTasks/)
    assert.doesNotMatch(productBomPageContent, /OA任务已发起/)
    assert.doesNotMatch(productBomPageContent, /批量发起OA任务/)
    assert.doesNotMatch(productBomPageContent, /后续 T15/)
  })

  it('详情页展示基础业务信息、产品、费用、扩展字段、核算维度和接入记录', () => {
    assert.match(detailPageContent, /fetchQuoteRequestDetail/)
    assert.match(detailPageContent, /申请单位/)
    assert.match(detailPageContent, /申请部门/)
    assert.match(detailPageContent, /申请处室/)
    assert.match(detailPageContent, /产品明细/)
    assert.match(detailPageContent, /包装类型/)
    assert.match(detailPageContent, /额外费用/)
    assert.match(detailPageContent, /费用粒度/)
    assert.match(detailPageContent, /核算维度/)
    assert.match(detailPageContent, /accountingPeriodMonth/)
    assert.match(detailPageContent, /expenseProductCategory/)
    assert.match(detailPageContent, /sourceCompany/)
    assert.match(detailPageContent, /sourceBusinessDivision/)
    assert.match(detailPageContent, /表头扩展字段/)
    assert.match(detailPageContent, /产品行扩展字段/)
    assert.match(detailPageContent, /headerExtraFields/)
    assert.match(detailPageContent, /itemExtraFields/)
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
