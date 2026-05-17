<template>
  <cms-cost-page-shell
    class="material-scrap-ref-page"
    title="CMS 回收废料映射"
    description="Excel 导入 CMS 原材料与回收废料映射；后续 CMS 自动同步也会沉淀为当前有效映射。废料回收价仍在价格源管理维护。"
  >
    <template #actions>
      <div class="mapping-upload-actions">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleUploadChange"
        >
          <el-button :icon="Upload">选择映射 Excel</el-button>
        </el-upload>
        <span
          v-if="uploadFileName"
          class="upload-file-name"
          :title="uploadFileName"
        >
          {{ uploadFileName }}
        </span>
        <el-button
          v-hasPermi="['cms:cost:import']"
          type="primary"
          :icon="DocumentChecked"
          :disabled="!uploadFile"
          :loading="importing"
          @click="submitImport"
        >
          导入映射
        </el-button>
      </div>
    </template>

    <section class="cms-query-panel">
      <el-form class="cms-query-form" :inline="true" :model="filters" label-width="84px">
        <el-form-item label="原材料料号">
          <el-input v-model="filters.materialCode" clearable placeholder="301050066" />
        </el-form-item>
        <el-form-item label="回收料号">
          <el-input v-model="filters.scrapCode" clearable placeholder="301990317" />
        </el-form-item>
        <el-form-item label="名称关键字">
          <el-input v-model="filters.keyword" clearable placeholder="材料或回收废料名称" />
        </el-form-item>
        <el-form-item class="cms-query-actions">
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="mapping-table-header">
      <h2>当前有效映射</h2>
    </section>

    <el-table
      class="cms-mapping-table"
      :data="currentRows"
      stripe
      border
      v-loading="loading"
    >
      <el-table-column prop="materialCode" label="原材料料号" width="140" fixed />
      <el-table-column prop="materialName" label="原材料名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="materialSpec" label="原材料规格" min-width="150" show-overflow-tooltip />
      <el-table-column prop="materialUnit" label="原材料单位" width="100" />
      <el-table-column prop="scrapCode" label="CMS回收废料料号" width="160" />
      <el-table-column prop="scrapName" label="回收废料名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="scrapSpec" label="回收废料规格" min-width="150" show-overflow-tooltip />
      <el-table-column prop="scrapUnit" label="回收废料单位" width="110" />
      <el-table-column prop="cmsPostingPeriod" label="CMS期间" width="105" />
      <el-table-column prop="cmsEffectiveDate" label="生效日期" width="120" />
      <el-table-column prop="sourceDocNo" label="CMS单据" width="150" show-overflow-tooltip />
      <el-table-column prop="updatedAt" label="更新时间" width="170" />
      <template #empty>
        <el-empty description="暂无回收废料映射" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="currentTotal"
    />

  </cms-cost-page-shell>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DocumentChecked,
  RefreshRight,
  Search,
  Upload,
} from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import CmsCostPageShell from '../components/CmsCostPageShell.vue'
import { getCmsCostUploadFile, getCmsCostUploadFileName, validateCmsCostFile } from '../api/cmsCost'
import {
  fetchCmsMaterialScrapRefsCurrent,
  importCmsMaterialScrapRefExcel,
  normalizeCmsMaterialScrapRefPage,
} from '../api/cmsMaterialScrapRef'

const filters = reactive({
  materialCode: '',
  scrapCode: '',
  keyword: '',
})
const currentRows = ref([])
const currentTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const importing = ref(false)
const uploadFile = ref(null)
const uploadFileName = ref('')

function commonParams() {
  return {
    materialCode: filters.materialCode.trim(),
    scrapCode: filters.scrapCode.trim(),
    keyword: filters.keyword.trim(),
  }
}

function pagedParams(extra = {}) {
  return {
    ...commonParams(),
    ...extra,
    current: currentPage.value,
    size: pageSize.value,
  }
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeCmsMaterialScrapRefPage(await fetchCmsMaterialScrapRefsCurrent(pagedParams()))
    currentRows.value = page.list
    currentTotal.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'CMS 原材料对应回收废料查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  filters.materialCode = ''
  filters.scrapCode = ''
  filters.keyword = ''
  applyFilters()
}

function handleUploadChange(file) {
  const raw = getCmsCostUploadFile(file)
  const validation = validateCmsCostFile(raw)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    uploadFile.value = null
    uploadFileName.value = ''
    return
  }
  uploadFile.value = raw
  uploadFileName.value = getCmsCostUploadFileName(raw)
}

async function submitImport() {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择原材料对应回收废料 Excel')
    return
  }
  importing.value = true
  try {
    await importCmsMaterialScrapRefExcel({
      file: uploadFile.value,
    })
    ElMessage.success('回收废料映射导入完成')
    currentPage.value = 1
    fetchRows()
  } catch (error) {
    ElMessage.error(error.message || 'CMS 原材料对应回收废料导入失败')
  } finally {
    importing.value = false
  }
}

watch([currentPage, pageSize], fetchRows)
onMounted(fetchRows)
</script>

<style scoped>
.material-scrap-ref-page :deep(.cms-cost-page__header) {
  align-items: center;
  gap: 24px;
  margin-bottom: 16px;
}

.material-scrap-ref-page :deep(.cms-cost-page__header > div:first-child) {
  min-width: 0;
}

.material-scrap-ref-page :deep(.cms-cost-page__header h1) {
  color: #1f2937;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
}

.material-scrap-ref-page :deep(.cms-cost-page__header p) {
  max-width: 820px;
  color: #5f6b7a;
  font-size: 14px;
  line-height: 1.65;
}

.material-scrap-ref-page :deep(.cms-cost-page__actions) {
  flex: 0 0 auto;
}

.material-scrap-ref-page :deep(.cms-cost-page__body) {
  border-color: #e3e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mapping-upload-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.upload-file-name {
  display: block;
  min-width: 0;
  max-width: 220px;
  overflow: hidden;
  padding: 0 10px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #f8fafc;
  color: #526173;
  font-size: 13px;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cms-query-panel {
  margin: -2px 0 14px;
  padding: 14px 14px 4px;
  border-bottom: 1px solid #e5eaf3;
  border-radius: 6px 6px 0 0;
  background: #f8fafc;
}

.cms-query-form :deep(.el-form-item) {
  margin-right: 20px;
  margin-bottom: 12px;
}

.cms-query-form :deep(.el-form-item__label) {
  color: #344256;
  font-weight: 600;
}

.cms-query-form :deep(.el-input) {
  width: 210px;
}

.cms-query-form :deep(.el-select) {
  width: 150px;
}

.cms-query-actions {
  margin-left: 0;
}

.mapping-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 10px;
}

.mapping-table-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 15px;
  font-weight: 700;
}

.cms-mapping-table {
  width: 100%;
  overflow: hidden;
  border-radius: 6px;
}

.cms-mapping-table :deep(.el-table__header th) {
  background: #f8fafc;
  color: #596474;
  font-weight: 600;
}

.cms-mapping-table :deep(.el-table__cell) {
  padding: 8px 0;
}

.cms-mapping-table :deep(.el-empty) {
  padding: 28px 0;
}

@media (max-width: 768px) {
  .material-scrap-ref-page :deep(.cms-cost-page__header) {
    align-items: stretch;
    gap: 14px;
  }

  .mapping-upload-actions {
    justify-content: flex-start;
  }

  .upload-file-name {
    max-width: 100%;
  }

  .cms-query-form :deep(.el-input),
  .cms-query-form :deep(.el-select) {
    width: 100%;
  }
}
</style>
