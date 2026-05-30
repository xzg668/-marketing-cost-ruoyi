<template>
  <div class="u9-bom-byproduct-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>BOM副产品档案</h1>
        <p>基础数据 / U9基础数据</p>
      </div>
      <div class="toolbar-actions">
        <el-button v-hasPermi="['base:u9-bom-byproduct:list']" :icon="RefreshRight" @click="fetchRows">刷新</el-button>
        <el-button
          v-hasPermi="['base:u9-bom-byproduct:export']"
          :icon="Grid"
          @click="openMappingDrawer"
        >
          字段映射
        </el-button>
        <el-button
          v-hasPermi="['base:u9-bom-byproduct:import']"
          type="primary"
          :icon="Upload"
          @click="openImportDialog"
        >
          上传 Excel
        </el-button>
      </div>
    </section>

    <section class="query-panel">
      <el-form class="query-form" :model="filters" :inline="true" label-width="92px">
        <el-form-item label="母件料号">
          <el-input v-model="filters.parentMaterialNo" clearable placeholder="母件料号" />
        </el-form-item>
        <el-form-item label="母件名称">
          <el-input v-model="filters.parentMaterialName" clearable placeholder="母件名称" />
        </el-form-item>
        <el-form-item label="副产品料号">
          <el-input v-model="filters.byproductMaterialNo" clearable placeholder="副产品料号" />
        </el-form-item>
        <el-form-item label="副产品名称">
          <el-input v-model="filters.byproductMaterialName" clearable placeholder="副产品名称" />
        </el-form-item>
        <el-form-item label="BOM目的">
          <el-input v-model="filters.bomPurpose" clearable placeholder="主制造" />
        </el-form-item>
        <el-form-item label="状态">
          <el-input v-model="filters.status" clearable placeholder="已核准" />
        </el-form-item>
        <el-form-item label="有效日期">
          <el-date-picker
            v-model="filters.asOfDate"
            type="date"
            value-format="YYYY-MM-DD"
            clearable
            placeholder="按生失效过滤"
          />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button v-hasPermi="['base:u9-bom-byproduct:list']" type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <div class="table-meta">
        <span>共 {{ total }} 条</span>
        <span class="natural-key">去重键：BOM目的 + 母件料号 + 副产品料号 + 生效日期 + 失效日期</span>
      </div>
      <el-table
        :data="rows"
        stripe
        border
        row-key="id"
        v-loading="loading"
        class="byproduct-table"
      >
        <el-table-column prop="parentMaterialNo" label="母件料号" width="150" fixed show-overflow-tooltip />
        <el-table-column prop="parentMaterialName" label="母件名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="parentMaterialSpec" label="母件规格" min-width="150" show-overflow-tooltip />
        <el-table-column prop="bomPurpose" label="BOM目的" width="105" show-overflow-tooltip />
        <el-table-column prop="versionNo" label="版本号" width="95" show-overflow-tooltip />
        <el-table-column prop="outputType" label="产出类型" width="105" show-overflow-tooltip />
        <el-table-column prop="byproductMaterialNo" label="副产品料号" width="150" show-overflow-tooltip />
        <el-table-column prop="byproductMaterialName" label="副产品名称" min-width="190" show-overflow-tooltip />
        <el-table-column prop="operationNo" label="工序号" width="90" show-overflow-tooltip />
        <el-table-column prop="outputQty" label="产出数量" width="110" align="right" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column prop="productionDeptCode" label="生产部门编码" width="125" show-overflow-tooltip />
        <el-table-column prop="productionDeptName" label="生产部门" min-width="160" show-overflow-tooltip />
        <el-table-column prop="effectiveFrom" label="生效日期" width="115" />
        <el-table-column prop="effectiveTo" label="失效日期" width="115" />
        <el-table-column prop="sourceFileName" label="来源文件" min-width="190" show-overflow-tooltip />
        <el-table-column label="更新时间" width="165">
          <template #default="{ row }">
            {{ row.updatedAt || row.importedAt || '-' }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 U9 BOM副产品档案" />
        </template>
      </el-table>

      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </section>

    <el-dialog v-model="importDialogVisible" title="导入 U9 BOM副产品档案" width="760px">
      <div class="import-panel">
        <el-upload
          class="u9-upload"
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleUploadChange"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-title">选择 BOMMaster 副产品 Excel</div>
          <div class="upload-tip">按 5 字段自然键幂等导入，不产生批次</div>
        </el-upload>
        <div v-if="uploadFileName" class="selected-file">
          <el-icon><Document /></el-icon>
          <span :title="uploadFileName">{{ uploadFileName }}</span>
        </div>

        <section v-if="importResult" class="import-result">
          <div class="result-metrics">
            <div><span>总行数</span><strong>{{ importResult.totalCount }}</strong></div>
            <div><span>成功</span><strong>{{ importResult.successCount }}</strong></div>
            <div><span>失败</span><strong>{{ importResult.failCount }}</strong></div>
            <div><span>状态</span><strong>{{ importResult.status || '-' }}</strong></div>
          </div>
          <el-table
            v-if="importResult.errors.length"
            :data="importResult.errors"
            border
            size="small"
            max-height="240"
          >
            <el-table-column prop="excelRow" label="Excel行" width="95" />
            <el-table-column prop="parentMaterialNo" label="母件料号" width="140" show-overflow-tooltip />
            <el-table-column prop="byproductMaterialNo" label="副产品料号" width="140" show-overflow-tooltip />
            <el-table-column prop="reason" label="失败原因" min-width="320" show-overflow-tooltip />
          </el-table>
        </section>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button
          v-hasPermi="['base:u9-bom-byproduct:import']"
          type="primary"
          :icon="DocumentChecked"
          :disabled="!uploadFile"
          :loading="importing"
          @click="submitImport"
        >
          导入
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="mappingDrawerVisible" title="字段映射" size="720px">
      <el-table :data="mappingRows" border stripe v-loading="mappingLoading">
        <el-table-column prop="excelColumn" label="Excel列" width="90" align="right" />
        <el-table-column prop="header" label="表头" min-width="220" show-overflow-tooltip />
        <el-table-column prop="field" label="表字段" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Document,
  DocumentChecked,
  Grid,
  RefreshLeft,
  RefreshRight,
  Search,
  Upload,
  UploadFilled,
} from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchU9BomByproductRows,
  fetchU9BomByproductTemplateMapping,
  getU9BomByproductUploadFile,
  getU9BomByproductUploadFileName,
  importU9BomByproductExcel,
  normalizeU9BomByproductImportResult,
  normalizeU9BomByproductPage,
  validateU9BomByproductFile,
} from '../api/u9BomByproduct'

const filters = reactive({
  parentMaterialNo: '',
  parentMaterialName: '',
  byproductMaterialNo: '',
  byproductMaterialName: '',
  bomPurpose: '',
  status: '',
  asOfDate: '',
})

const rows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const loading = ref(false)

const importDialogVisible = ref(false)
const uploadFile = ref(null)
const uploadFileName = ref('')
const importing = ref(false)
const importResult = ref(null)

const mappingDrawerVisible = ref(false)
const mappingLoading = ref(false)
const mappingRows = ref([])

function queryParams() {
  return {
    parentMaterialNo: filters.parentMaterialNo.trim(),
    parentMaterialName: filters.parentMaterialName.trim(),
    byproductMaterialNo: filters.byproductMaterialNo.trim(),
    byproductMaterialName: filters.byproductMaterialName.trim(),
    bomPurpose: filters.bomPurpose.trim(),
    status: filters.status.trim(),
    asOfDate: filters.asOfDate,
    page: currentPage.value,
    pageSize: pageSize.value,
  }
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeU9BomByproductPage(await fetchU9BomByproductRows(queryParams()))
    rows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'U9 BOM副产品档案查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key] = ''
  })
  applyFilters()
}

function openImportDialog() {
  importDialogVisible.value = true
}

function handleUploadChange(file) {
  const raw = getU9BomByproductUploadFile(file)
  const validation = validateU9BomByproductFile(raw)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    uploadFile.value = null
    uploadFileName.value = ''
    return
  }
  uploadFile.value = raw
  uploadFileName.value = getU9BomByproductUploadFileName(raw)
}

async function submitImport() {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择 U9 BOM副产品 Excel')
    return
  }
  importing.value = true
  try {
    importResult.value = normalizeU9BomByproductImportResult(
      await importU9BomByproductExcel({ file: uploadFile.value })
    )
    ElMessage.success('U9 BOM副产品档案导入完成')
    uploadFile.value = null
    uploadFileName.value = ''
    currentPage.value = 1
    await fetchRows()
  } catch (error) {
    ElMessage.error(error.message || 'U9 BOM副产品档案导入失败')
  } finally {
    importing.value = false
  }
}

async function openMappingDrawer() {
  mappingDrawerVisible.value = true
  if (mappingRows.value.length > 0) {
    return
  }
  mappingLoading.value = true
  try {
    mappingRows.value = await fetchU9BomByproductTemplateMapping()
  } catch (error) {
    ElMessage.error(error.message || 'U9 BOM副产品字段映射查询失败')
  } finally {
    mappingLoading.value = false
  }
}

watch([currentPage, pageSize], fetchRows)
onMounted(fetchRows)
</script>

<style scoped>
.u9-bom-byproduct-page {
  padding: 16px;
  color: #1f2937;
}

.page-toolbar,
.table-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-toolbar {
  margin-bottom: 14px;
}

.page-title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
}

.page-title p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.query-panel,
.table-panel {
  margin-bottom: 14px;
  padding: 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
}

.query-form :deep(.el-form-item) {
  margin-right: 4px;
  margin-bottom: 12px;
}

.query-form :deep(.el-input),
.query-form :deep(.el-date-editor) {
  width: 180px;
}

.query-actions {
  margin-left: auto;
}

.table-meta {
  margin-bottom: 10px;
  color: #4b5563;
  font-size: 13px;
}

.natural-key {
  color: #6b7280;
}

.byproduct-table {
  width: 100%;
}

.import-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.u9-upload :deep(.el-upload-dragger) {
  padding: 28px 16px;
}

.upload-icon {
  font-size: 42px;
  color: #2563eb;
}

.upload-title {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 600;
}

.upload-tip {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #374151;
}

.selected-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.result-metrics div {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.result-metrics span {
  display: block;
  color: #6b7280;
  font-size: 12px;
}

.result-metrics strong {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 18px;
}

@media (max-width: 760px) {
  .page-toolbar,
  .table-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }

  .query-actions {
    margin-left: 0;
  }

  .result-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
