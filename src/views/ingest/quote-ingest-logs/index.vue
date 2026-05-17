<template>
  <section class="quote-page">
    <div class="page-head">
      <div>
        <h1>接入流水</h1>
        <p>接入排错与审计</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
    </div>

    <div class="filter-panel">
      <el-form :model="filters" label-width="86px">
        <div class="filter-grid">
          <el-form-item label="报价单号">
            <el-input v-model="filters.oaNo" clearable placeholder="OA-2026-001" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="来源">
            <el-select v-model="filters.sourceType" clearable placeholder="全部">
              <el-option
                v-for="item in SOURCE_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="接入状态">
            <el-select v-model="filters.ingestStatus" clearable placeholder="全部">
              <el-option
                v-for="item in INGEST_STATUS_OPTIONS"
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

    <el-table :data="rows" border stripe v-loading="loading">
      <el-table-column prop="id" label="流水 ID" width="100" />
      <el-table-column prop="oaNo" label="报价单号" min-width="180" />
      <el-table-column prop="processCode" label="流程编号" width="130" />
      <el-table-column prop="requestId" label="请求 ID" min-width="180" show-overflow-tooltip />
      <el-table-column prop="sourceType" label="来源" width="100">
        <template #default="{ row }">{{ sourceLabel(row.sourceType) }}</template>
      </el-table-column>
      <el-table-column prop="ingestStatus" label="接入状态" width="130">
        <template #default="{ row }">
          <el-tag :type="statusTagType('ingestStatus', row.ingestStatus)" effect="plain">
            {{ statusLabel('ingestStatus', row.ingestStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="classificationStatus" label="分类状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType('classificationStatus', row.classificationStatus)" effect="plain">
            {{ statusLabel('classificationStatus', row.classificationStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="receivedAt" label="接收时间" width="180" />
      <el-table-column prop="processedAt" label="处理时间" width="180" />
      <el-table-column prop="errorMessage" label="错误摘要" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button v-if="row.oaNo" link type="primary" @click="goQuoteDetail(row.oaNo)">报价单</el-button>
          <el-button v-if="hasLogFailure(row)" link type="warning" @click="retryPlaceholder(row)">重新处理</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无接入流水" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="pageNo"
      v-model:page-size="pageSize"
      :total="total"
    />

    <el-drawer
      v-model="drawer.visible"
      title="接入流水详情"
      size="64%"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="drawer-body">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="流水 ID">{{ drawer.detail.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求 ID">{{ drawer.detail.requestId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="报价单号">
            <el-button v-if="drawer.detail.oaNo" link type="primary" @click="goQuoteDetail(drawer.detail.oaNo)">
              {{ drawer.detail.oaNo }}
            </el-button>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="流程编号">{{ drawer.detail.processCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ sourceLabel(drawer.detail.sourceType) }}</el-descriptions-item>
          <el-descriptions-item label="来源系统">{{ drawer.detail.sourceSystem || '-' }}</el-descriptions-item>
          <el-descriptions-item label="接入状态">
            <el-tag :type="statusTagType('ingestStatus', drawer.detail.ingestStatus)" effect="plain">
              {{ statusLabel('ingestStatus', drawer.detail.ingestStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="分类状态">
            <el-tag :type="statusTagType('classificationStatus', drawer.detail.classificationStatus)" effect="plain">
              {{ statusLabel('classificationStatus', drawer.detail.classificationStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="接收时间">{{ drawer.detail.receivedAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="处理时间">{{ drawer.detail.processedAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="幂等键" :span="2">{{ drawer.detail.idempotencyKey || '-' }}</el-descriptions-item>
          <el-descriptions-item label="Payload Hash" :span="2">{{ drawer.detail.payloadHash || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="原始报文" name="payload">
            <pre>{{ prettyJsonText(drawer.detail.payloadJson) }}</pre>
          </el-tab-pane>
          <el-tab-pane label="标准化报文" name="normalized">
            <pre>{{ prettyJsonText(drawer.detail.normalizedJson) }}</pre>
          </el-tab-pane>
          <el-tab-pane label="错误和提醒" name="diagnostics">
            <div class="diagnostics-grid">
              <div>
                <div class="section-title">校验错误</div>
                <pre>{{ prettyJsonText(drawer.detail.validationErrors) }}</pre>
              </div>
              <div>
                <div class="section-title">提醒</div>
                <pre>{{ prettyJsonText(drawer.detail.warningMessages) }}</pre>
              </div>
              <div>
                <div class="section-title">系统错误</div>
                <pre>{{ drawer.detail.errorMessage || '-' }}</pre>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="元数据" name="meta">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="外部单号">{{ drawer.detail.externalFormNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="流程名称">{{ drawer.detail.processName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="报价场景">
                {{ statusLabel('quoteScenario', drawer.detail.quoteScenario) }}
              </el-descriptions-item>
              <el-descriptions-item label="创建人">{{ drawer.detail.createdBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ drawer.detail.createdAt || '-' }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ drawer.detail.updatedAt || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../components/BasePagination.vue'
import { fetchQuoteIngestLogDetail, fetchQuoteIngestLogs } from '../../../api/quoteIngest'
import { INGEST_STATUS_OPTIONS, statusLabel, statusTagType } from '../../../utils/quoteRequestWorkbench'
import {
  SOURCE_TYPE_OPTIONS,
  hasLogFailure,
  normalizeQuoteIngestLogPage,
  prettyJsonText,
} from '../../../utils/quoteIngestLogs'

const router = useRouter()

const filters = reactive({
  oaNo: '',
  sourceType: '',
  ingestStatus: '',
})

const loading = ref(false)
const detailLoading = ref(false)
const rows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)
const activeTab = ref('payload')

const drawer = reactive({
  visible: false,
  detail: {},
})

function sourceLabel(value) {
  return SOURCE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || '-'
}

async function loadRows() {
  loading.value = true
  try {
    const data = await fetchQuoteIngestLogs({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      oaNo: filters.oaNo,
      sourceType: filters.sourceType,
      ingestStatus: filters.ingestStatus,
    })
    const page = normalizeQuoteIngestLogPage(data)
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取接入流水失败')
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
    sourceType: '',
    ingestStatus: '',
  })
  applyFilters()
}

async function openDetail(row) {
  drawer.visible = true
  drawer.detail = {}
  activeTab.value = 'payload'
  detailLoading.value = true
  try {
    drawer.detail = await fetchQuoteIngestLogDetail(row.id)
    if (drawer.detail.validationErrors || drawer.detail.warningMessages || drawer.detail.errorMessage) {
      activeTab.value = 'diagnostics'
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取接入流水详情失败')
  } finally {
    detailLoading.value = false
  }
}

function goQuoteDetail(oaNo) {
  router.push(`/ingest/quote-requests/${encodeURIComponent(oaNo)}`)
}

function retryPlaceholder(row) {
  ElMessage.info(`后续可从流水 ${row.id} 重新处理失败接入`)
}

watch([pageNo, pageSize], () => {
  loadRows()
})

onMounted(loadRows)
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

.filter-panel {
  padding: 16px 16px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 0 12px;
}

.filter-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-tabs {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.section-title {
  margin-bottom: 8px;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

pre {
  min-height: 240px;
  max-height: 520px;
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

@media (max-width: 1000px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .diagnostics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
