<template>
  <div class="supplier-ratio-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>供应商供货比例</h1>
        <p>基础数据 / 供应关系</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="Upload" @click="openImportDialog">导入 Excel</el-button>
        <el-button type="primary" :icon="RefreshRight" @click="fetchRows">刷新</el-button>
      </div>
    </section>

    <section class="query-panel">
      <el-form :model="filters" class="query-form" :inline="true" label-width="78px">
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" clearable placeholder="203240251" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="filters.materialName" clearable placeholder="小阀座" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="filters.specModel" clearable placeholder="SHF-..." />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="filters.supplierName" clearable placeholder="供应商名称" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filters.sourceType" clearable placeholder="全部" style="width: 120px">
            <el-option
              v-for="option in SOURCE_TYPE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <el-table :data="tableRows" stripe border v-loading="loading" class="ratio-table">
        <el-table-column prop="materialCode" label="物料代码" width="140" fixed />
        <el-table-column prop="materialName" label="物料名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="specModel" label="型号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column prop="materialShape" label="形态属性" width="100" />
        <el-table-column prop="supplierName" label="供应商" min-width="190" show-overflow-tooltip />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" show-overflow-tooltip />
        <el-table-column label="供货比例" width="110" align="right">
          <template #default="{ row }">
            <span class="ratio-value">{{ formatPercent(row.supplyRatio) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="95">
          <template #default="{ row }">
            <el-tag size="small" :type="sourceTagType(row.sourceType)">
              {{ row.sourceType || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceBatchNo" label="批次" min-width="170" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button v-hasPermi="['base:supplier-supply-ratio:edit']" type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button v-hasPermi="['base:supplier-supply-ratio:remove']" type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无供应商供货比例" />
        </template>
      </el-table>

      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </section>

    <el-dialog v-model="importDialogVisible" title="导入供应商供货比例" width="720px">
      <div class="import-panel">
        <el-alert
          title="导入去重口径：业务单元 + 物料代码 + 供应商。重复导入同一业务键会更新已有行。"
          type="info"
          show-icon
          :closable="false"
        />
        <el-upload
          class="ratio-upload"
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleUploadChange"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-title">拖拽或点击选择 Excel</div>
          <div class="upload-tip">支持 .xls / .xlsx</div>
        </el-upload>
        <div v-if="uploadFileName" class="selected-file">
          <el-icon><Document /></el-icon>
          <span :title="uploadFileName">{{ uploadFileName }}</span>
        </div>
        <section v-if="importResult" class="import-result">
          <div class="result-metrics">
            <div><span>总行数</span><strong>{{ importResult.totalRows || 0 }}</strong></div>
            <div><span>新增</span><strong>{{ importResult.insertedRows || 0 }}</strong></div>
            <div><span>更新</span><strong>{{ importResult.updatedRows || 0 }}</strong></div>
            <div><span>跳过</span><strong>{{ importResult.skippedRows || 0 }}</strong></div>
            <div><span>错误</span><strong>{{ importResult.errorRows || 0 }}</strong></div>
          </div>
          <div class="batch-line">批次：{{ importResult.batchNo || '-' }}</div>
          <el-table
            v-if="Array.isArray(importResult.errors) && importResult.errors.length"
            :data="errorRows"
            border
            size="small"
            max-height="220"
          >
            <el-table-column prop="index" label="#" width="60" />
            <el-table-column prop="message" label="错误明细" min-width="420" show-overflow-tooltip />
          </el-table>
        </section>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button
          v-hasPermi="['base:supplier-supply-ratio:import']"
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

    <el-dialog v-model="editDialogVisible" title="编辑供货比例" width="560px">
      <el-form :model="editForm" label-width="96px">
        <el-form-item label="物料代码">
          <el-input v-model="editForm.materialCode" disabled />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="editForm.materialName" disabled />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="editForm.specModel" disabled />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="editForm.supplierName" disabled />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="editForm.supplierCode" clearable />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="editForm.unit" clearable />
        </el-form-item>
        <el-form-item label="形态属性">
          <el-input v-model="editForm.materialShape" clearable />
        </el-form-item>
        <el-form-item label="供货比例" required>
          <el-input-number
            v-model="editForm.supplyRatioPercent"
            :min="0"
            :max="100"
            :precision="2"
            :step="1"
            controls-position="right"
            style="width: 180px"
          />
          <span class="percent-unit">%</span>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="editForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker v-model="editForm.effectiveTo" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document,
  DocumentChecked,
  RefreshLeft,
  RefreshRight,
  Search,
  Upload,
  UploadFilled,
} from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import { getCmsCostUploadFile, getCmsCostUploadFileName, validateCmsCostFile } from '../api/cmsCost'
import {
  deleteSupplierSupplyRatio,
  fetchSupplierSupplyRatios,
  importSupplierSupplyRatioExcel,
  normalizeSupplierSupplyRatioPage,
  updateSupplierSupplyRatio,
} from '../api/supplierSupplyRatios'

const SOURCE_TYPE_OPTIONS = [
  { value: 'EXCEL', label: 'EXCEL', tag: 'primary' },
  { value: 'SRM', label: 'SRM', tag: 'success' },
  { value: 'MANUAL', label: 'MANUAL', tag: 'warning' },
]

const filters = reactive({
  materialCode: '',
  materialName: '',
  specModel: '',
  supplierName: '',
  sourceType: '',
})
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const importDialogVisible = ref(false)
const uploadFile = ref(null)
const uploadFileName = ref('')
const importing = ref(false)
const importResult = ref(null)

const editDialogVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)
const editForm = reactive({
  materialCode: '',
  materialName: '',
  specModel: '',
  supplierName: '',
  supplierCode: '',
  unit: '',
  materialShape: '',
  supplyRatioPercent: 0,
  effectiveFrom: '',
  effectiveTo: '',
})

const errorRows = computed(() =>
  (importResult.value?.errors || []).map((message, index) => ({
    index: index + 1,
    message,
  }))
)

function sourceTagType(value) {
  return SOURCE_TYPE_OPTIONS.find((option) => option.value === value)?.tag || ''
}

function queryParams() {
  return {
    materialCode: filters.materialCode.trim(),
    materialName: filters.materialName.trim(),
    specModel: filters.specModel.trim(),
    supplierName: filters.supplierName.trim(),
    sourceType: filters.sourceType,
    page: currentPage.value,
    pageSize: pageSize.value,
  }
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeSupplierSupplyRatioPage(await fetchSupplierSupplyRatios(queryParams()))
    tableRows.value = page.list
    total.value = page.total
  } catch (error) {
    ElMessage.error(error.message || '供应商供货比例查询失败')
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
  filters.materialName = ''
  filters.specModel = ''
  filters.supplierName = ''
  filters.sourceType = ''
  applyFilters()
}

function openImportDialog() {
  importDialogVisible.value = true
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
  importResult.value = null
}

async function submitImport() {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择供应商供货比例 Excel')
    return
  }
  importing.value = true
  try {
    // 当前 Excel 导入按“业务单元+物料代码+供应商”在后端做幂等 upsert，前端只负责传原始文件。
    importResult.value = await importSupplierSupplyRatioExcel({ file: uploadFile.value })
    ElMessage.success('供应商供货比例导入完成')
    currentPage.value = 1
    fetchRows()
  } catch (error) {
    ElMessage.error(error.message || '供应商供货比例导入失败')
  } finally {
    importing.value = false
  }
}

function openEdit(row) {
  editingId.value = row.id
  editForm.materialCode = row.materialCode || ''
  editForm.materialName = row.materialName || ''
  editForm.specModel = row.specModel || ''
  editForm.supplierName = row.supplierName || ''
  editForm.supplierCode = row.supplierCode || ''
  editForm.unit = row.unit || ''
  editForm.materialShape = row.materialShape || ''
  editForm.supplyRatioPercent = decimalToPercent(row.supplyRatio)
  editForm.effectiveFrom = row.effectiveFrom || ''
  editForm.effectiveTo = row.effectiveTo || ''
  editDialogVisible.value = true
}

async function submitEdit() {
  if (!editingId.value) {
    return
  }
  if (editForm.supplyRatioPercent === null || editForm.supplyRatioPercent === undefined) {
    ElMessage.warning('供货比例不能为空')
    return
  }
  saving.value = true
  try {
    await updateSupplierSupplyRatio(editingId.value, {
      unit: editForm.unit,
      materialShape: editForm.materialShape,
      supplierCode: editForm.supplierCode,
      supplyRatio: percentToDecimal(editForm.supplyRatioPercent),
      effectiveFrom: editForm.effectiveFrom || null,
      effectiveTo: editForm.effectiveTo || null,
    })
    ElMessage.success('供货比例已更新')
    editDialogVisible.value = false
    fetchRows()
  } catch (error) {
    ElMessage.error(error.message || '供货比例更新失败')
  } finally {
    saving.value = false
  }
}

async function removeRow(row) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${row.materialCode || ''} / ${row.supplierName || ''} 的供货比例？`,
      '删除供货比例',
      { type: 'warning' }
    )
  } catch (error) {
    return
  }
  await deleteSupplierSupplyRatio(row.id)
  ElMessage.success('供货比例已删除')
  fetchRows()
}

function decimalToPercent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Number((number * 100).toFixed(2)) : 0
}

function percentToDecimal(value) {
  // 后端统一保存 decimal：页面 60% 对应传 0.600000，避免导入和手工编辑口径不一致。
  const number = Number(value)
  return Number.isFinite(number) ? Number((number / 100).toFixed(6)) : 0
}

function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return '-'
  }
  return `${(number * 100).toFixed(2)}%`
}

watch([currentPage, pageSize], fetchRows)
onMounted(fetchRows)
</script>

<style scoped>
.supplier-ratio-page {
  padding: 18px;
}

.page-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.page-title {
  min-width: 0;
}

.page-title h1 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
}

.page-title p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.query-panel,
.table-panel {
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}

.query-form :deep(.el-form-item) {
  margin-bottom: 8px;
}

.query-actions {
  margin-left: auto;
}

.ratio-table :deep(.el-table__cell) {
  padding: 8px 0;
}

.ratio-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.import-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ratio-upload :deep(.el-upload) {
  width: 100%;
}

.ratio-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 24px 16px;
  border-radius: 8px;
}

.upload-icon {
  color: #3b82f6;
  font-size: 34px;
}

.upload-title {
  margin-top: 6px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.upload-tip {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #475569;
  font-size: 13px;
}

.selected-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.result-metrics div {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.result-metrics span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.result-metrics strong {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.batch-line {
  color: #475569;
  font-size: 13px;
}

.percent-unit {
  margin-left: 8px;
  color: #64748b;
}

@media (max-width: 860px) {
  .supplier-ratio-page {
    padding: 12px;
  }

  .page-toolbar {
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .query-actions {
    margin-left: 0;
  }

  .result-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
