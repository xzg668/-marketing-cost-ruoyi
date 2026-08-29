<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div>
          <div class="filter-title">质量损失率（裸品料号）</div>
          <div class="filter-tip">支持原始多表文件或独立的“报价系统展示”单表，导入会覆盖同年度同裸品料号的手工修正。</div>
        </div>
        <div class="filter-actions">
          <el-upload
            ref="uploadRef"
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
          >
            <el-button :loading="importing">导入 Excel</el-button>
          </el-upload>
          <el-button type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="82px">
        <el-form-item label="年度">
          <el-date-picker v-model="filters.rateYear" type="year" format="YYYY" value-format="YYYY" />
        </el-form-item>
        <el-form-item label="裸品料号">
          <el-input v-model="filters.bareProductCode" placeholder="裸品料号" clearable />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.businessDivision" placeholder="事业部" clearable />
        </el-form-item>
        <el-form-item label="大类">
          <el-input v-model="filters.productCategory" placeholder="大类" clearable />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="filters.productModel" placeholder="型号" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column type="index" label="序号" width="70" />
        <el-table-column prop="bareProductCode" label="裸品料号" min-width="145" fixed="left" />
        <el-table-column prop="productName" label="品名" min-width="150" show-overflow-tooltip />
        <el-table-column prop="materialSpec" label="物料规格" min-width="180" show-overflow-tooltip />
        <el-table-column prop="productModel" label="型号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="businessDivision" label="事业部" min-width="130" />
        <el-table-column prop="productCategory" label="大类" min-width="130" show-overflow-tooltip />
        <el-table-column prop="productSubcategory" label="小类" min-width="130" show-overflow-tooltip />
        <el-table-column prop="categorySpec" label="分类规格" min-width="160" show-overflow-tooltip />
        <el-table-column prop="fourthLevel" label="四级" min-width="120" show-overflow-tooltip />
        <el-table-column label="净损失率" width="120" fixed="right">
          <template #default="{ row }">{{ formatRate(row.lossRate) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="removeRow(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无数据" /></template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px">
      <el-form :model="formModel" label-width="100px">
        <div class="form-grid">
          <el-form-item label="年度" required>
            <el-date-picker v-model="formModel.rateYear" type="year" format="YYYY" value-format="YYYY" />
          </el-form-item>
          <el-form-item label="裸品料号" required><el-input v-model="formModel.bareProductCode" /></el-form-item>
          <el-form-item label="品名"><el-input v-model="formModel.productName" /></el-form-item>
          <el-form-item label="物料规格"><el-input v-model="formModel.materialSpec" /></el-form-item>
          <el-form-item label="型号"><el-input v-model="formModel.productModel" /></el-form-item>
          <el-form-item label="事业部"><el-input v-model="formModel.businessDivision" /></el-form-item>
          <el-form-item label="大类"><el-input v-model="formModel.productCategory" /></el-form-item>
          <el-form-item label="小类"><el-input v-model="formModel.productSubcategory" /></el-form-item>
          <el-form-item label="分类规格"><el-input v-model="formModel.categorySpec" /></el-form-item>
          <el-form-item label="四级"><el-input v-model="formModel.fourthLevel" /></el-form-item>
          <el-form-item label="净损失率" required><el-input v-model="formModel.lossRate" placeholder="例如 0.475% 或 0.00475" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="formModel.remark" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchQualityLossRates,
  importQualityLossRates,
  createQualityLossRate,
  updateQualityLossRate,
  deleteQualityLossRate,
} from '../api/qualityLossRates'
import {
  parseQualityLossRate,
  parseQualityLossRateWorkbook,
} from '../utils/qualityLossRateImportUtils'

const loading = ref(false)
const importing = ref(false)
const uploadRef = ref(null)
const dialogVisible = ref(false)
const editingId = ref(null)
const currentYear = String(new Date().getFullYear())

const newFilters = () => ({
  rateYear: currentYear,
  bareProductCode: '',
  businessDivision: '',
  productCategory: '',
  productModel: '',
})
const filters = ref(newFilters())
const emptyForm = () => ({
  rateYear: filters.value.rateYear || currentYear,
  bareProductCode: '',
  productName: '',
  materialSpec: '',
  productModel: '',
  businessDivision: '',
  productCategory: '',
  productSubcategory: '',
  categorySpec: '',
  fourthLevel: '',
  lossRate: '',
  remark: '',
})

const formModel = ref(emptyForm())
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const dialogTitle = computed(() => (editingId.value ? '编辑质量损失率' : '新增质量损失率'))

const toYearNumber = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const buildParams = () => ({
  rateYear: toYearNumber(filters.value.rateYear),
  bareProductCode: filters.value.bareProductCode.trim(),
  businessDivision: filters.value.businessDivision.trim(),
  productCategory: filters.value.productCategory.trim(),
  productModel: filters.value.productModel.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchQualityLossRates(buildParams())
    tableRows.value = data?.list || []
    total.value = data?.total || 0
  } catch (error) {
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
}
const resetFilters = () => {
  filters.value = newFilters()
  applyFilters()
}
const openCreate = () => {
  editingId.value = null
  formModel.value = emptyForm()
  dialogVisible.value = true
}
const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    rateYear: row.rateYear ? String(row.rateYear) : currentYear,
    bareProductCode: row.bareProductCode ?? '',
    productName: row.productName ?? '',
    materialSpec: row.materialSpec ?? '',
    productModel: row.productModel ?? '',
    businessDivision: row.businessDivision ?? '',
    productCategory: row.productCategory ?? '',
    productSubcategory: row.productSubcategory ?? '',
    categorySpec: row.categorySpec ?? '',
    fourthLevel: row.fourthLevel ?? '',
    lossRate: row.lossRate ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

watch(pageSize, () => {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
})
watch(currentPage, fetchList)

const formatRate = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ''
  return `${(parsed * 100).toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 6 })}%`
}

const submitRow = async () => {
  const rateYear = toYearNumber(formModel.value.rateYear)
  const lossRate = parseQualityLossRate(formModel.value.lossRate)
  if (!rateYear || !formModel.value.bareProductCode.trim()) {
    ElMessage.warning('年度、裸品料号必填')
    return
  }
  if (!Number.isFinite(lossRate) || lossRate < 0 || lossRate >= 1) {
    ElMessage.warning('净损失率必须大于等于0且小于100%')
    return
  }
  const payload = { ...formModel.value, rateYear, lossRate }
  try {
    if (editingId.value) {
      await updateQualityLossRate(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createQualityLossRate(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除裸品料号 ${row.bareProductCode} 吗？`, '提示', { type: 'warning' })
    await deleteQualityLossRate(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败')
  }
}

const handleFileChange = async (uploadFile) => {
  const rateYear = toYearNumber(filters.value.rateYear)
  if (!rateYear) {
    ElMessage.warning('请先选择导入年度')
    return
  }
  if (!uploadFile.raw) return
  importing.value = true
  try {
    const XLSX = await import('xlsx')
    const buffer = await uploadFile.raw.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const parsed = parseQualityLossRateWorkbook(workbook, XLSX)
    if (parsed.rows.length === 0) {
      ElMessage.warning(`没有有效损失率数据，已跳过${parsed.skippedRows}条`)
      return
    }
    const result = await importQualityLossRates({ rateYear, rows: parsed.rows })
    const imported = (result?.inserted || 0) + (result?.updated || 0)
    const skipped = parsed.skippedRows + (result?.skipped || 0)
    if (result?.errors > 0) {
      ElMessage.warning(`导入${imported}条，跳过${skipped}条，错误${result.errors}条：${result.errorMessages?.[0] || ''}`)
    } else {
      ElMessage.success(`已从“${parsed.sheetName}”导入${imported}条，跳过${skipped}条无有效损失率数据`)
    }
    if (currentPage.value === 1) fetchList()
    else currentPage.value = 1
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
    uploadRef.value?.clearFiles()
  }
}

onMounted(fetchList)
</script>

<style scoped>
.base-page { display: flex; flex-direction: column; gap: 16px; }
.filter-card { padding-bottom: 6px; }
.filter-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 20px; }
.filter-title { font-size: 15px; font-weight: 600; color: #1f2a37; }
.filter-tip { margin-top: 6px; color: #6b7280; font-size: 12px; }
.filter-actions { display: flex; gap: 8px; flex-shrink: 0; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
</style>
