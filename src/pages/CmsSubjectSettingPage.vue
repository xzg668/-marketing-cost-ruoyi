<template>
  <cms-cost-page-shell
    title="CMS 科目设置"
    description="CMS 科目归类和编码字典，用于识别辅料和辅助员工工资取数科目。"
  >
    <section class="cms-query-panel">
      <el-form class="cms-query-form" :inline="true" :model="filters" label-width="88px">
        <el-form-item label="一级科目">
          <el-input v-model="filters.firstSubjectName" clearable placeholder="辅助材料 / 工资" />
        </el-form-item>
        <el-form-item label="二级编码">
          <el-input v-model="filters.secondSubjectCode" clearable placeholder="二级科目编码" />
        </el-form-item>
        <el-form-item label="二级科目">
          <el-input v-model="filters.secondSubjectName" clearable placeholder="辅助人员工资" />
        </el-form-item>
        <el-form-item class="cms-query-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <el-table class="cms-raw-table" :data="rows" stripe border v-loading="loading">
      <el-table-column prop="rowNo" label="Excel行号" width="90" />
      <el-table-column prop="firstSubjectCode" label="一级科目编码" width="120" />
      <el-table-column prop="firstSubjectName" label="一级科目名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="secondSubjectCode" label="二级科目编码" width="120" />
      <el-table-column prop="secondSubjectName" label="二级科目名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="thirdSubjectCode" label="三级科目编码" width="120" />
      <el-table-column prop="thirdSubjectName" label="三级科目名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="导入时间" width="170" />
      <template #empty>
        <el-empty description="暂无科目设置数据" />
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
  fetchCmsSubjectSettings,
  normalizeCmsCostPage,
  toCmsCostPageParams,
} from '../api/cmsCost'

const route = useRoute()
const filters = reactive({
  firstSubjectName: String(route.query.firstSubjectName || ''),
  secondSubjectCode: String(route.query.secondSubjectCode || ''),
  secondSubjectName: String(route.query.secondSubjectName || ''),
})
const rows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

function buildParams() {
  return toCmsCostPageParams(
    {
      firstSubjectName: filters.firstSubjectName.trim(),
      secondSubjectCode: filters.secondSubjectCode.trim(),
      secondSubjectName: filters.secondSubjectName.trim(),
    },
    currentPage.value,
    pageSize.value,
  )
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeCmsCostPage(await fetchCmsSubjectSettings(buildParams()))
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'CMS 科目设置查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  filters.firstSubjectName = ''
  filters.secondSubjectCode = ''
  filters.secondSubjectName = ''
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

.cms-query-form :deep(.el-input) {
  width: 188px;
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
