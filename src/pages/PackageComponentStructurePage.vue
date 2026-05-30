<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-title">包装组件结构</div>
      <el-form label-position="top" class="filter-form">
        <div class="filter-grid">
          <el-form-item label="参考成品料号">
            <el-input
              v-model="filters.referenceFinishedCode"
              placeholder="参考成品料号"
              clearable
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item label="目件料号">
            <el-input
              v-model="filters.sourceTopProductCode"
              placeholder="默认同参考成品"
              clearable
              @keyup.enter="applyFilters"
            />
          </el-form-item>
          <el-form-item label="包装父件料号">
            <el-input
              v-model="filters.packageParentCode"
              placeholder="包装组件父料号"
              clearable
              @keyup.enter="applyFilters"
            />
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

    <el-alert
      v-if="gaps.length"
      class="gap-alert"
      type="warning"
      show-icon
      :closable="false"
    >
      <template #title>
        {{ gapTitle }}
      </template>
    </el-alert>

    <el-card shadow="never">
      <div class="result-header">
        <div class="result-title">结构明细</div>
        <div class="result-tags">
          <el-tag size="small" type="info">共 {{ total }} 条</el-tag>
          <el-tag v-if="contextText" size="small" effect="plain">{{ contextText }}</el-tag>
        </div>
      </div>
      <el-table
        :data="tableRows"
        stripe
        border
        v-loading="loading"
        class="wide-table"
      >
        <el-table-column prop="referenceFinishedCode" label="参考成品料号" width="150" show-overflow-tooltip />
        <el-table-column prop="sourceTopProductCode" label="目件料号" width="150" show-overflow-tooltip />
        <el-table-column prop="periodMonth" label="期间" width="100" />
        <el-table-column prop="packageParentCode" label="包装父件料号" width="150" show-overflow-tooltip />
        <el-table-column prop="packageParentName" label="包装父件名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="packageParentSpec" label="父件规格" min-width="150" show-overflow-tooltip />
        <el-table-column prop="packageParentModel" label="父件型号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="packageParentDrawingNo" label="父件图号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="packageParentShapeAttr" label="父件形态" width="110" show-overflow-tooltip />
        <el-table-column prop="packageParentMainCategoryCode" label="父件主分类" width="130" show-overflow-tooltip />
        <el-table-column prop="packageParentUnit" label="父件单位" width="90" />
        <el-table-column prop="packageQtyPerParent" label="父件用量" width="120" />
        <el-table-column prop="packageQtyPerTop" label="父件累计用量" width="130" />
        <el-table-column prop="packageParentBaseQty" label="父件母件底数" width="130" />
        <el-table-column prop="packageChildCode" label="子件料号" width="150" show-overflow-tooltip />
        <el-table-column prop="packageChildName" label="子件名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="packageChildSpec" label="子件规格" min-width="150" show-overflow-tooltip />
        <el-table-column prop="packageChildModel" label="子件型号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="packageChildDrawingNo" label="子件图号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="packageChildShapeAttr" label="子件形态" width="110" show-overflow-tooltip />
        <el-table-column prop="packageChildMainCategoryCode" label="子件主分类" width="130" show-overflow-tooltip />
        <el-table-column prop="packageChildUnit" label="子件单位" width="90" />
        <el-table-column prop="childQtyPerParent" label="子件用量" width="120" />
        <el-table-column prop="childQtyPerTop" label="子件累计用量" width="130" />
        <el-table-column prop="childParentBaseQty" label="子件母件底数" width="130" />
        <el-table-column prop="packageSourceRawHierarchyId" label="父件来源 BOM 行" width="140" />
        <el-table-column prop="childSourceRawHierarchyId" label="子件来源 BOM 行" width="140" />
        <el-table-column prop="childSourceParentCode" label="来源父料号" width="140" show-overflow-tooltip />
        <el-table-column prop="childSourcePath" label="来源路径" min-width="240" show-overflow-tooltip />
        <template #empty>
          <el-empty description="暂无包装组件结构" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchQuoteBomPackageStructures,
  normalizeQuoteBomPage,
} from '../api/quoteBomDetails'

const filters = ref({
  referenceFinishedCode: '',
  sourceTopProductCode: '',
  packageParentCode: '',
  periodMonth: '',
})

const tableRows = ref([])
const total = ref(0)
const gaps = ref([])
const context = ref({})
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const contextText = computed(() => {
  const parts = [
    context.value.referenceFinishedCode && `参考 ${context.value.referenceFinishedCode}`,
    context.value.sourceTopProductCode && `目件 ${context.value.sourceTopProductCode}`,
    context.value.periodMonth && `期间 ${context.value.periodMonth}`,
  ].filter(Boolean)
  return parts.join(' / ')
})

const gapTitle = computed(() => {
  const summary = gaps.value.slice(0, 3).join('；')
  const extra = gaps.value.length > 3 ? `；另 ${gaps.value.length - 3} 条` : ''
  return `提示：${summary}${extra}`
})

const buildParams = () => ({
  referenceFinishedCode: filters.value.referenceFinishedCode.trim(),
  sourceTopProductCode: filters.value.sourceTopProductCode.trim(),
  packageParentCode: filters.value.packageParentCode.trim(),
  periodMonth: filters.value.periodMonth,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const page = normalizeQuoteBomPage(await fetchQuoteBomPackageStructures(buildParams()))
    tableRows.value = page.list
    total.value = page.total
    gaps.value = page.gaps
    context.value = page
  } catch (error) {
    tableRows.value = []
    total.value = 0
    gaps.value = []
    ElMessage.error(error?.message || '查询包装组件结构失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    referenceFinishedCode: '',
    sourceTopProductCode: '',
    packageParentCode: '',
    periodMonth: '',
  }
  applyFilters()
}

watch(currentPage, fetchList)
watch(pageSize, () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
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
.result-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-actions {
  justify-content: flex-end;
}

.result-header {
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title {
  color: #1f2a37;
  font-size: 14px;
  font-weight: 600;
}

.gap-alert {
  margin-bottom: -4px;
}

.wide-table {
  width: 100%;
}

.wide-table :deep(.cell) {
  word-break: break-word;
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
