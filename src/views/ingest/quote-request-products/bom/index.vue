<template>
  <section class="product-bom-page">
    <div class="page-head">
      <div>
        <h1>报价产品 BOM 准备</h1>
        <p>按报价产品行检查本体 BOM、包装参考、技术补录与财务审核结果，审核后可刷新结算行。</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Back" @click="goQuoteRequests">报价单接入</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
      </div>
    </div>

    <div class="filter-panel">
      <el-form :model="filters" label-width="94px">
        <div class="filter-grid">
          <el-form-item label="报价单号">
            <el-input v-model="filters.oaNo" clearable placeholder="OA-2026-001" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="客户">
            <el-input v-model="filters.customer" clearable placeholder="客户名称 / 编码" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="产品料号">
            <el-input v-model="filters.productCode" clearable placeholder="产品料号" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="裸品/非裸品">
            <el-select v-model="filters.productType" clearable placeholder="全部">
              <el-option
                v-for="item in PRODUCT_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="包装方式">
            <el-input v-model="filters.packageMethod" clearable placeholder="包装方式" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="技术员">
            <el-input v-model="filters.technicianName" clearable placeholder="技术员" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="技术处理">
            <el-select v-model="filters.needTechnicianTask" clearable placeholder="全部">
              <el-option label="需要" value="true" />
              <el-option label="不需要" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="财务审核">
            <el-select v-model="filters.reviewStatus" clearable placeholder="全部">
              <el-option
                v-for="item in REVIEW_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="BOM 状态">
            <el-select v-model="filters.bomStatuses" multiple collapse-tags clearable placeholder="默认待处理">
              <el-option
                v-for="item in BOM_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
            <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          </el-form-item>
        </div>
      </el-form>
    </div>

    <div class="toolbar">
      <div class="toolbar-meta">
        已选 {{ selectedRows.length }} 行，当前页 {{ rows.length }} 行，共 {{ total }} 行
      </div>
      <div class="toolbar-actions">
        <el-button
          v-hasPermi="['ingest:quote-product-bom-preparation:prepare', 'ingest:quote-product-bom:sync']"
          type="primary"
          :disabled="selectedRows.length === 0"
          :loading="batchPreparing"
          @click="handleBatchPrepare"
        >
          批量检查/准备
        </el-button>
        <el-button
          v-hasPermi="['ingest:quote-product-bom-preparation:create-task', 'ingest:quote-product-bom:oa-task']"
          type="warning"
          :disabled="selectedRows.length === 0"
          :loading="batchTasking"
          @click="handleBatchCreateTask"
        >
          批量推送 OA 待办
        </el-button>
      </div>
    </div>

    <el-table
      :data="rows"
      border
      stripe
      v-loading="loading"
      class="workbench-table"
      @selection-change="selectedRows = $event"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="oaNo" label="报价单号" min-width="160" show-overflow-tooltip />
      <el-table-column label="客户" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ displayCustomer(row) }}</template>
      </el-table-column>
      <el-table-column prop="productCode" label="产品料号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="productSpec" label="规格" min-width="140" show-overflow-tooltip />
      <el-table-column label="裸品/非裸品" width="118">
        <template #default="{ row }">
          <el-tag :type="statusTagType('productType', row.productType)" effect="plain">
            {{ statusLabel('productType', row.productType || 'UNKNOWN') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="packageMethod" label="包装方式" min-width="130" show-overflow-tooltip />
      <el-table-column prop="technicianName" label="技术员" width="110" show-overflow-tooltip />
      <el-table-column label="本体 BOM" width="110">
        <template #default="{ row }">
          <el-tag :type="row.bodyBomReady ? 'success' : 'warning'" effect="plain">
            {{ row.bodyBomReady ? '已准备' : '待准备' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="包装参考" width="120">
        <template #default="{ row }">
          <el-tag v-if="!row.needPackage" type="info" effect="plain">不需要</el-tag>
          <el-tag v-else :type="row.packageReferenceReady ? 'success' : 'warning'" effect="plain">
            {{ row.packageReferenceReady ? '已选择' : '待选择' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="技术处理" width="116">
        <template #default="{ row }">
          <el-tag :type="row.needTechnicianTask ? 'warning' : 'success'" effect="plain">
            {{ row.needTechnicianTask ? '需要' : '不需要' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="财务审核" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType('reviewStatus', row.reviewStatus)" effect="plain">
            {{ statusLabel('reviewStatus', row.reviewStatus || 'NOT_SUBMITTED') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="OA待办" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.oaTodoId || '-' }}</template>
      </el-table-column>
      <el-table-column label="推送状态" width="116">
        <template #default="{ row }">
          <el-tag :type="statusTagType('oaTodoPushStatus', row.oaTodoPushStatus || 'NOT_CREATED')" effect="plain">
            {{ statusLabel('oaTodoPushStatus', row.oaTodoPushStatus || 'NOT_CREATED') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="推送失败原因" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.oaTodoPushErrorMessage || '-' }}</template>
      </el-table-column>
      <el-table-column label="最近处理时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.oaTodoLastPushAt || row.lastHandledAt || row.syncAt) }}</template>
      </el-table-column>
      <el-table-column label="缺口说明" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ gapMessage(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button
              v-hasPermi="['ingest:quote-product-bom-preparation:prepare', 'ingest:quote-product-bom:sync']"
              link
              type="primary"
              :loading="actionLoadingId === actionKey(row, 'prepare')"
              @click="handlePrepare(row)"
            >
              检查/准备
            </el-button>
            <el-button
              v-hasPermi="['ingest:quote-product-bom-preparation:create-task', 'ingest:quote-product-bom:oa-task']"
              link
              type="warning"
              :disabled="!canCreateTask(row)"
              :loading="actionLoadingId === actionKey(row, 'task')"
              @click="handleCreateTask(row)"
            >
              {{ row.taskId ? '重推 OA' : '推送 OA' }}
            </el-button>
            <el-button
              v-hasPermi="['ingest:quote-product-bom-preparation:view-task', 'ingest:quote-product-bom:oa-task']"
              link
              type="primary"
              :disabled="!row.taskId"
              @click="goTask(row)"
            >
              查看任务
            </el-button>
            <el-button link type="primary" @click="openPreview(row)">完整预览</el-button>
            <el-button
              v-hasPermi="['ingest:quote-product-bom-preparation:build-costing']"
              link
              type="success"
              :disabled="!canBuildCosting(row)"
              :loading="actionLoadingId === actionKey(row, 'costing')"
              @click="handleBuildCosting(row)"
            >
              重新生成结算行
            </el-button>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无产品 BOM 准备数据" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="pageNo"
      v-model:page-size="pageSize"
      :total="total"
    />

    <el-drawer
      v-model="previewVisible"
      size="88%"
      :title="previewTitle"
      @closed="preview = null"
    >
      <div v-loading="previewLoading" class="drawer-body">
        <template v-if="preview">
          <section class="drawer-section">
            <div class="section-title">准备结果</div>
            <el-descriptions :column="4" border>
              <el-descriptions-item label="报价单号">{{ preview.oaNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="产品料号">{{ preview.quoteProductCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="产品形态">
                {{ statusLabel('productType', preview.productType || 'UNKNOWN') }}
              </el-descriptions-item>
              <el-descriptions-item label="期间">{{ preview.periodMonth || '-' }}</el-descriptions-item>
              <el-descriptions-item label="本体 BOM">{{ preview.bodyBomReady ? '已准备' : '待准备' }}</el-descriptions-item>
              <el-descriptions-item label="包装参考">
                {{ preview.needPackage ? (preview.packageReferenceReady ? '已选择' : '待选择') : '不需要' }}
              </el-descriptions-item>
              <el-descriptions-item label="财务审核">
                {{ statusLabel('reviewStatus', preview.reviewStatus || 'NOT_SUBMITTED') }}
              </el-descriptions-item>
              <el-descriptions-item label="技术处理">
                {{ preview.needTechnicianTask ? '需要' : '不需要' }}
              </el-descriptions-item>
              <el-descriptions-item label="缺口说明" :span="4">
                {{ previewGaps }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="drawer-section">
            <div class="section-title">本体 BOM 明细</div>
            <el-table :data="preview.bodyBomLines || []" size="small" border empty-text="暂无本体 BOM 明细">
              <el-table-column prop="lineNo" label="行号" width="70" />
              <el-table-column prop="level" label="层级" width="70" />
              <el-table-column prop="parentCode" label="母件" min-width="130" show-overflow-tooltip />
              <el-table-column prop="materialCode" label="子件料号" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialName" label="子件名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialSpec" label="规格" min-width="130" show-overflow-tooltip />
              <el-table-column prop="qtyPerParent" label="用量" width="110" />
              <el-table-column prop="qtyPerTop" label="累计用量" width="110" />
              <el-table-column prop="unit" label="单位" width="80" />
            </el-table>
          </section>

          <section class="drawer-section">
            <div class="section-title">包装参考明细</div>
            <el-table :data="preview.packageLines || []" size="small" border empty-text="暂无包装参考明细">
              <el-table-column prop="referenceFinishedCode" label="参考成品" min-width="140" show-overflow-tooltip />
              <el-table-column prop="sourceTopProductCode" label="来源顶层" min-width="140" show-overflow-tooltip />
              <el-table-column prop="packageParentCode" label="包装父件" min-width="140" show-overflow-tooltip />
              <el-table-column prop="packageMaterialCode" label="包装子件" min-width="150" show-overflow-tooltip />
              <el-table-column prop="packageMaterialName" label="子件名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="childQtyPerParent" label="子件用量" width="110" />
              <el-table-column prop="childQtyPerTop" label="子件累计" width="110" />
              <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
            </el-table>
          </section>
        </template>
      </div>
    </el-drawer>

    <el-dialog v-model="costingVisible" title="结算行生成结果" width="720px">
      <el-descriptions v-if="costingResult" :column="2" border>
        <el-descriptions-item label="生成批次">{{ costingResult.buildBatchId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="写入结算行">{{ costingResult.costingRowsWritten ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="来源追溯">{{ costingResult.sourceRefsWritten ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="子树引用">{{ costingResult.subtreeRequiredCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="产品料号">{{ costingResult.quoteProductCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ costingResult.periodMonth || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="costingWarnings"
        class="costing-warning"
        type="warning"
        :closable="false"
        :title="costingWarnings"
      />
      <template #footer>
        <el-button type="primary" @click="costingVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Refresh, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../../components/BasePagination.vue'
import {
  batchPrepareQuoteProductBom,
  buildQuoteProductBomCostingRows,
  createQuoteProductBomTasks,
  fetchQuoteProductBomPage,
  fetchQuoteProductBomPreparationPreview,
  prepareQuoteProductBom,
  pushQuoteProductBomOaTodo,
} from '../../../../api/quoteIngest'
import {
  BOM_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  formatDateTime,
  normalizeQuoteRequestPage,
  statusLabel,
  statusTagType,
} from '../../../../utils/quoteRequestWorkbench'

const router = useRouter()
const route = useRoute()

const defaultBomStatuses = ['NO_BOM', 'NOT_CHECKED', 'ENTRY_PENDING', 'ENTRY_IN_PROGRESS']
const filters = reactive({
  oaNo: String(route.query.oaNo || ''),
  customer: '',
  productCode: '',
  productType: '',
  packageMethod: '',
  technicianName: '',
  needTechnicianTask: '',
  reviewStatus: '',
  bomStatuses: [...defaultBomStatuses],
})

const loading = ref(false)
const batchPreparing = ref(false)
const batchTasking = ref(false)
const actionLoadingId = ref('')
const rows = ref([])
const selectedRows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)
const previewVisible = ref(false)
const previewLoading = ref(false)
const preview = ref(null)
const costingVisible = ref(false)
const costingResult = ref(null)

const previewTitle = computed(() => {
  const productCode = preview.value?.quoteProductCode || ''
  return productCode ? `完整 BOM 预览 ${productCode}` : '完整 BOM 预览'
})
const previewGaps = computed(() => {
  const gaps = [...(preview.value?.missingScopes || []), ...(preview.value?.gapMessages || [])].filter(Boolean)
  return gaps.length ? gaps.join('；') : '-'
})
const costingWarnings = computed(() => {
  const warnings = costingResult.value?.warnings || []
  return warnings.length ? warnings.join('；') : ''
})

async function loadRows() {
  loading.value = true
  try {
    const page = normalizeQuoteRequestPage(await fetchQuoteProductBomPage({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      oaNo: filters.oaNo,
      customer: filters.customer,
      productCode: filters.productCode,
      productType: filters.productType,
      packageMethod: filters.packageMethod,
      technicianName: filters.technicianName,
      needTechnicianTask: parseBooleanFilter(filters.needTechnicianTask),
      reviewStatus: filters.reviewStatus,
      bomStatuses: filters.bomStatuses,
    }))
    rows.value = page.list
    total.value = page.total
    selectedRows.value = []
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取产品 BOM 准备列表失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  pageNo.value = 1
  loadRows()
}

function resetFilters() {
  Object.assign(filters, {
    oaNo: '',
    customer: '',
    productCode: '',
    productType: '',
    packageMethod: '',
    technicianName: '',
    needTechnicianTask: '',
    reviewStatus: '',
    bomStatuses: [...defaultBomStatuses],
  })
  applyFilters()
}

async function handleBatchPrepare() {
  const ids = selectedIds()
  if (ids.length === 0) {
    ElMessage.warning('请选择需要准备的产品行')
    return
  }
  batchPreparing.value = true
  try {
    const result = await batchPrepareQuoteProductBom(ids)
    ElMessage.success(`准备完成：${result.readyCount || 0} 行就绪，${result.needTechnicianTaskCount || 0} 行需技术处理`)
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '批量检查/准备失败')
  } finally {
    batchPreparing.value = false
  }
}

async function handleBatchCreateTask() {
  const taskRows = selectedRows.value.filter(canCreateTask)
  if (taskRows.length === 0) {
    ElMessage.warning('请选择需要技术处理的产品行')
    return
  }
  batchTasking.value = true
  try {
    const result = await createQuoteProductBomTasks(taskRows.map((row) => row.oaFormItemId))
    const pushResults = await pushCreatedTasks(result?.tasks || [])
    const failed = pushResults.filter((item) => item?.pushStatus === 'FAILED').length
    ElMessage.success(`任务已创建/复用：${(result.createdTaskCount || 0) + (result.reusedTaskCount || 0)} 个，OA 待办已推送 ${pushResults.length - failed} 个`)
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '批量推送 OA 待办失败')
  } finally {
    batchTasking.value = false
  }
}

async function handlePrepare(row) {
  if (!row?.oaFormItemId) return
  actionLoadingId.value = actionKey(row, 'prepare')
  try {
    const result = await prepareQuoteProductBom(row.oaFormItemId)
    ElMessage.success(result?.ready ? 'BOM 准备完成' : 'BOM 准备已检查，仍需技术处理')
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '检查/准备 BOM 失败')
  } finally {
    actionLoadingId.value = ''
  }
}

async function handleCreateTask(row) {
  if (!canCreateTask(row)) return
  actionLoadingId.value = actionKey(row, 'task')
  try {
    const taskId = row.taskId || (await createQuoteProductBomTasks([row.oaFormItemId]))?.tasks?.[0]?.taskId
    if (!taskId) {
      throw new Error('未生成可推送的技术员任务')
    }
    const pushResult = await pushQuoteProductBomOaTodo(taskId)
    if (pushResult?.pushStatus === 'FAILED') {
      ElMessage.error(pushResult.pushErrorMessage || 'OA 待办推送失败')
    } else {
      ElMessage.success('OA 待办已推送')
    }
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '推送 OA 待办失败')
  } finally {
    actionLoadingId.value = ''
  }
}

async function pushCreatedTasks(taskLinks) {
  const taskIds = [...new Set((taskLinks || []).map((item) => item?.taskId).filter(Boolean))]
  const results = []
  for (const taskId of taskIds) {
    results.push(await pushQuoteProductBomOaTodo(taskId))
  }
  return results
}

async function openPreview(row) {
  if (!row?.oaFormItemId) return
  previewVisible.value = true
  previewLoading.value = true
  preview.value = null
  try {
    preview.value = await fetchQuoteProductBomPreparationPreview(row.oaFormItemId)
  } catch (error) {
    ElMessage.error(error?.message || '加载完整 BOM 预览失败')
  } finally {
    previewLoading.value = false
  }
}

async function handleBuildCosting(row) {
  if (!canBuildCosting(row)) return
  await ElMessageBox.confirm('重新生成会覆盖该报价产品本期间已有结算行和来源追溯。', '重新生成结算行', {
    type: 'warning',
    confirmButtonText: '生成',
    cancelButtonText: '取消',
  })
  actionLoadingId.value = actionKey(row, 'costing')
  try {
    costingResult.value = await buildQuoteProductBomCostingRows(row.oaFormItemId)
    costingVisible.value = true
    ElMessage.success(`结算行已生成：${costingResult.value?.costingRowsWritten || 0} 行`)
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '重新生成结算行失败')
  } finally {
    actionLoadingId.value = ''
  }
}

function goQuoteRequests() {
  router.push('/ingest/quote-requests')
}

function goTask(row) {
  if (!row?.taskId) return
  router.push({ path: '/bom-data/supplement-tasks', query: { taskId: row.taskId } })
}

function displayCustomer(row) {
  return row.customerName || row.customerCode || '-'
}

function gapMessage(row) {
  return row.errorMessage || row.taskNo || row.preparationStatus || '-'
}

function selectedIds() {
  return selectedRows.value.map((row) => row.oaFormItemId).filter(Boolean)
}

function canCreateTask(row) {
  return Boolean(row?.oaFormItemId && (row.needTechnicianTask || row.taskId) && row.reviewStatus !== 'APPROVED')
}

function canBuildCosting(row) {
  if (!row?.oaFormItemId) return false
  if (row.reviewStatus === 'APPROVED') return true
  return !row.taskId && Boolean(row.bodyBomReady || ['SYNCED', 'REUSED_CURRENT_MONTH', 'MANUAL_ENTERED'].includes(row.bomStatus))
}

function actionKey(row, action) {
  return `${row?.oaFormItemId || 'row'}:${action}`
}

function parseBooleanFilter(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

watch([pageNo, pageSize], () => {
  loadRows()
})

onMounted(loadRows)
</script>

<style scoped>
.product-bom-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-head h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2a37;
}

.page-head p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}

.head-actions,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filter-panel {
  padding: 16px 16px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(170px, 1fr));
  gap: 0 12px;
}

.filter-grid :deep(.el-select) {
  width: 100%;
}

.filter-actions {
  justify-content: flex-end;
}

.filter-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}

.toolbar {
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.toolbar-meta {
  color: #6b7280;
  font-size: 13px;
}

.workbench-table {
  width: 100%;
}

.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 8px;
}

.drawer-body {
  min-height: 360px;
}

.drawer-section {
  margin-bottom: 18px;
}

.section-title {
  margin-bottom: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.costing-warning {
  margin-top: 12px;
}

@media (max-width: 1280px) {
  .filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-head,
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions,
  .toolbar-actions {
    justify-content: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
