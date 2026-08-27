import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  CALC_STATUS_OPTIONS,
  QUOTE_REQUEST_COMPLETION_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  canConfirmClassification,
  filterQuoteRequestRows,
  hasNoBom,
  isCostReadyBomStatus,
  mergeBomStatusToDetail,
  normalizeQuoteRequestPage,
  quoteRequestCompletionLabel,
  quoteRequestCompletionTagType,
  statusLabel,
  statusTagType,
} from '../src/utils/quoteRequestWorkbench.js'
import { expandQuoteBomDisplayRows } from '../src/utils/quoteCostingBomRows.js'
import {
  buildCollaborationBatchStartItems,
  buildStoredCollaborationSummary,
  canBatchStartCollaboration,
  collaborationTagType,
  mergeCollaborationItems,
  mergeCollaborationSummary,
} from '../src/utils/quoteCollaboration.js'
import {
  countCarriedForwardPrices,
  isCarriedForwardPrice,
  priceReadyLabel,
  priceValidityText,
} from '../src/utils/pricePrepareDisplay.js'

const LIST_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-requests/index.vue')
const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteRequestDetailPage.vue')
const COST_RUN_DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CostRunDetailPage.vue')
const COSTING_WORKBENCH_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const MATERIAL_PRICE_TYPE_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/MaterialPriceTypePage.vue')
const PRICE_FIXED_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceFixedPage.vue')
const PRICE_SETTLE_FIXED_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceSettleFixedPage.vue')
const PRICE_LINKED_RESULT_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceLinkedResultPage.vue')
const PRICE_RANGE_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceRangePage.vue')
const QUOTE_REQUEST_API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const PRICE_PREPARE_API_FILE = path.resolve(import.meta.dirname, '../src/api/pricePrepare.js')
const COST_RUN_DETAIL_API_FILE = path.resolve(import.meta.dirname, '../src/api/costRunDetail.js')
const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')
const listPageContent = fs.readFileSync(LIST_PAGE_FILE, 'utf-8')
const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')
const costRunDetailPageContent = fs.readFileSync(COST_RUN_DETAIL_PAGE_FILE, 'utf-8')
const costingWorkbenchPageContent = fs.readFileSync(COSTING_WORKBENCH_PAGE_FILE, 'utf-8')
const materialPriceTypePageContent = fs.readFileSync(MATERIAL_PRICE_TYPE_PAGE_FILE, 'utf-8')
const priceFixedPageContent = fs.readFileSync(PRICE_FIXED_PAGE_FILE, 'utf-8')
const priceSettleFixedPageContent = fs.readFileSync(PRICE_SETTLE_FIXED_PAGE_FILE, 'utf-8')
const priceLinkedResultPageContent = fs.readFileSync(PRICE_LINKED_RESULT_PAGE_FILE, 'utf-8')
const priceRangePageContent = fs.readFileSync(PRICE_RANGE_PAGE_FILE, 'utf-8')
const quoteRequestApiContent = fs.readFileSync(QUOTE_REQUEST_API_FILE, 'utf-8')
const pricePrepareApiContent = fs.readFileSync(PRICE_PREPARE_API_FILE, 'utf-8')
const costRunDetailApiContent = fs.readFileSync(COST_RUN_DETAIL_API_FILE, 'utf-8')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

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
    assert.equal(statusLabel('bomStatus', 'CURRENT_MONTH_QUOTED'), 'BOM 当月发起过报价')
    assert.equal(statusLabel('bomStatus', 'U9_BOM_EXISTS'), 'U9 有此 BOM')
    assert.equal(statusLabel('bomStatus', 'SYNCING'), '同步中')
    assert.equal(statusTagType('bomStatus', 'REUSED_CURRENT_MONTH'), 'success')
    assert.equal(statusTagType('bomStatus', 'U9_BOM_EXISTS'), 'success')
    assert.equal(statusTagType('bomStatus', 'SYNCING'), 'warning')
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
    assert.equal(filterQuoteRequestRows(rows, { completionStatus: 'DONE' }).length, 1)
    assert.equal(filterQuoteRequestRows(rows, { completionStatus: 'NOT_DONE' }).length, 1)
  })

  it('报价单完成状态只展示已完成和未完成', () => {
    assert.deepEqual(
      QUOTE_REQUEST_COMPLETION_OPTIONS.map((item) => item.label),
      ['已完成', '未完成'],
    )
    assert.equal(quoteRequestCompletionLabel({ calcStatus: '已核算' }), '已完成')
    assert.equal(quoteRequestCompletionLabel({ calcStatus: 'CALCULATED' }), '已完成')
    assert.equal(quoteRequestCompletionLabel({ calcStatus: '未核算' }), '未完成')
    assert.equal(quoteRequestCompletionTagType({ calcStatus: '已核算' }), 'success')
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

  it('已沿用和检查确认有 BOM 的状态参与聚合和可核算判断，同步中不可核算', () => {
    const reused = mergeBomStatusToDetail({ items: [{ id: 11 }, { id: 12 }] }, {
      items: [
        { oaFormItemId: 11, bomStatus: 'REUSED_CURRENT_MONTH' },
        { oaFormItemId: 12, bomStatus: 'CURRENT_MONTH_QUOTED' },
      ],
    })
    const u9Ready = mergeBomStatusToDetail({ items: [{ id: 14 }] }, {
      items: [{ oaFormItemId: 14, bomStatus: 'U9_BOM_EXISTS' }],
    })
    const syncing = mergeBomStatusToDetail({ items: [{ id: 13 }] }, {
      items: [{ oaFormItemId: 13, bomStatus: 'SYNCING' }],
    })

    assert.equal(reused.bomAggregateStatus, 'SYNCED')
    assert.equal(u9Ready.bomAggregateStatus, 'U9_BOM_EXISTS')
    assert.equal(syncing.bomAggregateStatus, 'SYNCING')
    assert.equal(isCostReadyBomStatus('REUSED_CURRENT_MONTH'), true)
    assert.equal(isCostReadyBomStatus('CURRENT_MONTH_QUOTED'), true)
    assert.equal(isCostReadyBomStatus('U9_BOM_EXISTS'), true)
    assert.equal(isCostReadyBomStatus('ENTRY_PENDING'), false)
    assert.equal(isCostReadyBomStatus('EXPIRED'), false)
    assert.equal(isCostReadyBomStatus('SYNCING'), false)
  })
})

describe('报价物料上卷展示', () => {
  it('物料字段都按父件换行【子件】展示，不增加结算行', () => {
    const parent = {
      id: 4057,
      childCode: '201190083',
      childName: '接管',
      childSpec: 'PARENT-SPEC',
      childModel: 'PARENT-MODEL',
      usageQty: 1,
      qtyPerTop: 1,
      unit: '个',
      materialAttribute: '黄铜',
      shapeAttribute: '制造件',
      rollupComponents: [{
        childCode: '301050120',
        childName: '拉制铜管',
        childSpec: 'CHILD-SPEC',
        childModel: 'CHILD-MODEL',
        childUnit: '千克',
        childMaterialAttribute: '紫铜',
        childShapeAttribute: '采购件',
        parentSpec: 'PARENT-SPEC',
        parentModel: 'PARENT-MODEL',
        parentUnit: '个',
        parentMaterialAttribute: '黄铜',
        parentShapeAttribute: '制造件',
        usageQty: 0.00381546,
        qtyPerTop: 0.00381546,
      }],
    }

    const rows = expandQuoteBomDisplayRows([parent])

    assert.equal(rows.length, 1)
    assert.equal(rows[0].childCode, '201190083\n【301050120】')
    assert.equal(rows[0].childName, '接管\n【拉制铜管】')
    assert.equal(rows[0].childSpec, 'PARENT-SPEC\n【CHILD-SPEC】')
    assert.equal(rows[0].childModel, 'PARENT-MODEL\n【CHILD-MODEL】')
    assert.equal(rows[0].unit, '个\n【千克】')
    assert.equal(rows[0].materialAttribute, '黄铜\n【紫铜】')
    assert.equal(rows[0].shapeAttribute, '制造件\n【采购件】')
    assert.equal(rows[0].usageQty, 0.00381546)
    assert.equal(rows[0].sourceRow, parent)
    assert.equal('children' in rows[0], false)
  })

  it('同一父件命中两个子件时只拆展示行，仍指向同一结算行', () => {
    const parent = {
      id: 5001,
      childCode: 'A-PLATE',
      childName: 'A板片组件',
      childModel: 'A-DRAWING',
      rollupComponents: [
        { childCode: 'RAW-CU', childName: '铜箔', childModel: 'CU-DRAWING' },
        { childCode: 'RAW-SUS', childName: '不锈钢卷', childModel: 'SUS-DRAWING' },
      ],
    }

    const rows = expandQuoteBomDisplayRows([parent])

    assert.deepEqual(rows.map((row) => row.childName), [
      'A板片组件\n【铜箔】',
      'A板片组件\n【不锈钢卷】',
    ])
    assert.deepEqual(rows.map((row) => row.childCode), [
      'A-PLATE\n【RAW-CU】',
      'A-PLATE\n【RAW-SUS】',
    ])
    assert.deepEqual(rows.map((row) => row.childModel), [
      'A-DRAWING\n【CU-DRAWING】',
      'A-DRAWING\n【SUS-DRAWING】',
    ])
    assert.ok(rows.every((row) => row.sourceRow === parent))
  })

  it('普通结算行的品名、料号、图号保持不变', () => {
    const normal = {
      id: 6001,
      childCode: 'NORMAL-001',
      childName: '普通采购件',
      childModel: 'NORMAL-DRAWING',
    }

    const rows = expandQuoteBomDisplayRows([normal])

    assert.equal(rows.length, 1)
    assert.equal(rows[0].childCode, 'NORMAL-001')
    assert.equal(rows[0].childName, '普通采购件')
    assert.equal(rows[0].childModel, 'NORMAL-DRAWING')
    assert.equal(rows[0].rollupDisplay, false)
  })
})

describe('T11 报价单接入页面契约', () => {
  it('列表页串联查询和确认分类，仅以两态展示核算状态且不提供检查 BOM', () => {
    assert.match(listPageContent, /fetchQuoteRequests/)
    assert.match(listPageContent, /confirmQuoteRequestClassification/)
    assert.match(listPageContent, /来源类型/)
    assert.match(listPageContent, /申请单位/)
    assert.match(listPageContent, /申请部门/)
    assert.match(listPageContent, /申请处室/)
    assert.match(listPageContent, /接入时间/)
    assert.match(listPageContent, /核算状态/)
    assert.match(listPageContent, /QUOTE_REQUEST_COMPLETION_OPTIONS/)
    assert.match(listPageContent, /quoteRequestCompletionLabel/)
    assert.match(listPageContent, /scrollbar-always-on/)
    assert.match(listPageContent, /max-height="calc\(100vh - 330px\)"/)
    assert.doesNotMatch(listPageContent, /checkQuoteBomStatus/)
    assert.doesNotMatch(listPageContent, /检查 BOM/)
    assert.doesNotMatch(listPageContent, /处理 BOM/)
    assert.doesNotMatch(listPageContent, /接入状态/)
    assert.doesNotMatch(listPageContent, /分类状态/)
    assert.doesNotMatch(listPageContent, /BOM 状态/)
    assert.doesNotMatch(listPageContent, /goCostRun/)
    assert.doesNotMatch(listPageContent, /转到成本核算/)
    assert.doesNotMatch(listPageContent, /查看核算结果/)
    assert.doesNotMatch(listPageContent, /\/cost\/run/)
  })

  it('报价单列表不再保留旧 BOM 准备双入口', () => {
    assert.doesNotMatch(listPageContent, /goProductBom/)
    assert.doesNotMatch(listPageContent, /产品 BOM 准备/)
    assert.doesNotMatch(listPageContent, /batchSyncQuoteBomStatus/)
    assert.doesNotMatch(listPageContent, /batchCreateBomSupplementOaTasks/)
    assert.doesNotMatch(listPageContent, /type="selection"/)
  })

  it('QCBP-08 当前详情页使用六个业务列、唯一操作和真实协作接口', () => {
    assert.match(detailPageContent, /fetchQuoteRequestDetail/)
    assert.match(detailPageContent, /申请单位/)
    assert.match(detailPageContent, /申请部门/)
    assert.match(detailPageContent, /申请处室/)
    assert.match(detailPageContent, /el-tabs/)
    assert.match(detailPageContent, /产品明细/)
    assert.match(detailPageContent, /label="产品料号"/)
    assert.match(detailPageContent, /label="产品名称"/)
    assert.match(detailPageContent, /label="三花型号"/)
    assert.match(detailPageContent, /label="客户图号"/)
    assert.match(detailPageContent, /label="包装类型"/)
    assert.match(detailPageContent, /label="包装方式"/)
    assert.match(detailPageContent, /label="包装组件"/)
    assert.match(detailPageContent, /操作日志/)
    assert.match(detailPageContent, /ingestLog/)
    assert.doesNotMatch(detailPageContent, /分类状态/)
    assert.match(detailPageContent, /BOM状态/)
    assert.match(detailPageContent, /价格状态/)
    assert.match(detailPageContent, /处理人/)
    assert.match(detailPageContent, /当前状态/)
    assert.match(detailPageContent, /row\.collaboration\?\.bomStatus/)
    assert.match(detailPageContent, /type="selection"/)
    assert.match(detailPageContent, /批量发起协作/)
    assert.match(detailPageContent, /batchStartQuoteCollaboration/)
    assert.match(detailPageContent, /startQuoteItemCollaboration/)
    assert.match(detailPageContent, /fetchQuoteCollaborationSummary/)
    assert.doesNotMatch(detailPageContent, /loadCollaborationInBackground/)
    assert.match(detailPageContent, /mergeCollaborationSummary\(base, buildStoredCollaborationSummary\(base\)\)/)
    assert.match(detailPageContent, /Promise\.allSettled\(\[[\s\S]*fetchQuoteCollaborationSummary/)
    assert.doesNotMatch(detailPageContent, /await refreshCollaboration\(false\)/)
    assert.match(quoteRequestApiContent, /collaboration-summary`/)
    assert.match(quoteRequestApiContent, /collaboration-summary\/refresh/)
    assert.match(detailPageContent, /fetchQuoteItemCollaborationHistory/)
    assert.match(detailPageContent, /fetchQuoteTechnicianCandidates/)
    assert.match(quoteRequestApiContent, /collaboration\/technician-candidates/)
    assert.match(detailPageContent, /指定技术负责人/)
    assert.match(detailPageContent, /确定并发起补录/)
    assert.match(detailPageContent, /technicianUserId:\s*assignmentDialog\.selectedUserId/)
    assert.doesNotMatch(detailPageContent, /createQuoteProductBomTasks/)
    assert.doesNotMatch(detailPageContent, /pushQuoteProductBomOaTodo/)
    assert.doesNotMatch(detailPageContent, /OA待办已推送|OA 待办已推送/)
    assert.match(detailPageContent, /fixed="left"/)
    assert.doesNotMatch(detailPageContent, /额外费用/)
    assert.doesNotMatch(detailPageContent, /费用粒度/)
    assert.doesNotMatch(detailPageContent, /核算维度/)
    assert.doesNotMatch(detailPageContent, /accountingPeriodMonth/)
    assert.doesNotMatch(detailPageContent, /expenseProductCategory/)
    assert.doesNotMatch(detailPageContent, /sourceCompany/)
    assert.doesNotMatch(detailPageContent, /sourceBusinessDivision/)
    assert.doesNotMatch(detailPageContent, /表头扩展字段/)
    assert.doesNotMatch(detailPageContent, /产品行扩展字段/)
    assert.doesNotMatch(detailPageContent, /headerExtraFields/)
    assert.doesNotMatch(detailPageContent, /itemExtraFields/)
    assert.doesNotMatch(detailPageContent, /接入原文/)
    assert.doesNotMatch(detailPageContent, /操作记录/)
    assert.doesNotMatch(detailPageContent, /checkQuoteBomStatus/)
    assert.match(detailPageContent, /submitQuoteProductCostRun/)
    assert.match(detailPageContent, /openCostingWorkbench/)
    assert.match(detailPageContent, /\/ingest\/quote-requests\/\$\{encodeURIComponent\(oaNo\.value\)\}\/items\/\$\{encodeURIComponent\(row\.id\)\}\/costing/)
    assert.doesNotMatch(detailPageContent, /查看 BOM/)
    assert.doesNotMatch(detailPageContent, /\/base\/bomTree/)
    assert.doesNotMatch(detailPageContent, /topProductCode/)
    assert.doesNotMatch(detailPageContent, /showBomPlaceholder/)
    assert.doesNotMatch(detailPageContent, /goCostRun/)
    assert.doesNotMatch(detailPageContent, /转到成本核算/)
    assert.doesNotMatch(detailPageContent, /\/cost\/run/)
  })

  it('QCB-05 产品行发起核算进入单产品核算工作台', () => {
    assert.match(routerContent, /path:\s*'\/ingest\/quote-requests\/:oaNo\/items\/:itemId\/costing'/)
    assert.match(routerContent, /QuoteProductCostingWorkbenchPage/)
    assert.match(quoteRequestApiContent, /fetchQuoteCostingWorkbench/)
    assert.match(quoteRequestApiContent, /\/items\/\$\{encodePath\(itemId\)\}\/costing-workbench/)
    assert.match(detailPageContent, /nextAction !== 'START_COSTING'/)
    assert.match(quoteRequestApiContent, /submitQuoteProductCostRun/)
    assert.match(quoteRequestApiContent, /\/items\/\$\{encodePath\(itemId\)\}\/cost-runs/)
    assert.doesNotMatch(quoteRequestApiContent, /cost-run\/trial|costing-workbench\/launch/)
    assert.match(detailPageContent, /async function startCosting[\s\S]*submitSingleProductCosting\(row, 'USER_REQUEST'\)/)
    assert.match(detailPageContent, /async function restartCosting[\s\S]*submitSingleProductCosting\(row, 'INPUT_CHANGED'\)/)
    assert.match(detailPageContent, /async function submitSingleProductCosting[\s\S]*submitQuoteProductCostRun/)
    assert.match(costingWorkbenchPageContent, /async function applyRouteTab[\s\S]*activeTab\.value = requestedTab/)
    assert.doesNotMatch(costingWorkbenchPageContent, /async function applyRouteTab[\s\S]{0,500}preparePricingBomForNextStep/)
    assert.match(costingWorkbenchPageContent, /const costingProductCode = computed/)
    assert.match(costingWorkbenchPageContent, /item\.value\.sunlModel \|\| item\.value\.customerDrawing/)
    assert.match(costingWorkbenchPageContent, /item\.value\.materialNo \|\| item\.value\.sunlModel \|\| item\.value\.customerDrawing/)
  })

  it('T13 价格类型只保留自动识别接口，不再暴露人工确认写入口', () => {
    assert.match(quoteRequestApiContent, /fetchQuotePriceTypeRecognition/)
    assert.match(quoteRequestApiContent, /\/price-type-recognition/)
    assert.doesNotMatch(quoteRequestApiContent, /price-type-confirmation/)
    assert.doesNotMatch(quoteRequestApiContent, /import-missing|adjustPriceType/)
    assert.match(costingWorkbenchPageContent, /latestPriceTypeRecognition/)
    assert.doesNotMatch(costingWorkbenchPageContent, /latestPriceTypeConfirmation/)
  })

  it('T10 整单一键核算使用单个 OA 接口并被动轮询轻量进度', () => {
    assert.match(detailPageContent, /整单一键核算/)
    assert.match(detailPageContent, /submitWholeQuoteCosting/)
    assert.match(detailPageContent, /submitQuoteBatchCostRun\(oaNo\.value, \{ mode: 'ALL' \}\)/)
    assert.match(detailPageContent, /fetchCurrentQuoteBatchCostRun/)
    assert.match(detailPageContent, /window\.setTimeout\(pollBatchProgress, 2000\)/)
    assert.match(detailPageContent, /成功 \{\{ batchRun\.successCount/)
    assert.match(detailPageContent, /协作 \{\{ batchRun\.collaborationCount/)
    assert.match(detailPageContent, /跳过 \{\{ batchRun\.skippedCurrentCount/)
    assert.match(detailPageContent, /v-if="batchRun\.message"/)
    assert.match(detailPageContent, /:title="batchRun\.message"/)
    assert.match(detailPageContent, /next\?\.status === 'FAILED'/)
    assert.match(quoteRequestApiContent, /export const submitQuoteBatchCostRun/)
    assert.match(quoteRequestApiContent, /export const fetchCurrentQuoteBatchCostRun/)
    assert.match(quoteRequestApiContent, /\/quote-requests\/\$\{encodePath\(oaNo\)\}\/cost-runs/)
    assert.doesNotMatch(detailPageContent, /for\s*\([^)]*detail\.value\.items[\s\S]{0,300}submitQuoteProductCostRun/)
  })

  it('QCBP-08 产品行只按服务端 nextAction 执行一个明确入口', () => {
    assert.match(detailPageContent, /handleRowAction\(row\)/)
    assert.match(detailPageContent, /STARTABLE_COLLABORATION_ACTIONS\.has\(action\)/)
    assert.match(detailPageContent, /action === 'VIEW_SUPPLEMENT'/)
    assert.match(detailPageContent, /action === 'START_COSTING'/)
    assert.match(detailPageContent, /action === 'RESTART_COSTING'/)
    assert.match(detailPageContent, /action === 'RETRY_COSTING'/)
    assert.match(detailPageContent, /action === 'VIEW_COSTING_RESULT'/)
    assert.match(detailPageContent, /action === 'VIEW_COSTING_PROGRESS'/)
    assert.match(detailPageContent, /action === 'VIEW_COSTING_GAP'/)
    assert.match(detailPageContent, /needsAuthoritativeProjection\(row\)/)
    assert.match(detailPageContent, /scanQuoteItemCollaboration\(oaNo\.value, row\.id\)/)
    assert.doesNotMatch(detailPageContent, /PREPARE_COSTING|CONTINUE_COSTING|launchQuoteCostingWorkbench/)
    assert.match(detailPageContent, /VIEW_COSTING_RESULT'[\s\S]*openCostResultHistory/)
    assert.match(detailPageContent, /fetchQuoteCostResultHistory/)
    assert.match(detailPageContent, /原报价结果、月度调价结果分别保存/)
    assert.match(detailPageContent, /versionId: selected\.versionId/)
    assert.match(detailPageContent, /historyResult: 'quote'/)
    assert.match(detailPageContent, /historyResultKind: selected\.resultTypeLabel === '报价重新核算结果'/)
    assert.match(costingWorkbenchPageContent, /historyViewMode/)
    assert.match(costingWorkbenchPageContent, /versionId: historyVersionId\.value/)
    assert.match(costingWorkbenchPageContent, /正在查看.*historyResultLabel/)
    assert.match(costingWorkbenchPageContent, /historyResultKind === 'recalculation'/)
    assert.match(detailPageContent, /function openCostingGap[\s\S]*guide: 'costing-input-gap'/)
  })

  it('T11 缺 BOM 引导优先于尚未执行的价格检查', () => {
    assert.match(costingWorkbenchPageContent,
      /workspaceStatus === 'WAIT_BOM' \|\| blockedStep === 'QUOTE_BOM'/)
    assert.match(costingWorkbenchPageContent,
      /当前产品缺少可核算 BOM，请由产品技术补录后重新核算本产品/)
  })

  it('QCBP-08 协作投影合并、批量可选与状态颜色由统一工具决定', () => {
    const merged = mergeCollaborationSummary({ items: [{ id: 7, materialNo: 'M-7' }] }, {
      summaryVersion: 'S1',
      items: [{ itemId: 7, nextAction: 'START_PRICE_SUPPLEMENT', batchSelectable: true }],
    })
    assert.equal(merged.collaborationSummaryVersion, 'S1')
    assert.equal(merged.items[0].collaboration.nextAction, 'START_PRICE_SUPPLEMENT')
    assert.equal(canBatchStartCollaboration(merged.items[0]), true)
    assert.equal(canBatchStartCollaboration({
      id: 9,
      collaboration: { nextAction: 'ASSIGN_TECHNICIAN', batchSelectable: true },
    }), true)
    assert.equal(canBatchStartCollaboration({ id: 8, collaboration: { nextAction: 'VIEW_SUPPLEMENT', batchSelectable: false } }), false)
    assert.deepEqual(buildCollaborationBatchStartItems([
      { id: 9, collaboration: { nextAction: 'ASSIGN_TECHNICIAN', batchSelectable: true, projectionVersion: 'V9' } },
      { id: 10, collaboration: { nextAction: 'START_BOM_SUPPLEMENT', batchSelectable: true, projectionVersion: 'V10' } },
    ], 602), [
      { itemId: 9, technicianUserId: 602, expectedProjectionVersion: 'V9' },
      { itemId: 10, technicianUserId: undefined, expectedProjectionVersion: 'V10' },
    ])
    assert.equal(collaborationTagType('READY_FOR_COSTING'), 'success')
    assert.equal(collaborationTagType('MISSING_PRICE'), 'danger')

    const locallyUpdated = mergeCollaborationItems({
      items: [
        { id: 7, collaboration: { currentStatus: 'OLD' } },
        { id: 8, collaboration: { currentStatus: 'UNCHANGED' } },
      ],
    }, [{ itemId: 7, currentStatus: 'WAIT_TECH' }])
    assert.equal(locallyUpdated.items[0].collaboration.currentStatus, 'WAIT_TECH')
    assert.equal(locallyUpdated.items[1].collaboration.currentStatus, 'UNCHANGED')
  })

  it('详情首屏只使用持久化工作区状态并标识待重新核算', () => {
    const stored = buildStoredCollaborationSummary({
      items: [
        { id: 1, calcStatus: '未核算', bomStatus: { bomStatus: 'U9_BOM_EXISTS' } },
        { id: 2, calcStatus: '未核算', bomStatus: { bomStatus: 'NO_BOM' } },
        { id: 3, calcStatus: '已核算', confirmedCostVersionId: 33, bomStatus: { bomStatus: 'SYNCED' } },
        {
          id: 4,
          calcStatus: '已核算',
          confirmedCostVersionId: 34,
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: { workspaceStatus: 'STALE', inputChanged: true },
        },
        {
          id: 5,
          calcStatus: '未核算',
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: { workspaceStatus: 'BOM_READY', currentStep: 'PRICE_TYPE_CONFIRMATION' },
        },
        {
          id: 6,
          calcStatus: '已核算',
          confirmedCostVersionId: 35,
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: {
            workspaceStatus: 'WAIT_PRICE',
            gapCount: 2,
            lastErrorCode: 'FINANCE_BASE_PRICE_MISSING',
            lastErrorMessage: '缺少财务基准价格',
          },
        },
        {
          id: 7,
          calcStatus: '试算中',
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: { workspaceStatus: 'WAIT_PRICE_TYPE', gapCount: 4 },
        },
        {
          id: 8,
          calcStatus: '试算中',
          bomStatus: { bomStatus: 'SYNCED' },
        },
      ],
    })

    assert.equal(stored.items[0].bomStatusLabel, 'U9有此BOM')
    assert.equal(stored.items[0].currentStatusLabel, '未开始')
    assert.equal(stored.items[0].actionEnabled, true)
    assert.equal(stored.items[0].nextAction, 'START_COSTING')
    assert.equal(stored.items[1].currentStatusLabel, '待补BOM')
    assert.equal(stored.items[1].priceStatusLabel, '待BOM补齐后检查')
    assert.equal(stored.items[1].nextAction, 'ASSIGN_TECHNICIAN')
    assert.equal(stored.items[1].nextActionLabel, '指定技术负责人')
    assert.equal(stored.items[1].batchSelectable, true)
    assert.equal(stored.items[2].currentStatusLabel, '核算完成')
    assert.equal(stored.items[2].priceStatusLabel, '价格齐全')
    assert.equal(stored.items[2].nextAction, 'VIEW_COSTING_RESULT')
    assert.equal(stored.items[2].nextActionLabel, '查看结果')
    assert.match(stored.items[2].message, /当前成功结果/)
    assert.equal(stored.items[3].currentStatusLabel, '待重新核算')
    assert.equal(stored.items[3].nextAction, 'RESTART_COSTING')
    assert.match(stored.items[3].message, /原核算结果仍可查看/)
    assert.equal(stored.items[4].currentStatusLabel, '可核算')
    assert.equal(stored.items[4].nextAction, 'START_COSTING')
    assert.equal(stored.items[4].nextActionLabel, '核算本产品')
    assert.equal(stored.items[4].actionEnabled, true)
    assert.equal(stored.items[5].currentStatusLabel, '缺价格')
    assert.equal(stored.items[5].nextAction, 'VIEW_COSTING_GAP')
    assert.equal(stored.items[5].nextActionLabel, '查看缺口')
    assert.equal(stored.items[5].assigneeName, '财务报价')
    assert.equal(stored.items[5].message, '缺少财务基准价格')
    assert.equal(stored.items[6].currentStatusLabel, '缺价格类型')
    assert.equal(stored.items[6].nextAction, 'VIEW_COSTING_GAP')
    assert.match(stored.items[6].message, /4 个待处理缺口/)
    assert.equal(stored.items[7].currentStatusLabel, '核算中')
    assert.equal(stored.items[7].nextAction, 'VIEW_COSTING_PROGRESS')
  })

  it('一键核算保存的技术缺口可直接选择负责人，财务基准价仍留在核算工作台', () => {
    const stored = buildStoredCollaborationSummary({
      items: [
        {
          id: 21,
          bomStatus: { bomStatus: 'NO_BOM' },
          costingWorkspace: { workspaceStatus: 'WAIT_BOM' },
        },
        {
          id: 22,
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: { workspaceStatus: 'WAIT_PRICE', gapCount: 2 },
        },
        {
          id: 23,
          bomStatus: { bomStatus: 'SYNCED' },
          costingWorkspace: {
            workspaceStatus: 'WAIT_PRICE',
            lastErrorCode: 'FINANCE_BASE_PRICE_MISSING',
          },
        },
      ],
    })

    assert.deepEqual(stored.items.map(item => item.nextAction), [
      'ASSIGN_TECHNICIAN', 'ASSIGN_TECHNICIAN', 'VIEW_COSTING_GAP',
    ])
    assert.deepEqual(stored.items.map(item => item.batchSelectable), [true, true, false])
  })

  it('T12 已核算产品聚合展示沿用历史价提醒', () => {
    const stored = buildStoredCollaborationSummary({
      items: [{
        id: 12,
        calcStatus: '已核算',
        confirmedCostVersionId: 120,
        bomStatus: { bomStatus: 'SYNCED' },
        costingWorkspace: { workspaceStatus: 'SUCCESS', carriedForwardPriceCount: 3 },
      }],
    })

    assert.equal(stored.items[0].priceStatusLabel, '价格齐全 · 3项沿用历史价')
    assert.match(stored.items[0].message, /不阻断报价/)
  })

  it('T12 第 5 步逐物料显示历史价标签和审批有效期说明', () => {
    const historical = {
      carriedForward: 1,
      sourceEffectiveTo: '2026-07-31',
      warningMessage: '沿用历史价：价格有效期至 2026-07-31，本次核算日 2026-08-01',
    }
    const current = { carriedForward: 0, sourceEffectiveFrom: '2026-08-01', sourceEffectiveTo: null }

    assert.equal(priceReadyLabel(2), '价格齐全 · 2项沿用历史价')
    assert.equal(isCarriedForwardPrice(historical), true)
    assert.equal(countCarriedForwardPrices([historical, current]), 1)
    assert.match(priceValidityText(historical), /2026-07-31/)
    assert.equal(priceValidityText(current), '有效期：2026-08-01 至 长期')
    assert.match(costingWorkbenchPageContent, /沿用历史价/)
    assert.match(costingWorkbenchPageContent, /priceHistoryWarningText/)
    assert.match(costingWorkbenchPageContent, /priceValidityText\(row\)/)
  })

  it('T11 财务基准价缺失从详情页直达第 5 步最终价格', () => {
    assert.match(detailPageContent,
      /FINANCE_BASE_PRICE_MISSING'\) return 'PRICE_PREPARE'/)
    assert.match(detailPageContent,
      /row\?\.costingWorkspace\?\.lastErrorCode/)
  })

  it('QEB-14 工作台初始化展示最终有效 BOM 树和后续真实接口 tab', () => {
    assert.match(costingWorkbenchPageContent, /fetchQuoteCostingWorkbench/)
    assert.match(costingWorkbenchPageContent, /fetchQuoteEffectiveBom/)
    assert.match(costingWorkbenchPageContent, /BomNodeDetailDrawer/)
    assert.match(costingWorkbenchPageContent, /onMounted\(\(\) => initializeWorkbench\(\)\)/)
    assert.match(costingWorkbenchPageContent, /autoPriceSourceCheckedKey/)
    assert.match(costingWorkbenchPageContent, /priceSourceAutoCheckKey/)
    assert.match(costingWorkbenchPageContent, /async function refreshWorkbench\(\)[\s\S]*autoPriceSourceCheckedKey\.value = ''[\s\S]*ensurePriceSourceChecked\(\)/)
    assert.match(costingWorkbenchPageContent, /activeTab = ref\('PRODUCT_DETAIL'\)/)
    assert.match(costingWorkbenchPageContent, /resetTab/)
    assert.match(costingWorkbenchPageContent, /产品明细/)
    assert.match(costingWorkbenchPageContent, /本次计价 BOM/)
    assert.match(costingWorkbenchPageContent, /loadEffectiveBom/)
    assert.match(costingWorkbenchPageContent, /item\.value\.materialNo/)
    assert.match(costingWorkbenchPageContent, /openBomNodeDetail/)
    assert.match(costingWorkbenchPageContent, /expandBomTree/)
    assert.match(costingWorkbenchPageContent, /collapseBomTree/)
    assert.match(costingWorkbenchPageContent, /报价物料明细/)
    assert.match(costingWorkbenchPageContent, /价格类型识别/)
    assert.match(costingWorkbenchPageContent, /价格准备/)
    assert.match(costingWorkbenchPageContent, /成本核算/)
    assert.match(costingWorkbenchPageContent, /tab\.code === 'PRODUCT_DETAIL'/)
    assert.match(costingWorkbenchPageContent, /isQuoteBomTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isPriceTypeTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isPricePrepareTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isCostRunTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /bomRows/)
    assert.match(costingWorkbenchPageContent, /displayBomRows/)
    assert.match(costingWorkbenchPageContent, /expandQuoteBomDisplayRows/)
    assert.match(costingWorkbenchPageContent, /上卷父件已按命中子件生成展示名称/)
    assert.match(costingWorkbenchPageContent, /scrollbar-always-on/)
    assert.match(costingWorkbenchPageContent, /max-height="calc\(100vh - 420px\)"/)
    assert.doesNotMatch(costingWorkbenchPageContent, /prop="parentCode" label="父件料号"/)
    assert.doesNotMatch(costingWorkbenchPageContent, /prop="level" label="层级"/)
    assert.doesNotMatch(costingWorkbenchPageContent, /prop="settlementRowType" label="结算行类型"/)
    assert.doesNotMatch(costingWorkbenchPageContent, /待开发/)
    assert.match(costingWorkbenchPageContent, /fixed="left"/)
    assert.match(costingWorkbenchPageContent, /show-overflow-tooltip/)
    assert.doesNotMatch(costingWorkbenchPageContent, /@tab-click/)
    assert.doesNotMatch(costingWorkbenchPageContent, /fetchQuoteRequestDetail/)
    assert.match(costingWorkbenchPageContent, /tab-index/)
    assert.match(costingWorkbenchPageContent, /tabBadgeLabel\(tab\)/)
    assert.match(costingWorkbenchPageContent, /tabBadgeType\(tab\)/)
    assert.match(costingWorkbenchPageContent, /currentSuccessVersion\.value\?\.id && versionNo\) return `核算成功/)
    assert.match(costingWorkbenchPageContent, /if \(currentSuccessVersion\.value\?\.id\) return 'success'/)
    assert.doesNotMatch(costingWorkbenchPageContent, /workflow-strip/)
    assert.doesNotMatch(costingWorkbenchPageContent, /当前处理/)
    assert.match(costingWorkbenchPageContent, /STALE: '需更新'/)
    assert.doesNotMatch(costingWorkbenchPageContent, /已过期/)
  })

  it('QWB-08 工作台接入 BOM、价格类型、价格准备和成本核算主动作接口', () => {
    assert.match(quoteRequestApiContent, /prepareQuoteEffectiveBomCosting/)
    assert.doesNotMatch(quoteRequestApiContent, /confirmCostingBom|cancelCostingBomConfirm/)
    assert.match(quoteRequestApiContent, /fetchQuotePriceTypeRecognition/)
    assert.doesNotMatch(quoteRequestApiContent, /importMissingPriceType/)
    assert.doesNotMatch(quoteRequestApiContent, /adjustPriceType/)
    assert.doesNotMatch(quoteRequestApiContent, /confirmPriceType/)
    assert.match(quoteRequestApiContent, /fetchQuotePricePrepare/)
    assert.match(quoteRequestApiContent, /checkQuotePriceSources/)
    assert.match(quoteRequestApiContent, /price-prepare\/check/)
    assert.match(quoteRequestApiContent, /generateQuotePricePrepare/)
    assert.match(quoteRequestApiContent, /fetchQuoteCostRun/)
    assert.match(quoteRequestApiContent, /submitQuoteProductCostRun/)
    assert.match(quoteRequestApiContent, /\/cost-runs/)
    assert.doesNotMatch(quoteRequestApiContent, /cost-run\/trial/)
    assert.doesNotMatch(quoteRequestApiContent, /confirmQuoteCostRun/)
    assert.match(quoteRequestApiContent, /exportQuoteCostRunVersion/)
    assert.match(costingWorkbenchPageContent, /按当前规则重新生成/)
    assert.doesNotMatch(costingWorkbenchPageContent, /确认报价物料明细|撤销确认/)
    assert.match(costingWorkbenchPageContent, /去物料价格类型维护/)
    assert.match(costingWorkbenchPageContent, /openMaterialPriceTypePage/)
    assert.match(costingWorkbenchPageContent, /path: '\/base\/map'/)
    assert.doesNotMatch(costingWorkbenchPageContent, /调整类型/)
    assert.doesNotMatch(costingWorkbenchPageContent, /priceTypeDrawerMode/)
    assert.doesNotMatch(costingWorkbenchPageContent, /importMissingPriceType/)
    assert.doesNotMatch(costingWorkbenchPageContent, /确认价格类型/)
    assert.match(costingWorkbenchPageContent, /价格类型已自动识别/)
    assert.match(costingWorkbenchPageContent, /价格源维护/)
    assert.doesNotMatch(costingWorkbenchPageContent, /价格源补充/)
    assert.match(costingWorkbenchPageContent, /生成最终价格/)
    assert.match(costingWorkbenchPageContent, /最终价格已生成，可进入成本核算/)
    assert.match(costingWorkbenchPageContent, /label="财务基准" name="FINANCE"/)
    assert.match(costingWorkbenchPageContent, /label="OA 锁价" name="OA"/)
    assert.match(costingWorkbenchPageContent, /label="差异对比" name="DIFFERENCE"/)
    assert.match(costingWorkbenchPageContent, /pricePrepare\.financeCuPricePerKg/)
    assert.match(costingWorkbenchPageContent, /visiblePricePrepareDifferences/)
    assert.match(costingWorkbenchPageContent, /pricePrepare\.value = await checkQuotePriceSources/)
    assert.doesNotMatch(costingWorkbenchPageContent, /latestPriceType\.value\.confirmNo/)
    assert.doesNotMatch(costingWorkbenchPageContent, /priceTypeConfirmNo:/)
    assert.doesNotMatch(costingWorkbenchPageContent, /generatePricePrepare\(successText, false\)/)
    assert.match(costingWorkbenchPageContent, /oaPricePrepareReady\.value && financePricePrepareReady\.value/)
    assert.match(costingWorkbenchPageContent, /前置条件检查/)
    assert.match(costingWorkbenchPageContent, /核算本产品/)
    assert.doesNotMatch(costingWorkbenchPageContent, /确认核算/)
    assert.match(costingWorkbenchPageContent, /查看一览表/)
    assert.match(costingWorkbenchPageContent, /refreshAfterAction/)
    assert.match(costingWorkbenchPageContent, /const result = await submitQuoteProductCostRun/)
    assert.match(costingWorkbenchPageContent, /pipelineStatus === 'SUCCESS'/)
    assert.match(costingWorkbenchPageContent, /productCostingResultTab/)
    assert.match(costingWorkbenchPageContent, /立即重新核算/)
  })

  it('T9 成本核算 Tab 使用成本版本表并按当前行打开一览表和底稿', () => {
    assert.match(costingWorkbenchPageContent, /costRunVersions/)
    assert.match(costingWorkbenchPageContent, /cost-version-table/)
    assert.match(costingWorkbenchPageContent, /row\.costRunNo/)
    assert.match(costingWorkbenchPageContent, /openCostRunDetail\(row\)/)
    assert.match(costingWorkbenchPageContent, /openCostRunTrace\(row\)/)
    assert.match(costingWorkbenchPageContent, /productCode,/)
    assert.match(costingWorkbenchPageContent, /materialCode: productCode/)
    assert.match(costingWorkbenchPageContent, /核算成功后自动生成正式版本/)
    assert.match(costingWorkbenchPageContent, /当前成功/)
    assert.match(costingWorkbenchPageContent, /历史版本/)
    assert.doesNotMatch(costingWorkbenchPageContent, /新试算待确认/)
    assert.doesNotMatch(costingWorkbenchPageContent, /当前可查看成本表/)
    assert.match(costRunDetailApiContent, /fetchCostRunTraces/)
    assert.match(costRunDetailApiContent, /\/api\/v1\/cost-run\/detail\/\$\{encodeURIComponent/)
    assert.match(costRunDetailApiContent, /\/traces/)
  })

  it('QWB-09 重新生成报价物料后自动引导到价格类型识别', () => {
    assert.match(costingWorkbenchPageContent, /guidePriceTypeAfterBomBuild/)
    assert.match(costingWorkbenchPageContent, /preparePricingBomForNextStep\(true\)[\s\S]*guidePriceTypeAfterBomBuild\(\)/)
    assert.match(costingWorkbenchPageContent, /activeTab\.value = 'PRICE_TYPE_CONFIRMATION'/)
    assert.match(costingWorkbenchPageContent, /priceTypeFilter\.value = 'MISSING'/)
    assert.match(costingWorkbenchPageContent, /报价物料明细已生成，系统发现 \$\{missingTypeCount\} 项缺价格类型，请到“物料价格类型”导入或维护/)
    assert.match(costingWorkbenchPageContent, /workflowGuideVisible/)
    assert.match(costingWorkbenchPageContent, /!currentSuccessVersion\.value\?\.id/)
    assert.match(costingWorkbenchPageContent, /delete nextQuery\.guide/)
    assert.match(costingWorkbenchPageContent, /workflowGuideText/)
  })

  it('QWB-10 缺价格类型入口跳转到物料价格类型页并带入料号查询', () => {
    assert.match(costingWorkbenchPageContent, /openMaterialPriceTypePage/)
    assert.match(costingWorkbenchPageContent, /materialCode: first\.materialCode/)
    assert.match(costingWorkbenchPageContent, /returnTo: route\.fullPath/)
    assert.match(materialPriceTypePageContent, /useRoute/)
    assert.match(materialPriceTypePageContent, /useRouter/)
    assert.match(materialPriceTypePageContent, /applyRouteMaterialCode/)
    assert.match(materialPriceTypePageContent, /route\.query\.materialCode/)
    assert.match(materialPriceTypePageContent, /返回核算工作台/)
    assert.match(materialPriceTypePageContent, /returnToWorkbench/)
  })

  it('QWB-11 价格源维护页支持从核算工作台跳转后返回', () => {
    assert.match(costingWorkbenchPageContent, /function openPriceSource\(row\)/)
    assert.match(costingWorkbenchPageContent, /materialCode,\s*\n\s*pricingMonth,/)
    assert.match(costingWorkbenchPageContent, /returnTo: route\.fullPath/)
    ;[
      priceFixedPageContent,
      priceSettleFixedPageContent,
      priceLinkedResultPageContent,
      priceRangePageContent,
    ].forEach((pageContent) => {
      assert.match(pageContent, /返回核算工作台/)
      assert.match(pageContent, /returnToWorkbenchVisible/)
      assert.match(pageContent, /returnToWorkbench/)
      assert.match(pageContent, /route\.query\.returnTo/)
    })
    assert.match(priceFixedPageContent, /applyRouteContext/)
    assert.match(priceSettleFixedPageContent, /applyRouteContext/)
    assert.match(priceRangePageContent, /applyRouteContext/)
  })

  it('QWB-11 价格源维护页支持缺废料映射确认无废料按0处理', () => {
    assert.match(pricePrepareApiContent, /confirmPricePrepareNoScrap/)
    assert.match(costingWorkbenchPageContent, /confirmPricePrepareNoScrap/)
    assert.match(costingWorkbenchPageContent, /isMissingScrapMappingGap\(row\)/)
    assert.match(costingWorkbenchPageContent, /lp_material_scrap_ref/)
    assert.match(costingWorkbenchPageContent, /MISSING_SCRAP_MAPPING/)
    assert.match(costingWorkbenchPageContent, /CONFIRM_NO_SCRAP/)
    assert.match(costingWorkbenchPageContent, /废料映射缺口/)
    assert.match(costingWorkbenchPageContent, /补充废料映射/)
    assert.match(costingWorkbenchPageContent, /确认无废料，按0处理/)
    assert.match(costingWorkbenchPageContent, /confirmReason/)
    assert.match(costingWorkbenchPageContent, /effectiveFromMonth: context\.periodMonth/)
    assert.match(costingWorkbenchPageContent, /sourceGapId: row\?\.id/)
    assert.match(costingWorkbenchPageContent, /runPriceSourceCheck\('无废料已确认，价格源已刷新'\)/)
  })

  it('QCB-06 报价物料明细不再提供单行替换或用量调整能力', () => {
    assert.doesNotMatch(costingWorkbenchPageContent, /替换\/调整/)
    assert.doesNotMatch(costingWorkbenchPageContent, /替换子件料号/)
    assert.doesNotMatch(costingWorkbenchPageContent, /updateCostingBomRow/)
    assert.doesNotMatch(costingWorkbenchPageContent, /startEdit\(row\)/)
    assert.doesNotMatch(costingWorkbenchPageContent, /saveBomRow/)
    assert.doesNotMatch(costingWorkbenchPageContent, /cancelEdit\(\)/)
    assert.doesNotMatch(costingWorkbenchPageContent, /label="人工修改"/)
    assert.doesNotMatch(costingWorkbenchPageContent, /prop="modifiedBy"/)
    assert.doesNotMatch(costingWorkbenchPageContent, />用量调整</)
    assert.doesNotMatch(quoteRequestApiContent, /costing-bom\/rows\/\$\{encodePath\(rowId\)\}/)
    assert.match(
      costingWorkbenchPageContent,
      /loading\.value = true\s*try \{\s*clearEffectiveBom\(\)[\s\S]*?finally \{\s*loading\.value = false/,
    )
  })
})
