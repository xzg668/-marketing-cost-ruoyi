import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  CALC_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  QUOTE_REQUEST_COMPLETION_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  OA_TODO_PUSH_STATUS_OPTIONS,
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

const LIST_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-requests/index.vue')
const PRODUCT_BOM_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-request-products/bom/index.vue')
const DETAIL_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteRequestDetailPage.vue')
const COSTING_WORKBENCH_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/QuoteProductCostingWorkbenchPage.vue')
const MATERIAL_PRICE_TYPE_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/MaterialPriceTypePage.vue')
const PRICE_FIXED_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceFixedPage.vue')
const PRICE_SETTLE_FIXED_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceSettleFixedPage.vue')
const PRICE_LINKED_RESULT_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceLinkedResultPage.vue')
const PRICE_RANGE_PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/PriceRangePage.vue')
const QUOTE_REQUEST_API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteRequests.js')
const PRICE_PREPARE_API_FILE = path.resolve(import.meta.dirname, '../src/api/pricePrepare.js')
const COST_RUN_DETAIL_API_FILE = path.resolve(import.meta.dirname, '../src/api/costRunDetail.js')
const U9_MATERIAL_API_FILE = path.resolve(import.meta.dirname, '../src/api/u9MaterialMaster.js')
const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')
const listPageContent = fs.readFileSync(LIST_PAGE_FILE, 'utf-8')
const productBomPageContent = fs.readFileSync(PRODUCT_BOM_PAGE_FILE, 'utf-8')
const detailPageContent = fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8')
const costingWorkbenchPageContent = fs.readFileSync(COSTING_WORKBENCH_PAGE_FILE, 'utf-8')
const materialPriceTypePageContent = fs.readFileSync(MATERIAL_PRICE_TYPE_PAGE_FILE, 'utf-8')
const priceFixedPageContent = fs.readFileSync(PRICE_FIXED_PAGE_FILE, 'utf-8')
const priceSettleFixedPageContent = fs.readFileSync(PRICE_SETTLE_FIXED_PAGE_FILE, 'utf-8')
const priceLinkedResultPageContent = fs.readFileSync(PRICE_LINKED_RESULT_PAGE_FILE, 'utf-8')
const priceRangePageContent = fs.readFileSync(PRICE_RANGE_PAGE_FILE, 'utf-8')
const quoteRequestApiContent = fs.readFileSync(QUOTE_REQUEST_API_FILE, 'utf-8')
const pricePrepareApiContent = fs.readFileSync(PRICE_PREPARE_API_FILE, 'utf-8')
const costRunDetailApiContent = fs.readFileSync(COST_RUN_DETAIL_API_FILE, 'utf-8')
const u9MaterialApiContent = fs.readFileSync(U9_MATERIAL_API_FILE, 'utf-8')
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
    assert.equal(statusLabel('productType', 'BARE'), '裸品')
    assert.equal(statusLabel('reviewStatus', 'APPROVED'), '已通过')
    assert.equal(statusTagType('bomStatus', 'REUSED_CURRENT_MONTH'), 'success')
    assert.equal(statusTagType('bomStatus', 'U9_BOM_EXISTS'), 'success')
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

  it('详情页展示基础业务信息、产品明细和操作日志，不展示其他技术接入标签', () => {
    assert.match(detailPageContent, /fetchQuoteRequestDetail/)
    assert.match(detailPageContent, /申请单位/)
    assert.match(detailPageContent, /申请部门/)
    assert.match(detailPageContent, /申请处室/)
    assert.match(detailPageContent, /el-tabs/)
    assert.match(detailPageContent, /产品明细/)
    assert.match(detailPageContent, /包装类型/)
    assert.match(detailPageContent, /操作日志/)
    assert.match(detailPageContent, /ingestLog/)
    assert.doesNotMatch(detailPageContent, /分类状态/)
    assert.match(detailPageContent, /BOM 状态/)
    assert.match(detailPageContent, /row\.bomStatus\?\.bomStatus/)
    assert.match(detailPageContent, /type="selection"/)
    assert.match(detailPageContent, /批量发起补录/)
    assert.match(detailPageContent, /createQuoteProductBomTasks/)
    assert.match(detailPageContent, /pushQuoteProductBomOaTodo/)
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
    assert.match(detailPageContent, /checkQuoteBomStatus/)
    assert.match(detailPageContent, /发起核算/)
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
    assert.match(detailPageContent, /canStartCosting/)
    assert.match(detailPageContent, /isCostReadyBomStatus/)
  })

  it('QWB-08 工作台初始化展示五个真实接口 tab 和产品明细 BOM 树', () => {
    assert.match(costingWorkbenchPageContent, /fetchQuoteCostingWorkbench/)
    assert.match(costingWorkbenchPageContent, /getBomHierarchy/)
    assert.match(costingWorkbenchPageContent, /BomNodeDetailDrawer/)
    assert.match(costingWorkbenchPageContent, /onMounted\(\(\) => initializeWorkbench\(\)\)/)
    assert.match(costingWorkbenchPageContent, /autoPriceSourceCheckedKey/)
    assert.match(costingWorkbenchPageContent, /priceSourceAutoCheckKey/)
    assert.match(costingWorkbenchPageContent, /async function refreshWorkbench\(\)[\s\S]*autoPriceSourceCheckedKey\.value = ''[\s\S]*ensurePriceSourceChecked\(\)/)
    assert.match(costingWorkbenchPageContent, /activeTab = ref\('PRODUCT_DETAIL'\)/)
    assert.match(costingWorkbenchPageContent, /resetTab/)
    assert.match(costingWorkbenchPageContent, /产品明细/)
    assert.match(costingWorkbenchPageContent, /BOM 层级树/)
    assert.match(costingWorkbenchPageContent, /loadBomTree/)
    assert.match(costingWorkbenchPageContent, /item\.materialNo/)
    assert.match(costingWorkbenchPageContent, /openBomNodeDetail/)
    assert.match(costingWorkbenchPageContent, /expandBomTree/)
    assert.match(costingWorkbenchPageContent, /collapseBomTree/)
    assert.match(costingWorkbenchPageContent, /报价物料明细/)
    assert.match(costingWorkbenchPageContent, /价格类型确认/)
    assert.match(costingWorkbenchPageContent, /价格准备/)
    assert.match(costingWorkbenchPageContent, /成本核算/)
    assert.match(costingWorkbenchPageContent, /tab\.code === 'PRODUCT_DETAIL'/)
    assert.match(costingWorkbenchPageContent, /isQuoteBomTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isPriceTypeTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isPricePrepareTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /isCostRunTab\(tab\.code\)/)
    assert.match(costingWorkbenchPageContent, /bomRows/)
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
    assert.doesNotMatch(costingWorkbenchPageContent, /workflow-strip/)
    assert.doesNotMatch(costingWorkbenchPageContent, /当前处理/)
    assert.match(costingWorkbenchPageContent, /STALE: '需更新'/)
    assert.doesNotMatch(costingWorkbenchPageContent, /已过期/)
  })

  it('QWB-08 工作台接入 BOM、价格类型、价格准备和成本核算主动作接口', () => {
    assert.match(quoteRequestApiContent, /confirmCostingBom/)
    assert.match(quoteRequestApiContent, /cancelCostingBomConfirm/)
    assert.match(quoteRequestApiContent, /fetchQuotePriceTypeConfirmation/)
    assert.match(quoteRequestApiContent, /importMissingPriceType/)
    assert.match(quoteRequestApiContent, /adjustPriceType/)
    assert.match(quoteRequestApiContent, /confirmPriceType/)
    assert.match(quoteRequestApiContent, /fetchQuotePricePrepare/)
    assert.match(quoteRequestApiContent, /generateQuotePricePrepare/)
    assert.match(quoteRequestApiContent, /fetchQuoteCostRun/)
    assert.match(quoteRequestApiContent, /trialQuoteCostRun/)
    assert.match(quoteRequestApiContent, /confirmQuoteCostRun/)
    assert.match(quoteRequestApiContent, /exportQuoteCostRunVersion/)
    assert.match(costingWorkbenchPageContent, /确认报价物料明细/)
    assert.match(costingWorkbenchPageContent, /撤销确认/)
    assert.match(costingWorkbenchPageContent, /去物料价格类型维护/)
    assert.match(costingWorkbenchPageContent, /openMaterialPriceTypePage/)
    assert.match(costingWorkbenchPageContent, /path: '\/base\/map'/)
    assert.match(costingWorkbenchPageContent, /调整类型/)
    assert.match(costingWorkbenchPageContent, /priceTypeDrawerMode\.value === 'IMPORT_MISSING'/)
    assert.match(costingWorkbenchPageContent, /importMissingPriceType\(oaNo\.value, itemId\.value/)
    assert.match(costingWorkbenchPageContent, /value-format="YYYY-MM"/)
    assert.match(costingWorkbenchPageContent, /确认价格类型/)
    assert.match(costingWorkbenchPageContent, /价格源维护/)
    assert.doesNotMatch(costingWorkbenchPageContent, /价格源补充/)
    assert.match(costingWorkbenchPageContent, /生成最终价格/)
    assert.match(costingWorkbenchPageContent, /最终价格已生成，可进入成本核算/)
    assert.match(costingWorkbenchPageContent, /前置条件检查/)
    assert.match(costingWorkbenchPageContent, /开始核算/)
    assert.match(costingWorkbenchPageContent, /确认核算/)
    assert.match(costingWorkbenchPageContent, /查看一览表/)
    assert.match(costingWorkbenchPageContent, /refreshAfterAction/)
    assert.match(costingWorkbenchPageContent, /const response = await trialQuoteCostRun/)
    assert.match(costingWorkbenchPageContent, /costRun\.value = response/)
    assert.match(costingWorkbenchPageContent, /isBlockedTab\(tab\)/)
  })

  it('T9 成本核算 Tab 使用成本版本表并按当前行打开一览表和底稿', () => {
    assert.match(costingWorkbenchPageContent, /costRunVersions/)
    assert.match(costingWorkbenchPageContent, /cost-version-table/)
    assert.match(costingWorkbenchPageContent, /row\.costRunNo/)
    assert.match(costingWorkbenchPageContent, /openCostRunDetail\(row\)/)
    assert.match(costingWorkbenchPageContent, /openCostRunTrace\(row\)/)
    assert.match(costingWorkbenchPageContent, /productCode,/)
    assert.match(costingWorkbenchPageContent, /materialCode: productCode/)
    assert.match(costingWorkbenchPageContent, /新试算待确认/)
    assert.doesNotMatch(costingWorkbenchPageContent, /当前可查看成本表/)
    assert.match(costRunDetailApiContent, /fetchCostRunTraces/)
    assert.match(costRunDetailApiContent, /\/api\/v1\/cost-run\/detail\/\$\{encodeURIComponent/)
    assert.match(costRunDetailApiContent, /\/traces/)
  })

  it('QWB-09 确认报价物料后自动引导到价格类型确认', () => {
    assert.match(costingWorkbenchPageContent, /guidePriceTypeAfterBomConfirm/)
    assert.match(costingWorkbenchPageContent, /await loadWorkbench\(\{ resetTab: false, loadChildren: true \}\)\s*\n\s*guidePriceTypeAfterBomConfirm\(\)/)
    assert.match(costingWorkbenchPageContent, /activeTab\.value = 'PRICE_TYPE_CONFIRMATION'/)
    assert.match(costingWorkbenchPageContent, /priceTypeFilter\.value = 'MISSING'/)
    assert.match(costingWorkbenchPageContent, /报价物料明细已确认，发现 \$\{missingTypeCount\} 项缺价格类型，请到“物料价格类型”导入或维护后再确认/)
    assert.match(costingWorkbenchPageContent, /workflowGuideVisible/)
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

  it('QCB-06 工作台 BOM 行支持抽屉替换料号、调整用量、取消、保存和失败提示', () => {
    assert.match(costingWorkbenchPageContent, /editingRowId/)
    assert.match(costingWorkbenchPageContent, /editDrawerVisible/)
    assert.match(costingWorkbenchPageContent, /替换子件料号 \/ 调整用量/)
    assert.match(costingWorkbenchPageContent, /替换\/调整/)
    assert.match(costingWorkbenchPageContent, /startEdit\(row\)/)
    assert.match(costingWorkbenchPageContent, /cancelEdit/)
    assert.match(costingWorkbenchPageContent, /saveBomRow\(editingRow\)/)
    assert.match(costingWorkbenchPageContent, /updateCostingBomRow/)
    assert.match(costingWorkbenchPageContent, /Object\.assign\(row,\s*saved\)/)
    assert.match(costingWorkbenchPageContent, /BOM 行已保存/)
    assert.match(costingWorkbenchPageContent, /保存 BOM 行失败/)
    assert.match(costingWorkbenchPageContent, /从料品库选择子件料号/)
    assert.match(costingWorkbenchPageContent, /本次核算用量/)
    assert.match(costingWorkbenchPageContent, /请输入有效用量/)
    assert.match(quoteRequestApiContent, /updateCostingBomRow/)
    assert.match(quoteRequestApiContent, /costing-bom\/rows\/\$\{encodePath\(rowId\)\}/)
    assert.match(quoteRequestApiContent, /method:\s*'PUT'/)
  })

  it('QCB-06 子件料号远程搜索选择后自动带出 U9 字段', () => {
    assert.match(costingWorkbenchPageContent, /fetchU9MaterialOptions/)
    assert.match(costingWorkbenchPageContent, /materialSearchKeyword/)
    assert.match(costingWorkbenchPageContent, /searchChildMaterials\(materialSearchKeyword\)/)
    assert.match(costingWorkbenchPageContent, /material-option-table/)
    assert.match(costingWorkbenchPageContent, /@row-dblclick="handleMaterialSelected"/)
    assert.match(costingWorkbenchPageContent, /handleMaterialSelected/)
    assert.match(costingWorkbenchPageContent, /选用/)
    assert.match(costingWorkbenchPageContent, /替换后料号/)
    assert.match(costingWorkbenchPageContent, /selected\.materialName/)
    assert.match(costingWorkbenchPageContent, /materialModelText\(selected\)/)
    assert.match(costingWorkbenchPageContent, /selected\.unit/)
    assert.match(costingWorkbenchPageContent, /selected\.materialAttribute/)
    assert.match(costingWorkbenchPageContent, /selected\.shapeAttribute/)
    assert.match(costingWorkbenchPageContent, /el-input-number/)
    assert.match(u9MaterialApiContent, /fetchU9MaterialOptions/)
    assert.match(u9MaterialApiContent, /\/options/)
  })
})
