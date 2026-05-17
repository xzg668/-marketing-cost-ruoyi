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
      <el-descriptions-item label="来源">{{ detail.sourceType || '-' }}</el-descriptions-item>
      <el-descriptions-item label="外部单号">{{ detail.externalFormNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程编号">{{ detail.processCode || '-' }}</el-descriptions-item>
      <el-descriptions-item label="流程名称">{{ detail.processName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="报价场景">
        {{ statusLabel('quoteScenario', detail.quoteScenario) }}
      </el-descriptions-item>
      <el-descriptions-item label="客户名称">{{ detail.customer || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请日期">{{ detail.applyDate || '-' }}</el-descriptions-item>
      <el-descriptions-item label="申请人">{{ detail.applicantName || '-' }}</el-descriptions-item>
      <el-descriptions-item label="分类状态">
        <el-tag :type="statusTagType('classificationStatus', detail.classificationStatus)" effect="plain">
          {{ statusLabel('classificationStatus', detail.classificationStatus) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="BOM 状态">
        <el-tag :type="statusTagType('bomStatus', detail.bomAggregateStatus)" effect="plain">
          {{ statusLabel('bomStatus', detail.bomAggregateStatus) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="核算状态">
        <el-tag :type="statusTagType('calcStatus', detail.calcStatus || '未核算')" effect="plain">
          {{ statusLabel('calcStatus', detail.calcStatus || '未核算') }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="产品明细" name="items">
        <el-table :data="detail.items || []" border stripe>
          <el-table-column prop="seq" label="行号" width="80" />
          <el-table-column prop="productName" label="产品名称" min-width="160" />
          <el-table-column prop="materialNo" label="产品料号" min-width="150" />
          <el-table-column prop="sunlModel" label="三花型号" min-width="150" />
          <el-table-column prop="businessType" label="业务类型" width="130" />
          <el-table-column prop="annualVolume" label="预计年用量" width="120" />
          <el-table-column prop="technicianName" label="技术员" width="120" />
          <el-table-column label="BOM 状态" width="150">
            <template #default="{ row }">
              <el-tag :type="statusTagType('bomStatus', row.bomStatus?.bomStatus)" effect="plain">
                {{ statusLabel('bomStatus', row.bomStatus?.bomStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="BOM 来源" width="120">
            <template #default="{ row }">{{ row.bomStatus?.bomSource || '-' }}</template>
          </el-table-column>
          <el-table-column label="最近检查时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.bomStatus?.checkedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.bomStatus?.bomStatus === 'NO_BOM'" link type="warning" @click="openSupplement(row)">
                发起补录
              </el-button>
              <el-button v-else link type="primary" :disabled="!canViewBom(row)" @click="openBomTree(row)">
                查看 BOM
              </el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无产品明细" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="额外费用" name="fees">
        <el-table :data="detail.extraFees || []" border stripe>
          <el-table-column prop="feeCode" label="费用编码" min-width="150" />
          <el-table-column prop="feeName" label="费用名称" min-width="180" />
          <el-table-column prop="feeCategory" label="费用分类" width="130" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="unit" label="单位" width="100" />
          <el-table-column prop="remark" label="备注" min-width="180" />
          <template #empty>
            <el-empty description="暂无额外费用" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="扩展字段" name="fields">
        <el-table :data="detail.extraFields || []" border stripe>
          <el-table-column prop="fieldCode" label="字段编码" min-width="160" />
          <el-table-column prop="fieldName" label="字段名称" min-width="160" />
          <el-table-column prop="fieldValue" label="字段值" min-width="200" />
          <el-table-column prop="sourceFieldName" label="来源字段" min-width="160" />
          <template #empty>
            <el-empty description="暂无扩展字段" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="接入原文" name="raw">
        <div class="raw-grid">
          <div>
            <div class="section-title">接入摘要</div>
            <pre>{{ detail.ingestLog?.payloadSummary || '-' }}</pre>
          </div>
          <div>
            <div class="section-title">归一化摘要</div>
            <pre>{{ detail.ingestLog?.normalizedSummary || '-' }}</pre>
          </div>
          <div>
            <div class="section-title">错误信息</div>
            <pre>{{ detail.ingestLog?.validationErrors || detail.ingestLog?.errorMessage || '-' }}</pre>
          </div>
          <div>
            <div class="section-title">提醒信息</div>
            <pre>{{ detail.ingestLog?.warningMessages || '-' }}</pre>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="操作记录" name="logs">
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
import { checkQuoteBomStatus } from '../api/quoteIngest'
import {
  QUOTE_SCENARIO_OPTIONS,
  canConfirmClassification,
  formatDateTime,
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
const activeTab = ref('items')
const detail = ref({})
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
    ElMessage.success('BOM 状态已刷新')
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

function openSupplement(row) {
  ElMessage.info(`后续将为 ${row.materialNo || row.sunlModel || oaNo.value} 发起 OA 技术补录待办`)
}

function canViewBom(row) {
  return ['SYNCED', 'MANUAL_ENTERED'].includes(row?.bomStatus?.bomStatus) && Boolean(row?.materialNo)
}

function openBomTree(row) {
  if (!canViewBom(row)) {
    ElMessage.warning('请先刷新 BOM 状态，确认该产品已有可用 BOM')
    return
  }
  const status = row.bomStatus || {}
  router.push({
    path: '/base/bomTree',
    query: {
      topProductCode: row.materialNo,
      bomPurpose: status.bomPurpose || undefined,
      asOfDate: status.effectiveFrom || undefined,
      sourceType: normalizeBomSource(status.bomSource),
    },
  })
}

function normalizeBomSource(source) {
  const value = String(source || '').trim()
  if (['U9', 'MANUAL', 'E_DRAWING'].includes(value)) return value
  return 'U9'
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

.raw-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.section-title {
  margin-bottom: 8px;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

pre {
  min-height: 120px;
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 860px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .raw-grid {
    grid-template-columns: 1fr;
  }
}
</style>
