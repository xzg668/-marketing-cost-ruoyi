<template>
  <section class="quote-page">
    <div class="page-head">
      <div>
        <h1>报价单接入</h1>
        <p>单据维度工作台，用于查看报价单、确认分类和检查 BOM 汇总状态。</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Operation" @click="goProductBom">产品 BOM 处理</el-button>
        <el-button type="primary" :icon="Upload" @click="goImport">导入</el-button>
      </div>
    </div>

    <div class="filter-panel">
      <el-form :model="filters" label-width="86px">
        <div class="filter-grid">
          <el-form-item label="报价单号">
            <el-input v-model="filters.oaNo" clearable placeholder="OA-2026-001" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="流程编号">
            <el-input v-model="filters.processCode" clearable placeholder="FI-SC-020" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="报价场景">
            <el-select v-model="filters.quoteScenario" clearable placeholder="全部">
              <el-option
                v-for="item in QUOTE_SCENARIO_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="客户名称">
            <el-input v-model="filters.customer" clearable placeholder="客户名称" @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="分类状态">
            <el-select v-model="filters.classificationStatus" clearable placeholder="全部">
              <el-option
                v-for="item in CLASSIFICATION_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="BOM 状态">
            <el-select v-model="filters.bomAggregateStatus" clearable placeholder="全部">
              <el-option
                v-for="item in BOM_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="核算状态">
            <el-select v-model="filters.calcStatus" clearable placeholder="全部">
              <el-option
                v-for="item in CALC_STATUS_OPTIONS"
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

    <el-table :data="displayRows" border stripe v-loading="loading">
      <el-table-column prop="oaNo" label="报价单号" min-width="180" />
      <el-table-column prop="processCode" label="流程编号" width="130" />
      <el-table-column prop="quoteScenario" label="报价场景" width="150">
        <template #default="{ row }">{{ statusLabel('quoteScenario', row.quoteScenario) }}</template>
      </el-table-column>
      <el-table-column prop="customer" label="客户名称" min-width="180" />
      <el-table-column prop="applyDate" label="申请日期" width="120" />
      <el-table-column prop="productCount" label="产品数量" width="100" />
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
      <el-table-column prop="bomAggregateStatus" label="BOM 状态" width="140">
        <template #default="{ row }">
          <el-tag :type="statusTagType('bomStatus', row.bomAggregateStatus)" effect="plain">
            {{ statusLabel('bomStatus', row.bomAggregateStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="calcStatus" label="核算状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType('calcStatus', row.calcStatus || '未核算')" effect="plain">
            {{ statusLabel('calcStatus', row.calcStatus || '未核算') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goDetail(row.oaNo)">详情</el-button>
          <el-button
            v-if="canConfirmClassification(row)"
            link
            type="warning"
            @click="openConfirmDialog(row)"
          >
            确认分类
          </el-button>
          <el-button link type="primary" :loading="checkingOaNo === row.oaNo" @click="handleCheckBom(row)">
            检查 BOM
          </el-button>
          <el-button v-if="hasNoBom(row)" link type="warning" @click="goProductBom(row)">
            处理 BOM
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无报价单" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="pageNo"
      v-model:page-size="pageSize"
      :total="total"
    />

    <el-dialog v-model="confirmDialog.visible" title="确认报价单分类" width="460px">
      <el-form :model="confirmDialog.form" label-width="96px">
        <el-form-item label="报价单号">
          <el-input :model-value="confirmDialog.row?.oaNo || ''" disabled />
        </el-form-item>
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Operation, Refresh, Search, Upload } from '@element-plus/icons-vue'
import BasePagination from '../../../components/BasePagination.vue'
import {
  confirmQuoteRequestClassification,
  fetchQuoteRequests,
} from '../../../api/quoteRequests'
import { checkQuoteBomStatus } from '../../../api/quoteIngest'
import {
  BOM_STATUS_OPTIONS,
  CALC_STATUS_OPTIONS,
  CLASSIFICATION_STATUS_OPTIONS,
  QUOTE_SCENARIO_OPTIONS,
  canConfirmClassification,
  filterQuoteRequestRows,
  hasNoBom,
  normalizeQuoteRequestPage,
  statusLabel,
  statusTagType,
} from '../../../utils/quoteRequestWorkbench'

const router = useRouter()

const filters = reactive({
  oaNo: '',
  processCode: '',
  quoteScenario: '',
  customer: '',
  classificationStatus: '',
  bomAggregateStatus: '',
  calcStatus: '',
})

const loading = ref(false)
const confirming = ref(false)
const checkingOaNo = ref('')
const rows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)

const confirmDialog = reactive({
  visible: false,
  row: null,
  form: {
    quoteScenario: '',
    businessUnitType: 'COMMERCIAL',
  },
})

const displayRows = computed(() => filterQuoteRequestRows(rows.value, filters))

async function loadRows() {
  loading.value = true
  try {
    const data = await fetchQuoteRequests({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      oaNo: filters.oaNo,
      processCode: filters.processCode,
      classificationStatus: filters.classificationStatus,
    })
    const page = normalizeQuoteRequestPage(data)
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取报价单列表失败')
  } finally {
    loading.value = false
  }
}

function goImport() {
  router.push('/ingest/quote-requests/import')
}

function goProductBom(row) {
  const oaNo = row?.oaNo || filters.oaNo
  router.push({
    path: '/ingest/quote-request-products/bom',
    query: oaNo ? { oaNo } : {},
  })
}

function goDetail(oaNo) {
  router.push(`/ingest/quote-requests/${encodeURIComponent(oaNo)}`)
}

function applyFilters() {
  pageNo.value = 1
  loadRows()
}

function resetFilters() {
  Object.assign(filters, {
    oaNo: '',
    processCode: '',
    quoteScenario: '',
    customer: '',
    classificationStatus: '',
    bomAggregateStatus: '',
    calcStatus: '',
  })
  applyFilters()
}

function openConfirmDialog(row) {
  confirmDialog.row = row
  confirmDialog.form.quoteScenario = row.quoteScenario === 'UNKNOWN' ? '' : row.quoteScenario || ''
  confirmDialog.form.businessUnitType = row.businessUnitType || 'COMMERCIAL'
  confirmDialog.visible = true
}

async function submitClassification() {
  if (!confirmDialog.form.quoteScenario) {
    ElMessage.warning('请选择报价场景')
    return
  }
  confirming.value = true
  try {
    await confirmQuoteRequestClassification(confirmDialog.row.oaNo, {
      quoteScenario: confirmDialog.form.quoteScenario,
      businessUnitType: confirmDialog.form.businessUnitType,
    })
    ElMessage.success('分类已确认')
    confirmDialog.visible = false
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '确认分类失败')
  } finally {
    confirming.value = false
  }
}

async function handleCheckBom(row) {
  checkingOaNo.value = row.oaNo
  try {
    await checkQuoteBomStatus(row.oaNo)
    ElMessage.success('BOM 状态已刷新')
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '检查 BOM 失败')
  } finally {
    checkingOaNo.value = ''
  }
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

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.filter-actions {
  justify-content: flex-end;
}

.filter-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions {
    justify-content: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
