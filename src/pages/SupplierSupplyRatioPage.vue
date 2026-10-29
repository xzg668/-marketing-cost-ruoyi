<template>
  <div class="supplier-ratio-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>供应商供货比例</h1>
        <p>基础数据 / 供应关系</p>
      </div>
      <div class="toolbar-actions">
        <el-button v-hasPermi="['base:supplier-supply-ratio:import']" :icon="Upload" @click="openImportDialog">导入 Excel</el-button>
        <el-button @click="openChanges()">变更记录</el-button>
        <el-button type="primary" :icon="RefreshRight" @click="fetchRows">刷新</el-button>
      </div>
    </section>

    <el-alert class="ratio-policy" title="仅导入新增或变动的物料/供应商关系；未出现的关系继续保留，相同内容不重复生成版本。0%表示退出供货，空白表示未填写。无需填写生效日期。" type="info" :closable="false" show-icon />
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
        <el-form-item label="供应商代码"><el-input v-model="filters.supplierCode" clearable placeholder="供应商代码" /></el-form-item>
        <el-form-item label="导入批次"><el-input v-model="filters.sourceBatchNo" clearable placeholder="批次号" /></el-form-item>
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
            <el-option label="当前版本" :value="1" />
            <el-option label="历史版本" :value="0" />
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
            <el-tag v-if="row.supplyRatio !== null && Number(row.supplyRatio) === 0" size="small" type="info">退出供货</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="95">
          <template #default="{ row }">
            <el-tag size="small" :type="sourceTagType(row.sourceType)">
              {{ row.sourceType || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceBatchNo" label="批次" min-width="170" show-overflow-tooltip>
          <template #default="{ row }"><el-button link type="primary" @click="openChanges(null, row.sourceBatchNo)">{{ row.sourceBatchNo || '—' }}</el-button></template>
        </el-table-column>
        <el-table-column prop="importFileName" label="导入文件" min-width="180" show-overflow-tooltip />
        <el-table-column prop="importedAt" label="导入时间" width="170" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive === 1 ? 'success' : 'info'">{{ row.isActive === 1 ? '当前版本' : '历史版本' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="170" />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openChanges(row)">变更记录</el-button>
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

    <el-dialog v-model="changeDialogVisible" title="供货关系变更记录 / 批次明细" width="92%">
      <el-form :inline="true" :model="changeFilters">
        <el-form-item label="物料代码"><el-input v-model="changeFilters.materialCode" clearable /></el-form-item>
        <el-form-item label="供应商代码"><el-input v-model="changeFilters.supplierCode" clearable /></el-form-item>
        <el-form-item label="批次"><el-input v-model="changeFilters.batchNo" clearable /></el-form-item>
        <el-button type="primary" @click="queryChanges">查询记录</el-button>
      </el-form>
      <el-table :data="changeRows" border v-loading="changeLoading" max-height="560">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="supplierRatioChangeFields(row)" size="small" border>
              <el-table-column prop="label" label="变更内容" /><el-table-column prop="before" label="改前" /><el-table-column prop="after" label="改后" />
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="materialCode" label="物料代码" width="140" />
        <el-table-column prop="supplierCode" label="供应商代码" width="130" />
        <el-table-column prop="supplierName" label="供应商" min-width="150" />
        <el-table-column label="改前比例" width="110"><template #default="{ row }">{{ row.before ? formatPercent(row.before.supplyRatio) : '无原记录' }}</template></el-table-column>
        <el-table-column label="改后比例" width="110"><template #default="{ row }">{{ formatPercent(row.after?.supplyRatio) }}</template></el-table-column>
        <el-table-column label="版本关联" width="140"><template #default="{ row }">{{ row.previousVersionId ?? '新增' }} → {{ row.versionId }}</template></el-table-column>
        <el-table-column prop="changedByName" label="操作人" width="130" />
        <el-table-column prop="changedAt" label="导入时间" width="180" />
        <el-table-column prop="importFileName" label="导入文件" min-width="200" />
        <el-table-column prop="batchNo" label="导入批次" min-width="210" />
        <template #empty><el-empty description="没有匹配的变更记录；历史版本可在主表切换查看" /></template>
      </el-table>
      <BasePagination v-model:current-page="changePage" v-model:page-size="changePageSize" :total="changeTotal" />
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { RefreshLeft, RefreshRight, Search, Upload } from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import SupplierSupplyRatioImportDialog from '../components/SupplierSupplyRatioImportDialog.vue'
import { formatPercent, normalizeSupplierRatioChange, supplierRatioChangeFields } from '../utils/supplierSupplyRatio'
import { fetchSupplierSupplyRatios, fetchSupplierSupplyRatioChanges, normalizeSupplierSupplyRatioPage } from '../api/supplierSupplyRatios'

const SOURCE_TYPE_OPTIONS = [
  { value: 'EXCEL', label: 'EXCEL', tag: 'primary' },
  { value: 'SRM', label: 'SRM', tag: 'success' },
  { value: 'MANUAL', label: 'MANUAL', tag: 'warning' },
]
const initialFilters = () => ({ materialCode: '', materialName: '', specModel: '', supplierName: '', supplierCode: '', sourceBatchNo: '', sourceType: '', isActive: 1 })
const filters = reactive(initialFilters())
const tableRows = ref([]), total = ref(0), currentPage = ref(1), pageSize = ref(20), loading = ref(false)
const importDialogVisible = ref(false), changeDialogVisible = ref(false), changeLoading = ref(false)
const changeFilters = reactive({ materialCode: '', supplierCode: '', batchNo: '' })
const changeRows = ref([]), changeTotal = ref(0), changePage = ref(1), changePageSize = ref(20)
const sourceTagType = (value) => SOURCE_TYPE_OPTIONS.find((option) => option.value === value)?.tag || ''
async function fetchRows() {
  loading.value = true
  try {
    const result = normalizeSupplierSupplyRatioPage(await fetchSupplierSupplyRatios({ ...filters, page: currentPage.value, pageSize: pageSize.value }))
    tableRows.value = result.list; total.value = result.total
  } catch (error) { ElMessage.error(error.message || '供应商供货比例查询失败') }
  finally { loading.value = false }
}
function applyFilters() { currentPage.value = 1; fetchRows() }
function resetFilters() { Object.assign(filters, initialFilters()); applyFilters() }
function openImportDialog() { importDialogVisible.value = true }
function onRatioImported() { filters.isActive = 1; applyFilters() }
async function fetchChanges() {
  changeLoading.value = true
  try {
    const result = normalizeSupplierSupplyRatioPage(await fetchSupplierSupplyRatioChanges({ ...changeFilters, page: changePage.value, pageSize: changePageSize.value }))
    changeRows.value = result.list.map(normalizeSupplierRatioChange); changeTotal.value = result.total
  } catch (error) { ElMessage.error(error.message || '供货关系变更记录查询失败') }
  finally { changeLoading.value = false }
}
function queryChanges() { changePage.value = 1; fetchChanges() }
function openChanges(row, batchNo) {
  Object.assign(changeFilters, { materialCode: row?.materialCode || '', supplierCode: row?.supplierCode || '', batchNo: batchNo || '' })
  changeDialogVisible.value = true; queryChanges()
}
watch([currentPage, pageSize], fetchRows)
watch([changePage, changePageSize], fetchChanges)
const route=useRoute()
onMounted(()=>{fetchRows();if(route.query.changes==='1')openChanges()})
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

.ratio-policy {
  margin-bottom: 14px;
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
