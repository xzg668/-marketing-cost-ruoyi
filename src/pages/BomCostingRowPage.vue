<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-title">BOM 结算明细</div>
      <el-form label-position="top" class="filter-form">
        <div class="filter-grid">
          <el-form-item label="报价单号">
            <el-input v-model="filters.oaNo" placeholder="OA 单号" clearable @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="产品料号">
            <el-input v-model="filters.topProductCode" placeholder="OA 产品料号" clearable @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="结算料号">
            <el-input v-model="filters.materialCode" placeholder="明细结算料号" clearable @keyup.enter="applyFilters" />
          </el-form-item>
          <el-form-item label="期间">
            <el-date-picker
              v-model="filters.periodMonth"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
            />
          </el-form-item>
        </div>
      </el-form>
      <div class="filter-actions">
        <el-button type="primary" :loading="loading" @click="applyFilters">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="result-header">
        <div class="result-title">OA 产品料号</div>
        <el-tag size="small" type="info">共 {{ total }} 条</el-tag>
      </div>
      <el-table :data="productRows" stripe border v-loading="loading" class="wide-table">
        <el-table-column prop="oaNo" label="报价单号" min-width="170" show-overflow-tooltip />
        <el-table-column prop="topProductCode" label="产品料号" min-width="170" show-overflow-tooltip />
        <el-table-column prop="periodMonth" label="期间" width="100" />
        <el-table-column prop="rowCount" label="结算明细数" width="120" align="right" />
        <el-table-column prop="ruleHitCount" label="规则命中数" width="120" align="right" />
        <el-table-column prop="subtreeCostRequiredCount" label="子树接管数" width="120" align="right" />
        <el-table-column prop="buildBatchId" label="生成批次" min-width="180" show-overflow-tooltip />
        <el-table-column prop="latestBuiltAt" label="最近生成时间" width="170" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">明细</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 OA 产品结算明细" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-drawer v-model="detailVisible" :title="detailTitle" size="88%" @closed="resetDetail">
      <div class="detail-body" v-loading="detailLoading">
        <div class="detail-header">
          <div class="result-title">结算料号明细</div>
          <el-tag size="small" type="info">共 {{ detailTotal }} 条</el-tag>
        </div>
        <el-table :data="detailRows" stripe border class="wide-table">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-panel">
                <div class="expand-title">来源追溯</div>
                <el-table :data="row.sourceRefs || []" size="small" border>
                  <el-table-column prop="sourcePartType" label="来源类型" width="180" />
                  <el-table-column prop="sourceRawHierarchyId" label="原始 BOM 行" width="130" />
                  <el-table-column prop="sourceTaskId" label="任务 ID" width="110" />
                  <el-table-column prop="supplementVersionId" label="补录版本" width="120" />
                  <el-table-column prop="supplementDetailId" label="补录明细" width="120" />
                  <el-table-column prop="packageReferenceId" label="包装参考" width="120" />
                  <el-table-column prop="packageReferenceDetailId" label="包装参考明细" width="140" />
                  <el-table-column prop="referenceFinishedCode" label="参考成品" width="140" show-overflow-tooltip />
                  <el-table-column prop="sourceTopProductCode" label="目件料号" width="140" show-overflow-tooltip />
                  <el-table-column prop="sourceSnapshotId" label="快照 ID" width="110" />
                  <el-table-column prop="sourceSnapshotDetailId" label="快照明细 ID" width="130" />
                  <el-table-column prop="sourceU9BomId" label="U9 BOM ID" width="120" />
                  <el-table-column prop="sourcePath" label="来源路径" min-width="260" show-overflow-tooltip />
                  <template #empty>
                    <el-empty description="未写入来源追溯" />
                  </template>
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="parentCode" label="父料号" width="150" show-overflow-tooltip />
          <el-table-column prop="materialCode" label="结算料号" width="150" show-overflow-tooltip />
          <el-table-column prop="materialName" label="名称" min-width="170" show-overflow-tooltip />
          <el-table-column prop="materialSpec" label="规格" min-width="160" show-overflow-tooltip />
          <el-table-column prop="shapeAttr" label="形态属性" width="110" show-overflow-tooltip />
          <el-table-column prop="sourceCategory" label="来源分类" width="120" show-overflow-tooltip />
          <el-table-column prop="costElementCode" label="成本要素" width="120" show-overflow-tooltip />
          <el-table-column prop="level" label="层级" width="80" />
          <el-table-column prop="qtyPerParent" label="父用量" width="120" />
          <el-table-column prop="qtyPerTop" label="累计用量" width="120" />
          <el-table-column label="来源" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.sourceSummary || '未写入来源追溯' }}</template>
          </el-table-column>
          <el-table-column label="结算规则命中" min-width="250">
            <template #default="{ row }">
              <div v-if="row.matchedSettlementRuleId" class="rule-hit">
                <el-tag size="small" type="warning">{{ row.matchedRuleAction || '规则命中' }}</el-tag>
                <span class="rule-text">
                  #{{ row.matchedSettlementRuleId }} {{ row.matchedSettlementRuleName || row.matchedRuleValue || '' }}
                </span>
              </div>
              <span v-else class="dim">默认叶子结算</span>
            </template>
          </el-table-column>
          <el-table-column prop="settlementRowType" label="结算行类型" width="150" show-overflow-tooltip />
          <el-table-column label="子树接管" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.subtreeCostRequired === 1" size="small" type="warning">是</el-tag>
              <span v-else class="dim">否</span>
            </template>
          </el-table-column>
          <el-table-column prop="buildBatchId" label="生成批次" width="180" show-overflow-tooltip />
          <el-table-column prop="builtAt" label="生成时间" width="170" />
          <el-table-column prop="path" label="结算路径" min-width="260" show-overflow-tooltip />
          <template #empty>
            <el-empty description="暂无结算料号明细" />
          </template>
        </el-table>
        <BasePagination
          v-model:current-page="detailPage"
          v-model:page-size="detailPageSize"
          :total="detailTotal"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchQuoteBomCostingProducts,
  fetchQuoteBomCostingRows,
  normalizeQuoteBomPage,
} from '../api/quoteBomDetails'

const filters = ref({
  oaNo: '',
  topProductCode: '',
  materialCode: '',
  periodMonth: '',
})

const productRows = ref([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const detailVisible = ref(false)
const detailLoading = ref(false)
const selectedProduct = ref(null)
const detailRows = ref([])
const detailTotal = ref(0)
const detailPage = ref(1)
const detailPageSize = ref(20)

const detailTitle = computed(() => {
  const row = selectedProduct.value
  if (!row) return '结算料号明细'
  return `结算料号明细 - ${row.oaNo || '-'} / ${row.topProductCode || '-'}`
})

const buildProductParams = () => ({
  oaNo: filters.value.oaNo.trim(),
  topProductCode: filters.value.topProductCode.trim(),
  materialCode: filters.value.materialCode.trim(),
  periodMonth: filters.value.periodMonth,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const buildDetailParams = () => ({
  oaNo: selectedProduct.value?.oaNo || '',
  topProductCode: selectedProduct.value?.topProductCode || '',
  materialCode: filters.value.materialCode.trim(),
  periodMonth: selectedProduct.value?.periodMonth || '',
  page: detailPage.value,
  pageSize: detailPageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const page = normalizeQuoteBomPage(await fetchQuoteBomCostingProducts(buildProductParams()))
    productRows.value = page.list
    total.value = page.total
  } catch (error) {
    productRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询 BOM 结算产品失败')
  } finally {
    loading.value = false
  }
}

const fetchDetail = async () => {
  if (!selectedProduct.value) return
  detailLoading.value = true
  try {
    const page = normalizeQuoteBomPage(await fetchQuoteBomCostingRows(buildDetailParams()))
    detailRows.value = page.list
    detailTotal.value = page.total
  } catch (error) {
    detailRows.value = []
    detailTotal.value = 0
    ElMessage.error(error?.message || '查询结算料号明细失败')
  } finally {
    detailLoading.value = false
  }
}

const openDetail = (row) => {
  selectedProduct.value = row
  detailPage.value = 1
  detailRows.value = []
  detailTotal.value = 0
  detailVisible.value = true
  fetchDetail()
}

const resetDetail = () => {
  selectedProduct.value = null
  detailRows.value = []
  detailTotal.value = 0
}

const applyFilters = () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
}

const resetFilters = () => {
  filters.value = {
    oaNo: '',
    topProductCode: '',
    materialCode: '',
    periodMonth: '',
  }
  applyFilters()
}

watch(currentPage, fetchList)
watch(pageSize, () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
})
watch(detailPage, fetchDetail)
watch(detailPageSize, () => {
  if (detailPage.value === 1) fetchDetail()
  else detailPage.value = 1
})

onMounted(fetchList)
</script>

<style scoped>
.base-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  border-radius: 8px;
}

.filter-title {
  margin-bottom: 12px;
  color: #1f2a37;
  font-size: 15px;
  font-weight: 600;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 0 16px;
}

.filter-actions,
.result-header,
.detail-header,
.rule-hit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-actions {
  justify-content: flex-end;
}

.result-header,
.detail-header {
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title,
.expand-title {
  color: #1f2a37;
  font-size: 14px;
  font-weight: 600;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.expand-panel {
  padding: 8px 24px 16px;
}

.expand-title {
  margin-bottom: 10px;
}

.wide-table :deep(.cell) {
  word-break: break-word;
}

.rule-text {
  min-width: 0;
  color: #4b5563;
}

.dim {
  color: #8a9099;
}

@media (max-width: 1200px) {
  .filter-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .filter-actions {
    justify-content: flex-start;
  }
}
</style>
