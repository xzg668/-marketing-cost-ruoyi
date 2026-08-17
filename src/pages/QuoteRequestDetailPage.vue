<template>
  <section class="quote-page" v-loading="loading">
    <div class="page-head">
      <div><h1>报价单详情</h1><p>{{ oaNo }}</p></div>
      <div class="page-actions">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <el-button type="primary" :loading="checking" @click="refreshCollaboration">刷新状态</el-button>
        <el-button v-if="canConfirmClassification(detail)" type="warning" @click="openConfirmDialog">确认分类</el-button>
      </div>
    </div>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="报价单号">{{ detail.oaNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="来源">{{ statusLabel('sourceType', detail.sourceType) }}</el-descriptions-item>
      <el-descriptions-item label="外部单号">{{ detail.externalFormNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程类型">{{ detail.processCode || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程名称">{{ detail.processName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报价场景">{{ statusLabel('quoteScenario', detail.quoteScenario) }}</el-descriptions-item>
      <el-descriptions-item label="客户名称">{{ detail.customer || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请日期">{{ detail.applyDate || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请单位">{{ detail.applicantUnit || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请部门">{{ detail.applicantDept || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请处室">{{ detail.applicantOffice || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请人">{{ detail.applicantName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="核算状态">
        <el-tag :type="statusTagType('calcStatus', detail.calcStatus || '未核算')" effect="plain">
          {{ statusLabel('calcStatus', detail.calcStatus || '未核算') }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="产品明细" name="items">
        <el-alert type="info" :closable="false" show-icon class="guide-alert">
          <template #title>系统已先查 U9，再判断是否需要补 BOM、补包装或补明细价格</template>
          每个产品只显示一个当前状态和一个下一步；同月已有任务只关联，半年有效结果直接复用。
        </el-alert>
        <div class="table-toolbar">
          <div class="table-toolbar__meta">已选择 {{ selectedItems.length }} 项</div>
          <el-button type="warning" :disabled="selectedItems.length === 0" :loading="tasking" @click="handleBatchSupplement">
            批量指定/发起补录
          </el-button>
        </div>
        <el-table
          ref="itemsTableRef"
          :data="detail.items || []"
          border
          row-key="id"
          class="items-table"
          :row-class-name="rowClassName"
          @selection-change="selectedItems = $event"
        >
          <el-table-column type="selection" width="48" fixed="left" :selectable="canBatchStartCollaboration" />
          <el-table-column label="产品" min-width="320" fixed="left">
            <template #default="{ row }">
              <div class="product-cell">
                <div><span class="product-seq">{{ row.seq }}</span><strong>{{ row.materialNo || '新品暂无料号' }}</strong></div>
                <div class="product-name">{{ row.productName || '-' }} · {{ row.sunlModel || row.spec || '-' }}</div>
                <div class="product-meta">
                  {{ row.businessType || '业务类型未填' }} · {{ packageText(row) }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="BOM状态" min-width="190">
            <template #default="{ row }">
              <el-tag :type="collaborationTagType(row.collaboration?.bomStatus)" effect="plain">
                {{ row.collaboration?.bomStatusLabel || '待检查' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="价格状态" min-width="170">
            <template #default="{ row }">
              <el-tag :type="collaborationTagType(row.collaboration?.priceStatus === 'READY' ? 'AVAILABLE' : row.collaboration?.currentStatus)" effect="plain">
                {{ row.collaboration?.priceStatusLabel || '待检查' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="处理人" min-width="120">
            <template #default="{ row }">{{ row.collaboration?.assigneeName || row.technicianName || '-' }}</template>
          </el-table-column>
          <el-table-column label="当前状态" min-width="160">
            <template #default="{ row }">
              <el-tag :type="collaborationTagType(row.collaboration?.currentStatus)" effect="plain">
                {{ row.collaboration?.currentStatusLabel || '待检查' }}
              </el-tag>
              <div v-if="row.collaboration?.message" class="state-message" :title="row.collaboration.message">
                {{ row.collaboration.message }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.collaboration?.actionEnabled"
                link
                :type="operationType(row.collaboration?.nextAction)"
                :loading="actionLoadingId === rowActionKey(row)"
                @click="handleRowAction(row)"
              >
                {{ row.collaboration?.nextActionLabel }}
              </el-button>
              <span v-else class="no-action">—</span>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无产品明细" /></template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="logs">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="流水 ID">{{ detail.ingestLog?.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求 ID">{{ detail.ingestLog?.requestId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="幂等键">{{ detail.ingestLog?.idempotencyKey || '-' }}</el-descriptions-item>
          <el-descriptions-item label="接入状态">{{ statusLabel('ingestStatus', detail.ingestLog?.ingestStatus) }}</el-descriptions-item>
          <el-descriptions-item label="接收时间">{{ formatDateTime(detail.ingestLog?.receivedAt) }}</el-descriptions-item>
          <el-descriptions-item label="处理时间">{{ formatDateTime(detail.ingestLog?.processedAt) }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyDialog.visible" title="补录内容与状态记录" width="720px">
      <el-descriptions :column="2" border class="history-summary">
        <el-descriptions-item label="产品任务">{{ historyDialog.data.productTaskNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="当前处理人">{{ historyDialog.data.assigneeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="当前状态" :span="2">{{ historyDialog.data.currentStatusLabel || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-timeline v-if="historyDialog.data.entries?.length">
        <el-timeline-item v-for="(entry, index) in historyDialog.data.entries" :key="`${entry.occurredAt}-${index}`" :timestamp="formatDateTime(entry.occurredAt)">
          <strong>{{ entry.title }}</strong><div class="history-description">{{ entry.description }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无变更记录" />
      <template #footer><el-button @click="historyDialog.visible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog
      v-model="assignmentDialog.visible"
      :title="assignmentDialog.rows.length > 1 ? '批量指定技术负责人' : '指定技术负责人'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-alert type="info" :closable="false" show-icon class="assignment-alert">
        <template #title>
          {{ assignmentDialog.rows.length > 1
            ? `将为 ${assignmentDialog.unresolvedCount} 个未匹配产品指定同一负责人`
            : '选择实际处理本产品的技术人员' }}
        </template>
        {{ assignmentDialog.message || '候选人只包含当前业务单元中有效的技术协作账号。' }}
      </el-alert>
      <el-form label-position="top" v-loading="assignmentDialog.loading">
        <el-form-item label="技术负责人" required>
          <el-select
            v-model="assignmentDialog.selectedUserId"
            filterable
            placeholder="请选择技术负责人"
            style="width: 100%"
            :disabled="assignmentDialog.candidates.length === 0"
          >
            <el-option
              v-for="candidate in assignmentDialog.candidates"
              :key="candidate.userId"
              :value="candidate.userId"
              :label="candidateLabel(candidate)"
            />
          </el-select>
        </el-form-item>
        <el-empty
          v-if="!assignmentDialog.loading && assignmentDialog.candidates.length === 0"
          :description="assignmentDialog.message || '暂无可选技术负责人'"
          :image-size="72"
        />
      </el-form>
      <template #footer>
        <el-button :disabled="assignmentDialog.submitting" @click="assignmentDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="assignmentDialog.submitting"
          :disabled="!assignmentDialog.selectedUserId"
          @click="submitTechnicianAssignment"
        >
          确定并发起补录
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="confirmDialog.visible" title="确认报价单分类" width="460px">
      <el-form :model="confirmDialog.form" label-width="96px">
        <el-form-item label="报价场景">
          <el-select v-model="confirmDialog.form.quoteScenario" placeholder="请选择报价场景">
            <el-option v-for="item in QUOTE_SCENARIO_OPTIONS.filter((option) => option.value !== 'UNKNOWN')" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="事业部类型"><el-input v-model="confirmDialog.form.businessUnitType" placeholder="COMMERCIAL" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="submitClassification">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  batchStartQuoteCollaboration,
  confirmQuoteRequestClassification,
  fetchQuoteCollaborationSummary,
  fetchQuoteCostRun,
  fetchQuoteItemCollaborationHistory,
  fetchQuoteRequestDetail,
  fetchQuoteTechnicianCandidates,
  launchQuoteCostingWorkbench,
  startQuoteItemCollaboration,
} from '../api/quoteRequests'
import {
  ASSIGN_TECHNICIAN_ACTION,
  buildCollaborationBatchStartItems,
  canBatchStartCollaboration,
  collaborationTagType,
  mergeCollaborationSummary,
  STARTABLE_COLLABORATION_ACTIONS,
} from '../utils/quoteCollaboration'
import {
  QUOTE_SCENARIO_OPTIONS,
  canConfirmClassification,
  formatDateTime,
  statusLabel,
  statusTagType,
} from '../utils/quoteRequestWorkbench'

const route = useRoute()
const router = useRouter()
const oaNo = computed(() => String(route.params.oaNo || ''))
const loading = ref(false)
const checking = ref(false)
const confirming = ref(false)
const tasking = ref(false)
const actionLoadingId = ref('')
const activeTab = ref('items')
const detail = ref({})
const selectedItems = ref([])
const itemsTableRef = ref()
const historyDialog = reactive({ visible: false, data: {} })
const assignmentDialog = reactive({
  visible: false,
  loading: false,
  submitting: false,
  rows: [],
  candidates: [],
  selectedUserId: null,
  unresolvedCount: 0,
  message: '',
})
const confirmDialog = reactive({ visible: false, form: { quoteScenario: '', businessUnitType: 'COMMERCIAL' } })

async function loadDetail() {
  if (!oaNo.value) return
  loading.value = true
  try {
    const [base, summary] = await Promise.all([
      fetchQuoteRequestDetail(oaNo.value),
      fetchQuoteCollaborationSummary(oaNo.value),
    ])
    detail.value = mergeCollaborationSummary(base, summary)
    selectedItems.value = []
    await locateReturnRow()
  } catch (error) {
    detail.value = {}
    ElMessage.error(error?.message || '获取报价单详情失败')
  } finally {
    loading.value = false
  }
}

async function refreshCollaboration(showMessage = true) {
  checking.value = true
  try {
    const summary = await fetchQuoteCollaborationSummary(oaNo.value)
    detail.value = mergeCollaborationSummary(detail.value, summary)
    selectedItems.value = []
    if (showMessage) ElMessage.success('产品状态已按 U9、协作任务和价格结果刷新')
  } catch (error) {
    ElMessage.error(error?.message || '刷新产品状态失败')
  } finally {
    checking.value = false
  }
}

function goBack() { router.push('/ingest/quote-requests') }
function openConfirmDialog() {
  confirmDialog.form.quoteScenario = detail.value.quoteScenario === 'UNKNOWN' ? '' : detail.value.quoteScenario || ''
  confirmDialog.form.businessUnitType = detail.value.businessUnitType || 'COMMERCIAL'
  confirmDialog.visible = true
}
async function submitClassification() {
  if (!confirmDialog.form.quoteScenario) return ElMessage.warning('请选择报价场景')
  confirming.value = true
  try {
    await confirmQuoteRequestClassification(oaNo.value, confirmDialog.form)
    confirmDialog.visible = false
    await loadDetail()
    ElMessage.success('分类已确认')
  } catch (error) { ElMessage.error(error?.message || '确认分类失败') }
  finally { confirming.value = false }
}

async function handleRowAction(row) {
  const action = row?.collaboration?.nextAction
  if (action === ASSIGN_TECHNICIAN_ACTION) return openTechnicianAssignment([row])
  if (STARTABLE_COLLABORATION_ACTIONS.has(action)) return startCollaboration(row)
  if (action === 'VIEW_SUPPLEMENT') return openHistory(row)
  if (action === 'START_COSTING') return startCosting(row)
  if (action === 'CONTINUE_COSTING') return continueCosting(row)
  if (action === 'VIEW_COSTING_RESULT') return viewCostingResult(row)
}
async function startCollaboration(row) {
  actionLoadingId.value = rowActionKey(row)
  try {
    const response = await startQuoteItemCollaboration(oaNo.value, row.id, {
      expectedProjectionVersion: row.collaboration?.projectionVersion,
    })
    await refreshCollaboration(false)
    ElMessage.success(response?.message || '协作状态已更新')
  } catch (error) { ElMessage.error(error?.message || '发起补录失败') }
  finally { actionLoadingId.value = '' }
}
async function handleBatchSupplement() {
  const rows = selectedItems.value.filter(canBatchStartCollaboration)
  if (!rows.length) return ElMessage.warning('请选择可发起补录的产品')
  if (rows.some(row => row.collaboration?.nextAction === ASSIGN_TECHNICIAN_ACTION)) {
    return openTechnicianAssignment(rows)
  }
  return executeBatchStart(rows)
}
async function executeBatchStart(rows, technicianUserId = null) {
  tasking.value = true
  try {
    const response = await batchStartQuoteCollaboration(oaNo.value, {
      items: buildCollaborationBatchStartItems(rows, technicianUserId),
    })
    await refreshCollaboration(false)
    if (response.failureCount) {
      const failureSummary = (response.results || [])
        .filter(result => !result.success)
        .slice(0, 2)
        .map(result => `${result.itemId || '未知产品'}：${result.message || '发起失败'}`)
        .join('；')
      ElMessage.warning(`成功 ${response.successCount} 项，失败 ${response.failureCount} 项${failureSummary ? `；${failureSummary}` : ''}`)
    }
    else ElMessage.success(`已处理 ${response.successCount} 项补录协作`)
  } catch (error) { ElMessage.error(error?.message || '批量发起补录失败') }
  finally { tasking.value = false }
}

async function openTechnicianAssignment(rows) {
  const unresolvedRows = rows.filter(row => row.collaboration?.nextAction === ASSIGN_TECHNICIAN_ACTION)
  const first = unresolvedRows[0]
  if (!first) return executeBatchStart(rows)
  assignmentDialog.visible = true
  assignmentDialog.loading = true
  assignmentDialog.rows = rows
  assignmentDialog.unresolvedCount = unresolvedRows.length
  assignmentDialog.candidates = []
  assignmentDialog.selectedUserId = null
  assignmentDialog.message = ''
  try {
    const response = await fetchQuoteTechnicianCandidates(oaNo.value, first.id)
    assignmentDialog.candidates = response?.candidates || []
    assignmentDialog.message = response?.message || ''
    const recommended = assignmentDialog.candidates.filter(candidate => candidate.recommended)
    if (recommended.length === 1) assignmentDialog.selectedUserId = recommended[0].userId
  } catch (error) {
    assignmentDialog.message = error?.message || '获取技术负责人失败'
    ElMessage.error(assignmentDialog.message)
  } finally {
    assignmentDialog.loading = false
  }
}

async function submitTechnicianAssignment() {
  if (!assignmentDialog.selectedUserId) return ElMessage.warning('请选择技术负责人')
  const rows = [...assignmentDialog.rows]
  assignmentDialog.submitting = true
  try {
    if (rows.length === 1) {
      const row = rows[0]
      const response = await startQuoteItemCollaboration(oaNo.value, row.id, {
        technicianUserId: assignmentDialog.selectedUserId,
        expectedProjectionVersion: row.collaboration?.projectionVersion,
      })
      await refreshCollaboration(false)
      assignmentDialog.visible = false
      ElMessage.success(response?.message || '已指定负责人并发起补录')
      return
    }
    assignmentDialog.visible = false
    await executeBatchStart(rows, assignmentDialog.selectedUserId)
  } catch (error) {
    ElMessage.error(error?.message || '指定技术负责人失败')
  } finally {
    assignmentDialog.submitting = false
  }
}
async function openHistory(row) {
  actionLoadingId.value = rowActionKey(row)
  try {
    historyDialog.data = await fetchQuoteItemCollaborationHistory(oaNo.value, row.id)
    historyDialog.visible = true
  } catch (error) { ElMessage.error(error?.message || '获取补录内容失败') }
  finally { actionLoadingId.value = '' }
}

function openCostingWorkbench(row, query = {}) {
  router.push({
    path: `/ingest/quote-requests/${encodeURIComponent(oaNo.value)}/items/${encodeURIComponent(row.id)}/costing`,
    query: { ...query, returnItemId: row.id },
  })
}
async function startCosting(row) {
  if (row?.collaboration?.nextAction !== 'START_COSTING') return ElMessage.warning('当前产品尚未具备核算条件')
  actionLoadingId.value = rowActionKey(row)
  try {
    const response = await launchQuoteCostingWorkbench(oaNo.value, row.id)
    if (response?.snapshotGenerated) ElMessage.success('已按最新结算规则刷新报价物料明细')
    openCostingWorkbench(row, { tab: 'QUOTE_BOM' })
  } catch (error) { ElMessage.error(error?.message || '发起核算失败') }
  finally { actionLoadingId.value = '' }
}
function continueCosting(row) { openCostingWorkbench(row, { tab: 'COST_RUN' }) }
async function viewCostingResult(row) {
  actionLoadingId.value = rowActionKey(row)
  try {
    const response = await fetchQuoteCostRun(oaNo.value, row.id, { versionId: row.confirmedCostVersionId || undefined })
    const versions = Array.isArray(response?.versions) ? response.versions : []
    const confirmedId = Number(row.confirmedCostVersionId)
    const displayVersion = [response?.currentDisplayVersion, response?.latestConfirmed, ...versions].find((version) => {
      if (!version?.costRunNo) return false
      return confirmedId > 0 ? Number(version.id) === confirmedId : version.currentConfirmed || version.status === 'CONFIRMED'
    })
    if (!displayVersion?.costRunNo && !hasCostingResult(row)) throw new Error('当前产品没有可查看的已确认核算版本')
    const header = response?.resultHeader || {}
    const productCode = header.productCode || row.materialNo
    const query = {
      customer: detail.value.customer || '', productName: header.productName || row.productName || '',
      productModel: header.productModel || row.sunlModel || row.spec || '', productCode, materialCode: productCode,
      customerDrawing: row.customerDrawing || '', costRunNo: displayVersion?.costRunNo,
      versionNo: displayVersion?.versionNo || displayVersion?.costRunNo || '历史核算结果', returnItemId: row.id,
    }
    if (!displayVersion?.costRunNo) query.legacyResult = '1'
    await router.push({
      name: 'cost-run-detail',
      params: { oaNo: oaNo.value },
      query,
    })
  } catch (error) { ElMessage.error(error?.message || '查看核算结果失败') }
  finally { actionLoadingId.value = '' }
}

function hasCostingResult(row) { return Boolean(row?.confirmedCostVersionId || row?.calcAt || row?.unitCost || row?.costAmount) }
function rowActionKey(row) { return `row:${row?.id || ''}` }
function packageText(row) { return [row.packageType, row.packageMethod, row.packageComponentCode].filter(Boolean).join(' / ') || '包装信息未填' }
function candidateLabel(candidate) {
  const identity = candidate.loginName && candidate.loginName !== candidate.userName ? `（${candidate.loginName}）` : ''
  return `${candidate.userName}${identity}${candidate.recommended ? ' · 系统推荐' : ''}`
}
function operationType(action) { return STARTABLE_COLLABORATION_ACTIONS.has(action) || action === ASSIGN_TECHNICIAN_ACTION ? 'warning' : 'primary' }
function rowClassName({ row }) { return String(route.query.itemId || '') === String(row.id) ? 'return-row' : '' }
async function locateReturnRow() {
  if (!route.query.itemId) return
  await nextTick()
  const row = detail.value.items?.find((item) => String(item.id) === String(route.query.itemId))
  if (row) itemsTableRef.value?.setCurrentRow?.(row)
}

watch(oaNo, loadDetail)
onMounted(loadDetail)
</script>

<style scoped>
.quote-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-head h1 { margin: 0; font-size: 20px; font-weight: 600; color: #1f2a37; }
.page-head p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.page-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-tabs { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.guide-alert { margin-bottom: 12px; }
.table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.table-toolbar__meta, .product-meta, .state-message, .history-description { color: #6b7280; font-size: 12px; }
.items-table { width: 100%; }
.product-cell { line-height: 1.55; }
.product-seq { display: inline-block; width: 28px; color: #9ca3af; }
.product-name { color: #374151; }
.state-message { margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.no-action { color: #9ca3af; }
.history-summary { margin-bottom: 20px; }
.assignment-alert { margin-bottom: 18px; }
:deep(.el-table .return-row > td) { background: #ecf5ff !important; }
@media (max-width: 860px) { .page-head { align-items: flex-start; flex-direction: column; } }
</style>
