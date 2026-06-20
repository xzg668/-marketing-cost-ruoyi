<template>
  <section class="quote-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h1>报价单详情</h1>
        <p>{{ oaNo }}</p>
      </div>
      <div class="page-actions">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <el-button type="primary" :loading="checking" @click="handleCheckBom">检查 BOM</el-button>
        <el-button v-if="canConfirmClassification(detail)" type="warning" @click="openConfirmDialog">
          确认分类
        </el-button>
      </div>
    </div>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="报价单号">{{ detail.oaNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="来源">
        {{ statusLabel('sourceType', detail.sourceType) }}
      </el-descriptions-item>
      <el-descriptions-item label="外部单号">{{ detail.externalFormNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程类型">{{ detail.processCode || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程名称">{{ detail.processName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报价场景">
        {{ statusLabel('quoteScenario', detail.quoteScenario) }}
      </el-descriptions-item>
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
        <div class="table-toolbar">
          <div class="table-toolbar__meta">已选择 {{ selectedItems.length }} 行</div>
          <el-button
            type="warning"
            :disabled="selectedItems.length === 0"
            :loading="tasking"
            @click="handleBatchSupplement"
          >
            批量发起补录
          </el-button>
        </div>
        <el-table
          :data="detail.items || []"
          border
          stripe
          row-key="id"
          class="items-table"
          @selection-change="selectedItems = $event"
        >
          <el-table-column type="selection" width="48" fixed="left" :selectable="canSelectForSupplement" />
          <el-table-column prop="seq" label="行号" width="72" fixed="left" />
          <el-table-column prop="materialNo" label="产品料号" min-width="160" fixed="left" show-overflow-tooltip />
          <el-table-column label="BOM 状态" width="180" fixed="left">
            <template #default="{ row }">
              <el-tag :type="statusTagType('bomStatus', row.bomStatus?.bomStatus)" effect="plain">
                {{ statusLabel('bomStatus', row.bomStatus?.bomStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="sunlModel" label="三花型号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="businessType" label="业务类型" width="130" />
          <el-table-column prop="packageType" label="包装类型" width="120" />
          <el-table-column prop="packageMethod" label="包装方式" width="120" />
          <el-table-column prop="packageComponentCode" label="包装组件" min-width="140" />
          <el-table-column prop="shippingFee" label="运费" width="100" />
          <el-table-column prop="annualVolume" label="预计年用量" width="120" />
          <el-table-column prop="totalWithShip" label="含运费总价" width="120" />
          <el-table-column prop="totalNoShip" label="不含运费总价" width="130" />
          <el-table-column prop="technicianName" label="技术员" width="120" />
          <el-table-column label="BOM 来源" width="120">
            <template #default="{ row }">{{ bomSourceLabel(row.bomStatus?.bomSource) }}</template>
          </el-table-column>
          <el-table-column label="最近检查时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.bomStatus?.checkedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="canSelectForSupplement(row)"
                link
                type="warning"
                :loading="actionLoadingId === rowActionKey(row)"
                @click="openSupplement(row)"
              >
                发起补录
              </el-button>
              <el-button
                v-else
                link
                :type="costingActionType(row)"
                :disabled="!canStartCosting(row)"
                :loading="actionLoadingId === costingActionKey(row)"
                @click="startCosting(row)"
              >
                {{ costingActionText(row) }}
              </el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无产品明细" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="logs">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="流水 ID">{{ detail.ingestLog?.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求 ID">{{ detail.ingestLog?.requestId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="幂等键">{{ detail.ingestLog?.idempotencyKey || '-' }}</el-descriptions-item>
          <el-descriptions-item label="接入状态">
            {{ statusLabel('ingestStatus', detail.ingestLog?.ingestStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="接收时间">
            {{ formatDateTime(detail.ingestLog?.receivedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="处理时间">
            {{ formatDateTime(detail.ingestLog?.processedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="confirmDialog.visible" title="确认报价单分类" width="460px">
      <el-form :model="confirmDialog.form" label-width="96px">
        <el-form-item label="报价场景">
          <el-select v-model="confirmDialog.form.quoteScenario" placeholder="请选择报价场景">
            <el-option
              v-for="item in QUOTE_SCENARIO_OPTIONS.filter((option) => option.value !== 'UNKNOWN')"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="事业部类型">
          <el-input v-model="confirmDialog.form.businessUnitType" placeholder="COMMERCIAL" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="submitClassification">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  confirmQuoteRequestClassification,
  fetchQuoteRequestDetail,
} from '../api/quoteRequests'
import {
  checkQuoteBomStatus,
  createQuoteProductBomTasks,
  pushQuoteProductBomOaTodo,
} from '../api/quoteIngest'
import {
  QUOTE_SCENARIO_OPTIONS,
  canConfirmClassification,
  formatDateTime,
  isCostReadyBomStatus,
  mergeBomStatusToDetail,
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
const confirmDialog = reactive({
  visible: false,
  form: {
    quoteScenario: '',
    businessUnitType: 'COMMERCIAL',
  },
})

async function loadDetail() {
  if (!oaNo.value) return
  loading.value = true
  try {
    detail.value = await fetchQuoteRequestDetail(oaNo.value)
    selectedItems.value = []
  } catch (error) {
    detail.value = {}
    ElMessage.error(error?.message || '获取报价单详情失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/ingest/quote-requests')
}

async function handleCheckBom() {
  checking.value = true
  try {
    const response = await checkQuoteBomStatus(oaNo.value)
    detail.value = mergeBomStatusToDetail(detail.value, response)
    ElMessage.success('BOM 已刷新')
  } catch (error) {
    ElMessage.error(error?.message || '检查 BOM 失败')
  } finally {
    checking.value = false
  }
}

function openConfirmDialog() {
  confirmDialog.form.quoteScenario =
    detail.value.quoteScenario === 'UNKNOWN' ? '' : detail.value.quoteScenario || ''
  confirmDialog.form.businessUnitType = detail.value.businessUnitType || 'COMMERCIAL'
  confirmDialog.visible = true
}

async function submitClassification() {
  if (!confirmDialog.form.quoteScenario) {
    ElMessage.warning('请选择报价场景')
    return
  }
  confirming.value = true
  try {
    detail.value = await confirmQuoteRequestClassification(oaNo.value, {
      quoteScenario: confirmDialog.form.quoteScenario,
      businessUnitType: confirmDialog.form.businessUnitType,
    })
    confirmDialog.visible = false
    ElMessage.success('分类已确认')
  } catch (error) {
    ElMessage.error(error?.message || '确认分类失败')
  } finally {
    confirming.value = false
  }
}

async function openSupplement(row) {
  if (!canSelectForSupplement(row)) return
  actionLoadingId.value = rowActionKey(row)
  try {
    await createAndPushSupplementTasks([row])
    await loadDetail()
  } catch (error) {
    ElMessage.error(error?.message || '发起补录失败')
  } finally {
    actionLoadingId.value = ''
  }
}

async function handleBatchSupplement() {
  const rows = selectedItems.value.filter(canSelectForSupplement)
  if (rows.length === 0) {
    ElMessage.warning('请选择无 BOM 的产品行')
    return
  }
  tasking.value = true
  try {
    await createAndPushSupplementTasks(rows)
    await loadDetail()
  } catch (error) {
    ElMessage.error(error?.message || '批量发起补录失败')
  } finally {
    tasking.value = false
  }
}

async function createAndPushSupplementTasks(rows) {
  const ids = [...new Set(rows.map((row) => row.id).filter(Boolean))]
  if (ids.length === 0) {
    throw new Error('未找到可发起补录的产品行')
  }
  const result = await createQuoteProductBomTasks(ids)
  const taskIds = [...new Set((result?.tasks || []).map((item) => item?.taskId).filter(Boolean))]
  const pushResults = []
  for (const taskId of taskIds) {
    pushResults.push(await pushQuoteProductBomOaTodo(taskId))
  }
  const failed = pushResults.filter((item) => item?.pushStatus === 'FAILED').length
  const created = (result?.createdTaskCount || 0) + (result?.reusedTaskCount || 0)
  if (failed > 0) {
    ElMessage.warning(`补录任务已创建/复用 ${created} 个，${failed} 个 OA 待办推送失败`)
  } else {
    ElMessage.success(`补录任务已创建/复用 ${created} 个，OA 待办已推送 ${pushResults.length} 个`)
  }
}

function canSelectForSupplement(row) {
  return row?.bomStatus?.bomStatus === 'NO_BOM' && Boolean(row?.id)
}

function rowActionKey(row) {
  return `supplement:${row?.id || row?.materialNo || ''}`
}

function costingActionKey(row) {
  return `costing:${row?.id || row?.materialNo || ''}`
}

function canStartCosting(row) {
  return isCostReadyBomStatus(row?.bomStatus?.bomStatus) && Boolean(row?.materialNo)
}

function openCostingWorkbench(row, query = {}) {
  router.push({
    path: `/ingest/quote-requests/${encodeURIComponent(oaNo.value)}/items/${encodeURIComponent(row.id)}/costing`,
    query,
  })
}

async function startCosting(row) {
  if (!canStartCosting(row)) {
    ElMessage.warning('请先确认该产品已有可用 BOM')
    return
  }
  openCostingWorkbench(row)
}

function normalizedCalcStatus(value) {
  const text = String(value || '未核算').trim()
  if (['CALCULATED', 'DONE', 'SUCCESS', '已核算'].includes(text)) return '已核算'
  if (['CALCULATING', 'RUNNING', '试算中'].includes(text)) return '试算中'
  if (['NEED_RECALC', 'STALE', 'DIRTY', '需重新核算', '重新核算'].includes(text)) return '重新核算'
  return '未核算'
}

function hasCostingResult(row) {
  return Boolean(row?.calcAt || row?.unitCost || row?.costAmount)
}

function costingActionText(row) {
  const status = normalizedCalcStatus(row?.calcStatus)
  if (status === '试算中') return '试算中'
  if (status === '重新核算') return '重新核算'
  if (status === '已核算' || hasCostingResult(row)) return '重新核算'
  return '发起核算'
}

function costingActionType(row) {
  const text = costingActionText(row)
  if (text === '已核算') return 'success'
  if (text === '重新核算') return 'warning'
  return 'primary'
}

function bomSourceLabel(source) {
  const value = String(source || '').trim()
  if (!value) return '-'
  if (value === 'COSTING_SNAPSHOT') return '核算快照'
  if (value === 'U9_SOURCE') return 'U9'
  return value
}

watch(oaNo, loadDetail)
onMounted(loadDetail)
</script>

<style scoped>
.quote-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
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
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-tabs {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.table-toolbar__meta {
  color: #6b7280;
  font-size: 13px;
}

.items-table {
  width: 100%;
}

@media (max-width: 860px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
