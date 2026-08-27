<template>
  <section class="quote-page" v-loading="loading">
    <div class="page-head">
      <div><h1>报价单详情</h1><p>{{ oaNo }} · {{ detail.items?.length || 0 }} 个产品</p></div>
      <div class="page-actions">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <el-button :loading="checking" @click="refreshCollaboration">重新检查</el-button>
        <el-button v-if="canConfirmClassification(detail)" type="warning" @click="openConfirmDialog">确认分类</el-button>
        <el-button
          type="primary"
          :loading="batchSubmitting"
          :disabled="batchRun?.active"
          @click="submitWholeQuoteCosting"
        >
          {{ batchRun?.active ? '整单核算中' : '整单一键核算' }}
        </el-button>
      </div>
    </div>

    <div v-if="batchRun && batchRun.status !== 'NOT_STARTED'" class="batch-progress">
      <div class="batch-progress__head">
        <strong>整单核算进度</strong>
        <span>{{ batchStatusLabel(batchRun.status) }} · {{ batchRun.progress || 0 }}%</span>
      </div>
      <el-progress :percentage="batchRun.progress || 0" :show-text="false" :stroke-width="8" />
      <div class="batch-progress__counts">
        业务结果：{{ batchBusinessOutcomeLabel(batchRun.businessOutcome) }}；
        共 {{ batchRun.totalCount || 0 }} 项，成功 {{ batchRun.successCount || 0 }}，
        协作 {{ batchRun.collaborationCount || 0 }}，运行 {{ batchRun.runningCount || 0 }}，
        排队 {{ batchRun.queuedCount || 0 }}，跳过 {{ batchRun.skippedCurrentCount || 0 }}，
        失败 {{ batchRun.failedCount || 0 }}
      </div>
      <el-alert
        v-if="batchRun.message"
        class="batch-progress__error"
        type="error"
        :closable="false"
        show-icon
        :title="batchRun.message"
      />
    </div>

    <el-descriptions class="quote-summary" :column="3" border>
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
          <template #title>系统直接显示最近一次核算或协作任务保存的状态</template>
          打开页面不会逐个展开 BOM 和检查价格；核算任务完成后更新状态，每个产品只显示一个当前状态和一个下一步。
        </el-alert>
        <div class="table-toolbar">
          <div class="table-toolbar__meta">已选择 {{ selectedItems.length }} 项</div>
          <el-button type="warning" :disabled="selectedItems.length === 0" :loading="tasking" @click="handleBatchSupplement">
            批量发起协作
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
          <el-table-column label="序号" width="64" align="center" fixed="left">
            <template #default="{ row }">
              <span class="product-seq">{{ row.seq || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="产品料号" prop="materialNo" min-width="170" fixed="left">
            <template #default="{ row }">{{ row.materialNo || '新品暂无料号' }}</template>
          </el-table-column>
          <el-table-column label="产品名称" prop="productName" min-width="170">
            <template #default="{ row }">{{ row.productName || '未填写' }}</template>
          </el-table-column>
          <el-table-column label="三花型号" min-width="180">
            <template #default="{ row }">{{ row.sunlModel || row.spec || '未填写' }}</template>
          </el-table-column>
          <el-table-column label="客户图号" min-width="160">
            <template #default="{ row }">{{ row.customerDrawing || '未填写' }}</template>
          </el-table-column>
          <el-table-column label="业务类型" prop="businessType" min-width="110">
            <template #default="{ row }">{{ row.businessType || '未填写' }}</template>
          </el-table-column>
          <el-table-column label="包装类型" prop="packageType" min-width="120">
            <template #default="{ row }">{{ row.packageType || '-' }}</template>
          </el-table-column>
          <el-table-column label="包装方式" prop="packageMethod" min-width="140">
            <template #default="{ row }">{{ row.packageMethod || '-' }}</template>
          </el-table-column>
          <el-table-column label="包装组件" prop="packageComponentCode" min-width="140">
            <template #default="{ row }">{{ row.packageComponentCode || '-' }}</template>
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
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  v-if="row.collaboration?.actionEnabled"
                  link
                  :type="operationType(row.collaboration?.nextAction)"
                  :loading="actionLoadingId === rowActionKey(row)"
                  @click="handleRowAction(row)"
                >
                  {{ row.collaboration?.nextActionLabel }}
                </el-button>
                <el-button
                  v-if="hasHistoricalCostResult(row) && row.collaboration?.nextAction !== 'VIEW_COSTING_RESULT'"
                  link
                  type="primary"
                  :loading="costResultDialog.loading && costResultDialog.itemId === row.id"
                  @click="openCostResultHistory(row)"
                >
                  查看结果
                </el-button>
                <span v-if="!row.collaboration?.actionEnabled && !hasHistoricalCostResult(row)" class="no-action">—</span>
              </div>
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
      <template #footer>
        <el-button
          v-if="historyDialog.data.productTaskId"
          type="primary"
          :loading="historyDialog.creatingLink"
          @click="createPortalLink"
        >复制技术协作链接</el-button>
        <el-button @click="historyDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="costResultDialog.visible"
      title="成本结果"
      width="1120px"
      class="cost-result-dialog"
      destroy-on-close
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="cost-result-guide"
        title="原报价结果、月度调价结果分别保存；月度调价不会覆盖原报价，当前重新核算也不在这里冒充历史结果。"
      />
      <div v-loading="costResultDialog.loading" class="cost-result-layout">
        <el-table
          :data="costResultDialog.data.results || []"
          border
          highlight-current-row
          row-key="historyKey"
          class="cost-result-list"
          @row-click="selectCostResult"
        >
          <el-table-column label="结果类型" width="150">
            <template #default="{ row }">
              <el-tag :type="row.resultType === 'QUOTE_COST' ? 'success' : 'warning'" effect="plain">
                {{ row.resultTypeLabel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="periodMonth" label="核算月份" width="110" />
          <el-table-column prop="resultNo" label="结果编号" min-width="210" show-overflow-tooltip />
          <el-table-column label="总成本" width="130" align="right">
            <template #default="{ row }">{{ formatCostAmount(row.totalCost) }}</template>
          </el-table-column>
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="selectCostResult(row)">查看</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无可查看的成本结果" /></template>
        </el-table>

        <template v-if="costResultDialog.selected">
          <div class="cost-result-section-head">
            <div>
              <strong>{{ costResultDialog.selected.resultTypeLabel }}</strong>
              <span>{{ costResultDialog.selected.periodMonth || '-' }} · {{ costResultDialog.selected.resultNo || '-' }}</span>
            </div>
            <el-button
              v-if="costResultDialog.selected.resultType === 'QUOTE_COST'"
              type="primary"
              :disabled="!costResultDialog.selected.versionId"
              @click="openSelectedQuoteCostResult"
            >
              查看完整成本表
            </el-button>
          </div>

          <el-descriptions :column="4" border class="cost-result-summary">
            <el-descriptions-item label="结果类型">{{ costResultDialog.selected.resultTypeLabel }}</el-descriptions-item>
            <el-descriptions-item label="核算月份">{{ costResultDialog.selected.periodMonth || '-' }}</el-descriptions-item>
            <el-descriptions-item label="结果状态">{{ costResultStatusLabel(costResultDialog.selected.status) }}</el-descriptions-item>
            <el-descriptions-item label="总成本">{{ formatCostAmount(costResultDialog.selected.totalCost) }}</el-descriptions-item>
            <template v-if="costResultDialog.selected.resultType === 'MONTHLY_REPRICE'">
              <el-descriptions-item label="材料费">{{ formatCostAmount(costResultDialog.selected.materialCost) }}</el-descriptions-item>
              <el-descriptions-item label="人工费">{{ formatCostAmount(costResultDialog.selected.laborCost) }}</el-descriptions-item>
              <el-descriptions-item label="辅料费">{{ formatCostAmount(costResultDialog.selected.auxiliaryCost) }}</el-descriptions-item>
              <el-descriptions-item label="制造费用">{{ formatCostAmount(costResultDialog.selected.manufacturingCost) }}</el-descriptions-item>
              <el-descriptions-item label="管理费用">{{ formatCostAmount(costResultDialog.selected.managementCost) }}</el-descriptions-item>
              <el-descriptions-item label="销售费用">{{ formatCostAmount(costResultDialog.selected.salesCost) }}</el-descriptions-item>
              <el-descriptions-item label="财务费用">{{ formatCostAmount(costResultDialog.selected.financeCost) }}</el-descriptions-item>
            </template>
          </el-descriptions>

          <template v-if="costResultDialog.selected.resultType === 'MONTHLY_REPRICE'">
            <div v-loading="costResultDialog.detailLoading" class="monthly-result-detail">
              <h3>月度调价部品明细</h3>
              <el-table :data="costResultDialog.monthlyDetail.partItems || []" border stripe max-height="300">
                <el-table-column prop="lineNo" label="行号" width="70" />
                <el-table-column prop="partCode" label="部品料号" min-width="150" show-overflow-tooltip />
                <el-table-column prop="partName" label="部品名称" min-width="150" show-overflow-tooltip />
                <el-table-column prop="quantity" label="数量" width="100" align="right" />
                <el-table-column label="单价" width="110" align="right"><template #default="{ row }">{{ formatCostAmount(row.unitPrice) }}</template></el-table-column>
                <el-table-column label="金额" width="120" align="right"><template #default="{ row }">{{ formatCostAmount(row.amount) }}</template></el-table-column>
                <el-table-column prop="priceSource" label="价格来源" min-width="150" show-overflow-tooltip />
              </el-table>
              <h3>月度调价费用明细</h3>
              <el-table :data="costResultDialog.monthlyDetail.costItems || []" border stripe max-height="260">
                <el-table-column prop="lineNo" label="行号" width="70" />
                <el-table-column prop="costItemName" label="费用项" min-width="160" show-overflow-tooltip />
                <el-table-column label="基数" width="120" align="right"><template #default="{ row }">{{ formatCostAmount(row.baseAmount) }}</template></el-table-column>
                <el-table-column prop="rate" label="费率" width="100" align="right" />
                <el-table-column label="金额" width="120" align="right"><template #default="{ row }">{{ formatCostAmount(row.amount) }}</template></el-table-column>
                <el-table-column prop="calcFormula" label="计算公式" min-width="220" show-overflow-tooltip />
              </el-table>
            </div>
          </template>
          <el-alert
            v-else
            type="success"
            :closable="false"
            show-icon
            title="这是报价核算时保存的结果；点击“查看完整成本表”会按该历史版本打开，不会跳到当前月份。"
          />
        </template>
      </div>
      <template #footer><el-button @click="costResultDialog.visible = false">关闭</el-button></template>
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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  batchStartQuoteCollaboration,
  confirmQuoteRequestClassification,
  createCollaborationPortalAccessLink,
  fetchQuoteItemCollaborationHistory,
  fetchQuoteCollaborationSummary,
  fetchQuoteCostResultHistory,
  fetchQuoteMonthlyCostResultDetail,
  fetchCurrentQuoteBatchCostRun,
  fetchQuoteRequestDetail,
  fetchQuoteTechnicianCandidates,
  refreshQuoteCollaborationSummary,
  scanQuoteItemCollaboration,
  startQuoteItemCollaboration,
  submitQuoteProductCostRun,
  submitQuoteBatchCostRun,
} from '../api/quoteRequests'
import {
  ASSIGN_TECHNICIAN_ACTION,
  buildCollaborationBatchStartItems,
  buildStoredCollaborationSummary,
  canBatchStartCollaboration,
  collaborationTagType,
  mergeCollaborationItems,
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
const batchSubmitting = ref(false)
const batchRun = ref(null)
const confirming = ref(false)
const tasking = ref(false)
const actionLoadingId = ref('')
const activeTab = ref('items')
const detail = ref({})
const selectedItems = ref([])
const itemsTableRef = ref()
const historyDialog = reactive({ visible: false, creatingLink: false, data: {} })
const costResultDialog = reactive({
  visible: false,
  loading: false,
  detailLoading: false,
  itemId: null,
  row: null,
  data: { results: [] },
  selected: null,
  monthlyDetail: { partItems: [], costItems: [] },
})
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
let batchPollTimer = null

async function loadDetail() {
  if (!oaNo.value) return
  const requestedOaNo = oaNo.value
  loading.value = true
  try {
    const base = await fetchQuoteRequestDetail(requestedOaNo)
    if (requestedOaNo !== oaNo.value) return
    detail.value = mergeCollaborationSummary(base, buildStoredCollaborationSummary(base))
    loading.value = false
    selectedItems.value = []
    await locateReturnRow()
    const [summaryResult] = await Promise.allSettled([
      fetchQuoteCollaborationSummary(requestedOaNo),
      loadBatchProgress(),
    ])
    if (requestedOaNo === oaNo.value && summaryResult.status === 'fulfilled') {
      detail.value = mergeCollaborationSummary(detail.value, summaryResult.value)
    }
  } catch (error) {
    detail.value = {}
    ElMessage.error(error?.message || '获取报价单详情失败')
  } finally {
    loading.value = false
  }
}

async function submitWholeQuoteCosting() {
  batchSubmitting.value = true
  try {
    batchRun.value = await submitQuoteBatchCostRun(oaNo.value, { mode: 'ALL' })
    ElMessage.success(`整单核算已提交，共 ${batchRun.value?.totalCount || 0} 个产品`)
    scheduleBatchPoll()
  } catch (error) {
    ElMessage.error(error?.message || '整单核算提交失败')
  } finally {
    batchSubmitting.value = false
  }
}

async function loadBatchProgress() {
  stopBatchPoll()
  if (!oaNo.value) return
  try {
    batchRun.value = await fetchCurrentQuoteBatchCostRun(oaNo.value)
    scheduleBatchPoll()
  } catch {
    batchRun.value = null
  }
}

function scheduleBatchPoll() {
  stopBatchPoll()
  if (!batchRun.value?.active) return
  batchPollTimer = window.setTimeout(pollBatchProgress, 2000)
}

async function pollBatchProgress() {
  const requestedOaNo = oaNo.value
  try {
    const next = await fetchCurrentQuoteBatchCostRun(requestedOaNo)
    if (requestedOaNo !== oaNo.value) return
    const finished = batchRun.value?.active && !next?.active
    batchRun.value = next
    if (finished) {
      if (next?.businessOutcome === 'WAITING_INPUT') {
        ElMessage.warning('整单处理结束，但产品仍在等待业务资料补齐')
      } else if (next?.businessOutcome === 'PARTIAL_SUCCESS') {
        ElMessage.warning('整单仅部分产品核算成功，请处理协作或失败项')
      } else if (next?.status === 'FAILED') {
        ElMessage.error(next.message || '整单核算执行失败，请处理后重新发起')
      } else if (next?.status === 'PARTIAL_FAILED') {
        ElMessage.warning(next.message || '整单核算已完成，但存在失败项')
      }
      const summaryPromise = fetchQuoteCollaborationSummary(requestedOaNo)
      const base = await fetchQuoteRequestDetail(requestedOaNo)
      if (requestedOaNo === oaNo.value) {
        detail.value = mergeCollaborationSummary(base, buildStoredCollaborationSummary(base))
      }
      const summary = await summaryPromise
      if (requestedOaNo === oaNo.value) {
        detail.value = mergeCollaborationSummary(detail.value, summary)
      }
    }
  } catch {
    // 短轮询失败不打断用户；下一次进入页面仍可读取持久化进度。
  } finally {
    scheduleBatchPoll()
  }
}

function stopBatchPoll() {
  if (batchPollTimer !== null) {
    window.clearTimeout(batchPollTimer)
    batchPollTimer = null
  }
}

function batchBusinessOutcomeLabel(outcome) {
  return ({
    NOT_STARTED: '未开始',
    IN_PROGRESS: '处理中',
    SUCCESS: '全部成功',
    WAITING_INPUT: '等待资料',
    PARTIAL_SUCCESS: '部分成功',
    FAILED: '失败',
    CANCELED: '已取消',
  })[outcome] || outcome || '待确认'
}

function batchStatusLabel(status) {
  return ({
    PENDING: '等待执行',
    RUNNING: '核算中',
    SUCCESS: '处理完成',
    PARTIAL_FAILED: '部分失败',
    FAILED: '执行失败',
    CANCELED: '已取消',
  })[status] || status || '未开始'
}

async function refreshCollaboration(showMessage = true) {
  checking.value = true
  try {
    const summary = await refreshQuoteCollaborationSummary(oaNo.value)
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
  if (needsAuthoritativeProjection(row)) {
    actionLoadingId.value = rowActionKey(row)
    try {
      row.collaboration = await scanQuoteItemCollaboration(oaNo.value, row.id)
    } catch (error) {
      ElMessage.error(error?.message || '刷新产品状态失败')
      return
    } finally {
      actionLoadingId.value = ''
    }
  }
  const action = row?.collaboration?.nextAction
  if (action === ASSIGN_TECHNICIAN_ACTION) return openTechnicianAssignment([row])
  if (STARTABLE_COLLABORATION_ACTIONS.has(action)) return startCollaboration(row)
  if (action === 'VIEW_SUPPLEMENT') return openHistory(row)
  if (action === 'START_COSTING') return startCosting(row)
  if (action === 'RESTART_COSTING') return restartCosting(row)
  if (action === 'RETRY_COSTING') return submitSingleProductCosting(row, 'RETRY')
  if (action === 'VIEW_COSTING_RESULT') return openCostResultHistory(row)
  if (action === 'VIEW_COSTING_PROGRESS') return openCostingWorkbench(row, { tab: 'COST_RUN' })
  if (action === 'VIEW_COSTING_GAP') return openCostingGap(row)
}
async function startCollaboration(row) {
  actionLoadingId.value = rowActionKey(row)
  try {
    const response = await startQuoteItemCollaboration(oaNo.value, row.id, {
      expectedProjectionVersion: row.collaboration?.projectionVersion,
    })
    applyCollaborationProjections([response?.item])
    ElMessage.success(response?.message || '协作状态已更新')
  } catch (error) { ElMessage.error(error?.message || '发起补录失败') }
  finally { actionLoadingId.value = '' }
}
async function handleBatchSupplement() {
  let rows = selectedItems.value.filter(canBatchStartCollaboration)
  if (!rows.length) return ElMessage.warning('请选择可发起协作的产品')
  const staleRows = rows.filter(needsAuthoritativeProjection)
  if (staleRows.length) {
    tasking.value = true
    try {
      const projections = await Promise.all(staleRows.map(row =>
        scanQuoteItemCollaboration(oaNo.value, row.id)))
      staleRows.forEach((row, index) => { row.collaboration = projections[index] })
      rows = selectedItems.value.filter(canBatchStartCollaboration)
    } catch (error) {
      ElMessage.error(error?.message || '刷新所选产品状态失败')
      return
    } finally {
      tasking.value = false
    }
  }
  if (!rows.length) return ElMessage.info('所选产品状态已更新，无需重复发起协作')
  if (rows.some(row => row.collaboration?.nextAction === ASSIGN_TECHNICIAN_ACTION)) {
    return openTechnicianAssignment(rows)
  }
  return executeBatchStart(rows)
}

function needsAuthoritativeProjection(row) {
  const action = row?.collaboration?.nextAction
  return !row?.collaboration?.projectionVersion
    && (action === ASSIGN_TECHNICIAN_ACTION || STARTABLE_COLLABORATION_ACTIONS.has(action))
}
async function executeBatchStart(rows, technicianUserId = null) {
  tasking.value = true
  try {
    const response = await batchStartQuoteCollaboration(oaNo.value, {
      items: buildCollaborationBatchStartItems(rows, technicianUserId),
    })
    applyCollaborationProjections(
      (response.results || []).filter((result) => result.success).map((result) => result.item),
    )
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
      applyCollaborationProjections([response?.item])
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

async function createPortalLink() {
  const taskId = historyDialog.data?.productTaskId
  if (!taskId) return ElMessage.warning('当前没有可生成链接的协作任务')
  historyDialog.creatingLink = true
  try {
    const result = await createCollaborationPortalAccessLink(taskId)
    const url = result?.accessUrl || ''
    if (!url) throw new Error('服务端没有返回协作链接')
    try {
      await navigator.clipboard.writeText(url)
      ElMessage.success('技术协作链接已复制，可放入 OA 待办')
    } catch {
      await ElMessageBox.alert(url, '技术协作链接', {
        confirmButtonText: '关闭',
        customClass: 'collaboration-link-dialog',
      })
    }
  } catch (error) {
    ElMessage.error(error?.message || '生成技术协作链接失败')
  } finally {
    historyDialog.creatingLink = false
  }
}

function hasHistoricalCostResult(row) {
  return Boolean(row?.confirmedCostVersionId || row?.calcAt || row?.calcStatus === '已核算')
}

async function openCostResultHistory(row) {
  costResultDialog.visible = true
  costResultDialog.loading = true
  costResultDialog.itemId = row?.id || null
  costResultDialog.row = row || null
  costResultDialog.data = { results: [] }
  costResultDialog.selected = null
  costResultDialog.monthlyDetail = { partItems: [], costItems: [] }
  try {
    const response = await fetchQuoteCostResultHistory(oaNo.value, row.id)
    const results = (response?.results || []).map((result) => ({
      ...result,
      historyKey: `${result.resultType}-${result.sourceId}`,
    }))
    costResultDialog.data = { ...response, results }
    const selected = results.find((result) => result.defaultResult) || results[0] || null
    if (selected) await selectCostResult(selected)
  } catch (error) {
    ElMessage.error(error?.message || '获取成本结果失败')
  } finally {
    costResultDialog.loading = false
  }
}

async function selectCostResult(result) {
  costResultDialog.selected = result || null
  costResultDialog.monthlyDetail = { partItems: [], costItems: [] }
  if (result?.resultType !== 'MONTHLY_REPRICE' || !result?.sourceId) return
  costResultDialog.detailLoading = true
  try {
    costResultDialog.monthlyDetail = await fetchQuoteMonthlyCostResultDetail(
      oaNo.value,
      costResultDialog.itemId,
      result.sourceId,
    ) || { partItems: [], costItems: [] }
  } catch (error) {
    ElMessage.error(error?.message || '获取月度调价明细失败')
  } finally {
    costResultDialog.detailLoading = false
  }
}

function openSelectedQuoteCostResult() {
  const selected = costResultDialog.selected
  if (!selected?.versionId || !costResultDialog.row) return
  costResultDialog.visible = false
  openCostingWorkbench(costResultDialog.row, {
    tab: 'COST_RUN',
    versionId: selected.versionId,
    historyResult: 'quote',
    historyResultKind: selected.resultTypeLabel === '报价重新核算结果' ? 'recalculation' : 'original',
  })
}

function formatCostAmount(value) {
  if (value === null || value === undefined || value === '') return '-'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 6 })
    : value
}

function costResultStatusLabel(status) {
  return ({ HISTORY: '历史有效', SUCCESS: '核算成功', CONFIRMED: '已审批发布' })[String(status || '').toUpperCase()] || status || '-'
}

function openCostingWorkbench(row, query = {}) {
  router.push({
    path: `/ingest/quote-requests/${encodeURIComponent(oaNo.value)}/items/${encodeURIComponent(row.id)}/costing`,
    query: { ...query, returnItemId: row.id },
  })
}
async function startCosting(row) {
  if (row?.collaboration?.nextAction !== 'START_COSTING') return ElMessage.warning('当前产品尚未具备核算条件')
  return submitSingleProductCosting(row, 'USER_REQUEST')
}
async function restartCosting(row) {
  if (row?.collaboration?.nextAction !== 'RESTART_COSTING') return ElMessage.warning('当前产品无需重新核算')
  return submitSingleProductCosting(row, 'INPUT_CHANGED')
}
async function submitSingleProductCosting(row, reason) {
  actionLoadingId.value = rowActionKey(row)
  try {
    const result = await submitQuoteProductCostRun(oaNo.value, row.id, {
      reason,
    })
    if (result?.pipelineStatus === 'SUCCESS') {
      ElMessage.success(result.reusedSuccess ? '当前结果已是最新，无需重复核算' : '本产品核算完成')
      openCostingWorkbench(row, { tab: 'COST_RUN' })
      return
    }
    if (result?.pipelineStatus === 'BLOCKED') {
      ElMessage.warning(result.message || '核算资料存在缺口，请按提示处理')
      openCostingWorkbench(row, {
        tab: costingStepTab(result.currentStep, result.errorCode),
        guide: 'costing-input-gap',
      })
      return
    }
    ElMessage.error(result?.message || '本产品核算失败，请重试')
    openCostingWorkbench(row, {
      tab: costingStepTab(result?.currentStep, result?.errorCode),
      guide: 'costing-input-gap',
    })
  } catch (error) { ElMessage.error(error?.message || '本产品核算失败') }
  finally { actionLoadingId.value = '' }
}

function applyCollaborationProjections(projections) {
  detail.value = mergeCollaborationItems(detail.value, projections)
  selectedItems.value = []
  itemsTableRef.value?.clearSelection()
}
function openCostingGap(row) {
  openCostingWorkbench(row, {
    tab: costingStepTab(
      row?.costingWorkspace?.currentStep,
      row?.costingWorkspace?.lastErrorCode,
    ),
    guide: 'costing-input-gap',
  })
}
function costingStepTab(step, errorCode = '') {
  const normalized = String(step || '').toUpperCase()
  if (String(errorCode || '').toUpperCase() === 'FINANCE_BASE_PRICE_MISSING') return 'PRICE_PREPARE'
  if (normalized === 'PRICE_TYPE_CONFIRMATION') return 'PRICE_TYPE_CONFIRMATION'
  if (normalized === 'PRICE_PREPARE') return 'PRICE_SOURCE_SUPPLEMENT'
  if (normalized === 'COST_RUN') return 'COST_RUN'
  return 'PRODUCT_DETAIL'
}
function rowActionKey(row) { return `row:${row?.id || ''}` }
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
onUnmounted(stopBatchPoll)
</script>

<style scoped>
.quote-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #2f343d;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
  background: #ffffff;
}

.page-head h1 {
  margin: 0;
  color: #182230;
  font-size: 21px;
  font-weight: 700;
}

.page-head p {
  margin: 6px 0 0;
  color: #697386;
  font-size: 13px;
}

.page-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-progress {
  padding: 16px 18px;
  border: 1px solid #d8e5f3;
  border-radius: 10px;
  background: #f6faff;
}

.batch-progress__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #344054;
}

.batch-progress__counts {
  margin-top: 10px;
  color: #667085;
  font-size: 13px;
}

.batch-progress__error {
  margin-top: 12px;
}

.quote-summary {
  overflow: hidden;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
  background: #ffffff;
}

.quote-summary :deep(.el-descriptions__label) {
  color: #667085;
  font-weight: 600;
  background: #f8fafc !important;
}

.quote-summary :deep(.el-descriptions__content) {
  color: #344054;
}

.detail-tabs {
  padding: 0 18px 18px;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
  background: #ffffff;
}

.detail-tabs :deep(.el-tabs__header) {
  margin: 0 -18px 16px;
  padding: 0 18px;
  border-bottom: 1px solid #e4e9f1;
  background: #fbfcfe;
}

.detail-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.detail-tabs :deep(.el-tabs__item) {
  height: 50px;
  padding: 0 20px;
  color: #667085;
  font-weight: 600;
}

.detail-tabs :deep(.el-tabs__item.is-active) {
  color: #1f66b1;
}

.detail-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: #2f7dcc;
}

.guide-alert {
  margin-bottom: 14px;
  border-radius: 8px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.table-toolbar__meta,
.state-message,
.history-description {
  color: #697386;
  font-size: 12px;
}

.items-table {
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
}

.items-table :deep(th.el-table__cell) {
  height: 46px;
  color: #475467;
  font-weight: 650;
  background: #f8fafc;
}

.items-table :deep(td.el-table__cell) {
  padding: 11px 0;
}

.product-seq {
  color: #667085;
  font-variant-numeric: tabular-nums;
}

.state-message {
  max-width: 320px;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-action {
  color: #98a2b3;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cost-result-guide,
.cost-result-list,
.cost-result-summary {
  margin-bottom: 16px;
}

.cost-result-layout {
  min-height: 220px;
}

.cost-result-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 18px 0 12px;
}

.cost-result-section-head div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cost-result-section-head span {
  color: #697386;
  font-size: 13px;
}

.monthly-result-detail h3 {
  margin: 18px 0 10px;
  color: #344054;
  font-size: 15px;
}

.history-summary {
  margin-bottom: 20px;
}

.assignment-alert {
  margin-bottom: 18px;
}

:deep(.el-table .return-row > td) {
  background: #eef6ff !important;
}

@media (max-width: 860px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
