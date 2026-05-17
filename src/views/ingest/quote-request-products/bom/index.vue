<template>
  <section class="product-bom-page">
    <div class="page-head">
      <div>
        <h1>报价单产品 BOM 处理</h1>
        <p>按产品行批量同步本地 U9 全量快照，并对无 BOM 产品发起 OA 技术补录任务。</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Back" @click="goQuoteRequests">报价单接入</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadRows">刷新</el-button>
      </div>
    </div>

    <div class="filter-panel">
      <el-form :model="filters" label-width="86px">
        <div class="filter-grid">
          <el-form-item label="报价单号">
            <el-input v-model="filters.oaNo" clearable placeholder="OA-2026-001" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="客户名称">
            <el-input v-model="filters.customer" clearable placeholder="客户名称" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="产品料号">
            <el-input v-model="filters.productCode" clearable placeholder="产品料号" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="技术员">
            <el-input v-model="filters.technicianName" clearable placeholder="技术员" @keyup.enter="applyFilters" />
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
        已选 {{ selectedRows.length }} 行，当前展示 {{ filteredRows.length }} 行
      </div>
      <div class="toolbar-actions">
        <el-button
          type="primary"
          :disabled="selectedRows.length === 0"
          :loading="batchSyncing"
          @click="handleBatchSync"
        >
          批量同步
        </el-button>
        <el-button
          type="warning"
          :disabled="selectedRows.length === 0"
          :loading="batchOaTasking"
          @click="handleBatchOaTask"
        >
          批量发起OA任务
        </el-button>
      </div>
    </div>

    <el-table
      :data="filteredRows"
      border
      stripe
      v-loading="loading"
      @selection-change="selectedRows = $event"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="oaNo" label="报价单号" min-width="180" />
      <el-table-column prop="customer" label="客户名称" min-width="180" />
      <el-table-column prop="materialNo" label="产品料号" min-width="150" />
      <el-table-column prop="productName" label="产品名称" min-width="160" />
      <el-table-column prop="spec" label="产品规格" min-width="140" />
      <el-table-column prop="businessUnitType" label="事业部" width="120" />
      <el-table-column prop="technicianName" label="技术员" width="120" />
      <el-table-column label="BOM状态" width="140">
        <template #default="{ row }">
          <el-tag :type="statusTagType('bomStatus', row.bomStatus?.bomStatus)" effect="plain">
            {{ statusLabel('bomStatus', row.bomStatus?.bomStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="同步时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.bomStatus?.checkedAt) }}</template>
      </el-table-column>
      <el-table-column label="补录任务" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.bomStatus?.manualTaskNo || '-' }}</template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无产品 BOM 数据" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="pageNo"
      v-model:page-size="pageSize"
      :total="total"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Back, Refresh, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../../components/BasePagination.vue'
import { fetchQuoteRequestDetail, fetchQuoteRequests } from '../../../../api/quoteRequests'
import {
  batchCreateBomSupplementOaTasks,
  batchSyncQuoteBomStatus,
} from '../../../../api/quoteIngest'
import {
  BOM_STATUS_OPTIONS,
  formatDateTime,
  normalizeQuoteRequestPage,
  statusLabel,
  statusTagType,
} from '../../../../utils/quoteRequestWorkbench'

const router = useRouter()
const route = useRoute()

const defaultBomStatuses = ['NO_BOM', 'NOT_CHECKED']
const filters = reactive({
  oaNo: String(route.query.oaNo || ''),
  customer: '',
  productCode: '',
  technicianName: '',
  bomStatuses: [...defaultBomStatuses],
})

const loading = ref(false)
const batchSyncing = ref(false)
const batchOaTasking = ref(false)
const rows = ref([])
const selectedRows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)

const filteredRows = computed(() => {
  const statusSet = new Set(filters.bomStatuses || [])
  return (Array.isArray(rows.value) ? rows.value : []).filter((row) => {
    if (filters.oaNo && !String(row.oaNo || '').includes(filters.oaNo)) return false
    if (filters.customer && !String(row.customer || '').includes(filters.customer)) return false
    if (filters.productCode && !String(row.materialNo || '').includes(filters.productCode)) return false
    if (filters.technicianName && !String(row.technicianName || '').includes(filters.technicianName)) return false
    if (statusSet.size > 0 && !statusSet.has(row.bomStatus?.bomStatus || 'NOT_CHECKED')) return false
    return true
  })
})

async function loadRows() {
  loading.value = true
  try {
    const data = await fetchQuoteRequests({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      oaNo: filters.oaNo,
    })
    const page = normalizeQuoteRequestPage(data)
    total.value = page.total
    const details = await Promise.all(page.list.map((row) => fetchQuoteRequestDetail(row.oaNo)))
    rows.value = details.flatMap((detail) =>
      (detail.items || []).map((item) => ({
        ...item,
        oaNo: detail.oaNo,
        customer: detail.customer,
        processCode: detail.processCode,
        quoteScenario: detail.quoteScenario,
      })),
    )
    selectedRows.value = []
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取产品 BOM 列表失败')
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
    technicianName: '',
    bomStatuses: [...defaultBomStatuses],
  })
  applyFilters()
}

async function handleBatchSync() {
  const ids = selectedRows.value.map((row) => row.id).filter(Boolean)
  if (ids.length === 0) {
    ElMessage.warning('请选择需要同步的产品行')
    return
  }
  batchSyncing.value = true
  try {
    const result = await batchSyncQuoteBomStatus(ids)
    const statusByItemId = new Map((result.items || []).map((item) => [item.oaFormItemId, item]))
    rows.value = rows.value.map((row) => ({
      ...row,
      bomStatus: statusByItemId.get(row.id) || row.bomStatus,
    }))
    ElMessage.success(`同步完成：${result.syncedRowCount || 0} 行已同步，${result.noBomRowCount || 0} 行无 BOM`)
  } catch (error) {
    ElMessage.error(error?.message || '批量同步失败')
  } finally {
    batchSyncing.value = false
  }
}

async function handleBatchOaTask() {
  const noBomRows = selectedRows.value.filter((row) => row.bomStatus?.bomStatus === 'NO_BOM')
  if (noBomRows.length === 0) {
    ElMessage.warning('请选择 BOM 状态为“无 BOM”的产品行')
    return
  }
  const statusIds = noBomRows.map((row) => row.bomStatus?.id).filter(Boolean)
  if (statusIds.length !== noBomRows.length) {
    ElMessage.warning('请先批量同步，生成无 BOM 状态后再发起 OA 任务')
    return
  }
  batchOaTasking.value = true
  try {
    const result = await batchCreateBomSupplementOaTasks(statusIds)
    const created = result.createdTaskCount || 0
    const reused = result.reusedTaskCount || 0
    const rejected = result.rejectedCount || 0
    ElMessage.success(`OA任务已发起：新建 ${created} 个，复用 ${reused} 个，拒绝 ${rejected} 行`)
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '批量发起 OA 任务失败')
  } finally {
    batchOaTasking.value = false
  }
}

function goQuoteRequests() {
  router.push('/ingest/quote-requests')
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
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 0 12px;
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

@media (max-width: 1100px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
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
