<template>
  <cms-cost-page-shell
    title="CMS 计划成本原始数据"
    description="用于判断成品料号是否存在未审批工时项，原始数据只读。"
    trace-nav
  >
    <section class="cms-query-panel">
      <el-form class="cms-query-form" :inline="true" :model="filters" label-width="72px">
        <el-form-item label="成品料号">
          <el-input v-model="filters.parentCode" clearable placeholder="父件编码" />
        </el-form-item>
        <el-form-item label="成本年度">
          <el-input-number v-model="filters.costYear" :min="2000" :max="2100" :controls="false" style="width: 120px" />
        </el-form-item>
        <el-form-item label="生效期间">
          <el-date-picker
            v-model="filters.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item class="cms-query-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <el-table class="cms-raw-table" :data="rows" stripe border v-loading="loading">
      <el-table-column prop="rowNo" label="Excel行号" width="90" />
      <el-table-column prop="parentCode" label="成品料号" width="150" fixed />
      <el-table-column prop="parentName" label="成品名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="parentSpec" label="规格" min-width="160" show-overflow-tooltip />
      <el-table-column prop="parentType" label="类型" width="100" />
      <el-table-column prop="unit" label="单位" width="80" />
      <el-table-column prop="workingHours" label="工时" width="100" />
      <el-table-column prop="effectiveDate" label="生效日期" width="120" />
      <el-table-column prop="effectivePeriod" label="生效期间" width="100" />
      <el-table-column prop="salaryCost" label="工资" width="100" />
      <el-table-column prop="auxMaterialCost" label="辅料" width="100" />
      <el-table-column prop="totalPlanCost" label="计划总成本" width="120" />
      <el-table-column prop="businessStatus" label="业务状态" width="110" />
      <el-table-column prop="unapprovedItems" label="未审批项" min-width="180" show-overflow-tooltip />
      <el-table-column prop="oaNo" label="OA编号" width="140" />
      <el-table-column prop="createdAt" label="导入时间" width="170" />
      <template #empty>
        <el-empty description="暂无计划成本数据" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
    />
  </cms-cost-page-shell>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import CmsCostPageShell from '../components/CmsCostPageShell.vue'
import {
  fetchCmsPlanCostRows,
  normalizeCmsCostPage,
  toCmsCostPageParams,
} from '../api/cmsCost'

const route = useRoute()
const filters = reactive({
  parentCode: String(route.query.parentCode || ''),
  costYear: route.query.costYear ? Number(route.query.costYear) : undefined,
  period: String(route.query.period || ''),
})
const rows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

function buildParams() {
  return toCmsCostPageParams(
    {
      parentCode: filters.parentCode.trim(),
      costYear: filters.costYear,
      period: filters.period,
    },
    currentPage.value,
    pageSize.value,
  )
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeCmsCostPage(await fetchCmsPlanCostRows(buildParams()))
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'CMS 计划成本原始数据查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  filters.parentCode = ''
  filters.costYear = undefined
  filters.period = ''
  applyFilters()
}

watch([currentPage, pageSize], fetchRows)
onMounted(fetchRows)
</script>

<style scoped>
.cms-query-panel {
  margin-bottom: 14px;
  padding-bottom: 2px;
  border-bottom: 1px solid #ebeef5;
}

.cms-query-form :deep(.el-form-item) {
  margin-right: 18px;
  margin-bottom: 10px;
}

.cms-query-form :deep(.el-form-item__label) {
  color: #4b5563;
  font-weight: 600;
}

.cms-query-form :deep(.el-input),
.cms-query-form :deep(.el-input-number),
.cms-query-form :deep(.el-date-editor) {
  width: 168px;
}

.cms-query-actions {
  margin-left: 2px;
}

.cms-raw-table {
  width: 100%;
}

.cms-raw-table :deep(.el-table__cell) {
  padding: 7px 0;
}
</style>
