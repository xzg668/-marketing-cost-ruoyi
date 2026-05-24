<template>
  <div class="u9-material-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>料品主档</h1>
        <p>基础数据 / U9基础数据</p>
      </div>
      <div class="toolbar-actions">
        <el-button v-hasPermi="['base:u9-material:list']" :icon="RefreshRight" @click="refreshAll">刷新</el-button>
        <el-button
          v-hasPermi="['base:u9-material:export']"
          :icon="Grid"
          @click="openMappingDrawer"
        >
          字段映射
        </el-button>
        <el-button
          v-hasPermi="['base:u9-material:import']"
          type="primary"
          :icon="Upload"
          @click="openImportDialog"
        >
          上传 Excel
        </el-button>
      </div>
    </section>

    <section class="batch-panel">
      <div class="section-title">
        <h2>批次列表</h2>
      </div>
      <el-table :data="batchRows" border stripe size="small" v-loading="batchLoading" max-height="220">
        <el-table-column prop="batchNo" label="批次" min-width="210" show-overflow-tooltip />
        <el-table-column prop="sourceType" label="来源" width="95" />
        <el-table-column prop="mappingVersion" label="映射版本" min-width="180" show-overflow-tooltip />
        <el-table-column prop="totalCount" label="总行数" width="110" align="right" />
        <el-table-column prop="successCount" label="成功" width="100" align="right" />
        <el-table-column prop="failCount" label="失败" width="100" align="right" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="batchStatusType(row.status)">
              {{ row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无批次" />
        </template>
      </el-table>
    </section>

    <section class="query-panel">
      <el-form class="query-form" :model="filters" :inline="true" label-width="78px">
        <el-form-item label="料号">
          <el-input v-model="filters.materialCode" clearable placeholder="301050066" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="filters.materialName" clearable placeholder="物料名称" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="filters.spec" clearable placeholder="规格" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="filters.model" clearable placeholder="型号" />
        </el-form-item>
        <el-form-item label="图号">
          <el-input v-model="filters.drawingNo" clearable placeholder="图号" />
        </el-form-item>
        <el-form-item label="物料形态">
          <el-input v-model="filters.shapeAttr" clearable placeholder="制造件/采购件" />
        </el-form-item>
        <el-form-item label="主分类">
          <el-input v-model="filters.mainCategory" clearable placeholder="电磁阀" />
        </el-form-item>
        <el-form-item label="成本要素">
          <el-input v-model="filters.costElement" clearable placeholder="主要材料" />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.bizUnit" clearable placeholder="事业部" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="filters.dept" clearable placeholder="部门" />
        </el-form-item>
        <el-form-item label="批次">
          <el-select v-model="filters.batch" clearable filterable placeholder="最新有效批次" style="width: 220px">
            <el-option
              v-for="batch in batchRows"
              :key="batch.batchNo"
              :label="batch.batchNo"
              :value="batch.batchNo"
            />
          </el-select>
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button v-hasPermi="['base:u9-material:list']" type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <div class="table-meta">
        <span>共 {{ total }} 条</span>
      </div>
      <el-table
        :data="rawRows"
        stripe
        border
        row-key="materialCode"
        v-loading="loading"
        class="raw-table"
      >
        <el-table-column prop="materialCode" label="料号" width="145" fixed show-overflow-tooltip />
        <el-table-column prop="materialName" label="名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="materialSpec" label="规格" min-width="160" show-overflow-tooltip />
        <el-table-column prop="materialModel" label="型号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="drawingNo" label="图号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="shapeAttr" label="物料形态" width="115" show-overflow-tooltip />
        <el-table-column prop="mainCategoryCode" label="主分类代码" width="130" show-overflow-tooltip />
        <el-table-column prop="mainCategoryName" label="主分类名称" width="130" show-overflow-tooltip />
        <el-table-column prop="costElement" label="成本要素" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productionDivision" label="事业部" min-width="150" show-overflow-tooltip />
        <el-table-column prop="departmentName" label="部门" min-width="140" show-overflow-tooltip />
        <el-table-column prop="importBatchId" label="批次" min-width="190" show-overflow-tooltip />
        <el-table-column label="更新时间" width="165">
          <template #default="{ row }">
            {{ row.updatedAt || row.updateTime || row.createdAt || '-' }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 U9 料品主档" />
        </template>
      </el-table>

      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </section>

    <el-dialog v-model="importDialogVisible" title="导入 U9 料品主档" width="780px">
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
          <div class="upload-title">选择 U9 料品主档 Excel</div>
          <div class="upload-tip">.xlsx / .xls，最大 150MB</div>
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
          <div class="batch-line">批次：{{ importResult.batchNo || '-' }}</div>
          <el-table
            v-if="importResult.errors.length"
            :data="importResult.errors"
            border
            size="small"
            max-height="240"
          >
            <el-table-column prop="excelRow" label="Excel行" width="95" />
            <el-table-column prop="materialCode" label="料号" width="140" show-overflow-tooltip />
            <el-table-column prop="reason" label="失败原因" min-width="360" show-overflow-tooltip />
          </el-table>
        </section>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button
          v-hasPermi="['base:u9-material:import']"
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
        <el-table-column prop="header" label="表头" min-width="180" show-overflow-tooltip />
        <el-table-column prop="field" label="raw字段" min-width="220" show-overflow-tooltip />
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
  fetchU9MaterialBatches,
  fetchU9MaterialRaw,
  fetchU9MaterialTemplateMapping,
  getU9MaterialUploadFile,
  getU9MaterialUploadFileName,
  importU9MaterialExcel,
  normalizeU9MaterialBatches,
  normalizeU9MaterialImportResult,
  normalizeU9MaterialRawPage,
  validateU9MaterialFile,
} from '../api/u9MaterialMaster'

const filters = reactive({
  materialCode: '',
  materialName: '',
  spec: '',
  model: '',
  drawingNo: '',
  shapeAttr: '',
  mainCategory: '',
  costElement: '',
  bizUnit: '',
  dept: '',
  batch: '',
})

const batchRows = ref([])
const batchLoading = ref(false)
const rawRows = ref([])
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
    materialCode: filters.materialCode.trim(),
    materialName: filters.materialName.trim(),
    spec: filters.spec.trim(),
    model: filters.model.trim(),
    drawingNo: filters.drawingNo.trim(),
    shapeAttr: filters.shapeAttr.trim(),
    mainCategory: filters.mainCategory.trim(),
    costElement: filters.costElement.trim(),
    bizUnit: filters.bizUnit.trim(),
    dept: filters.dept.trim(),
    batch: filters.batch,
    page: currentPage.value,
    pageSize: pageSize.value,
  }
}

async function fetchBatches() {
  batchLoading.value = true
  try {
    batchRows.value = normalizeU9MaterialBatches(await fetchU9MaterialBatches())
  } catch (error) {
    ElMessage.error(error.message || 'U9 料品主档批次查询失败')
  } finally {
    batchLoading.value = false
  }
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeU9MaterialRawPage(await fetchU9MaterialRaw(queryParams()))
    rawRows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'U9 料品主档查询失败')
  } finally {
    loading.value = false
  }
}

function refreshAll() {
  fetchBatches()
  fetchRows()
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
  const raw = getU9MaterialUploadFile(file)
  const validation = validateU9MaterialFile(raw)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    uploadFile.value = null
    uploadFileName.value = ''
    return
  }
  uploadFile.value = raw
  uploadFileName.value = getU9MaterialUploadFileName(raw)
}

async function submitImport() {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择 U9 料品主档 Excel')
    return
  }
  importing.value = true
  try {
    // 导入耗时可能较长，结果留在弹窗内展示，便于直接查看失败行。
    importResult.value = normalizeU9MaterialImportResult(
      await importU9MaterialExcel({ file: uploadFile.value })
    )
    ElMessage.success('U9 料品主档导入完成')
    uploadFile.value = null
    uploadFileName.value = ''
    await fetchBatches()
    currentPage.value = 1
    await fetchRows()
  } catch (error) {
    ElMessage.error(error.message || 'U9 料品主档导入失败')
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
    mappingRows.value = await fetchU9MaterialTemplateMapping()
  } catch (error) {
    ElMessage.error(error.message || 'U9 字段映射查询失败')
  } finally {
    mappingLoading.value = false
  }
}

function batchStatusType(status) {
  if (status === 'PARSED' || status === 'SUCCESS') return 'success'
  if (status === 'PARTIAL_SUCCESS') return 'warning'
  if (status === 'FAILED') return 'danger'
  if (status === 'ARCHIVED') return 'info'
  return undefined
}

watch([currentPage, pageSize], fetchRows)
onMounted(refreshAll)
</script>

<style scoped>
.u9-material-page {
  padding: 16px;
  color: #1f2937;
}

.page-toolbar,
.section-title,
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

.batch-panel,
.query-panel,
.table-panel {
  margin-bottom: 14px;
  padding: 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.section-title {
  margin-bottom: 10px;
}

.section-title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
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

.query-form :deep(.el-input) {
  width: 180px;
}

.query-actions {
  min-width: 180px;
}

.table-meta {
  justify-content: flex-start;
  margin-bottom: 10px;
  color: #6b7280;
  font-size: 13px;
}

.raw-table {
  width: 100%;
}

.import-panel {
  display: grid;
  gap: 14px;
}

.u9-upload {
  width: 100%;
}

.upload-icon {
  color: #64748b;
  font-size: 34px;
}

.upload-title {
  margin-top: 8px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.upload-tip,
.selected-file,
.batch-line {
  color: #6b7280;
  font-size: 13px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.selected-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-result {
  display: grid;
  gap: 12px;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
}

.result-metrics div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.result-metrics span {
  display: block;
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 12px;
}

.result-metrics strong {
  display: block;
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 920px) {
  .page-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }

  .result-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
