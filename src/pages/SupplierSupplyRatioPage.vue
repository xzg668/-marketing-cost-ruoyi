<template>
  <div class="supplier-ratio-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>供应商供货比例</h1>
        <p>基础数据 / 供应关系</p>
      </div>
      <div class="toolbar-actions">
        <el-button v-hasPermi="['base:supplier-supply-ratio:import']" :icon="Upload" @click="openImportDialog">导入 Excel</el-button>
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
        <el-form-item label="状态">
          <el-select v-model="filters.isActive" style="width: 120px">
            <el-option label="当前有效" :value="1" />
            <el-option label="历史失效" :value="0" />
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
        <el-table-column prop="importedAt" label="导入时间" width="170" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive === 1 ? 'success' : 'info'">{{ row.isActive === 1 ? '有效' : '失效' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.isActive === 1" v-hasPermi="['base:supplier-supply-ratio:edit']" type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button v-if="row.isActive === 1" v-hasPermi="['base:supplier-supply-ratio:remove']" type="danger" link @click="removeRow(row)">
              停用
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

    <SupplierSupplyRatioImportDialog v-model="importDialogVisible" @imported="onRatioImported" />

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
        <el-form-item label="供货比例">
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
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  RefreshLeft,
  RefreshRight,
  Search,
  Upload,
} from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import SupplierSupplyRatioImportDialog from '../components/SupplierSupplyRatioImportDialog.vue'
import { decimalToPercent, percentToDecimal, formatPercent } from '../utils/supplierSupplyRatio'
import {
  deleteSupplierSupplyRatio,
  fetchSupplierSupplyRatios,
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
  isActive: 1,
})
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const importDialogVisible = ref(false)
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
  supplyRatioPercent: null,
  effectiveFrom: '',
  effectiveTo: '',
})

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
    isActive: filters.isActive,
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
  filters.isActive = 1
  applyFilters()
}

function openImportDialog() {
  importDialogVisible.value = true
}

function onRatioImported() {
  filters.isActive = 1
  currentPage.value = 1
  fetchRows()
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
      `确认停用 ${row.materialCode || ''} / ${row.supplierName || ''}？原记录将保留在历史数据中。`,
      '停用供货比例',
      { type: 'warning' }
    )
  } catch (error) {
    return
  }
  await deleteSupplierSupplyRatio(row.id)
  ElMessage.success('供货比例已停用，历史记录已保留')
  fetchRows()
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

}
</style>
