<template>
  <cms-cost-page-shell
    title="CMS 车间料工费原始数据"
    description="直接人工工资来源，工作成本原始单位为分，导入后同步保留元金额。"
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
        <el-form-item label="期间">
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
      <el-table-column prop="period" label="来源期间" width="100" />
      <el-table-column prop="parentCode" label="成品料号" width="150" fixed />
      <el-table-column prop="parentName" label="成品名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="parentSpec" label="规格" min-width="160" show-overflow-tooltip />
      <el-table-column prop="parentType" label="类型" width="100" />
      <el-table-column prop="workingHours" label="工时" width="100" />
      <el-table-column prop="funding" label="经费" width="100" />
      <el-table-column prop="workingCostCent" label="工资(分)" width="110" />
      <el-table-column prop="workingCostYuan" label="工资(元)" width="110" />
      <el-table-column prop="lastUnitName" label="末级组织" min-width="130" show-overflow-tooltip />
      <el-table-column prop="secondSubjectName" label="二级科目" min-width="130" show-overflow-tooltip />
      <el-table-column prop="thirdSubjectName" label="三级科目" min-width="130" show-overflow-tooltip />
      <el-table-column prop="sourceRowId" label="CMS原始ID" width="130" />
      <el-table-column prop="createdAt" label="导入时间" width="170" />
      <template #empty>
        <el-empty description="暂无车间料工费数据" />
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
  fetchCmsWorkshopLaborRows,
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
    const page = normalizeCmsCostPage(await fetchCmsWorkshopLaborRows(buildParams()))
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'CMS 车间料工费原始数据查询失败')
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
