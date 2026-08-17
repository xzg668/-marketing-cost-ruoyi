<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">制造费用率配置表</div>
        <div class="filter-actions">
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls,.csv"
            :on-change="handleFileChange"
          >
            <el-button :loading="importing">导入</el-button>
          </el-upload>
          <el-button type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="事业部">
          <el-input v-model="filters.businessUnit" placeholder="事业部" />
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
        <el-table-column prop="businessDivision" label="事业部" min-width="160" />
        <el-table-column prop="productCategory" label="产品大类" min-width="130" />
        <el-table-column prop="productCode" label="料号" min-width="150" />
        <el-table-column prop="productName" label="产品名称" min-width="160" />
        <el-table-column prop="productModel" label="产品型号" min-width="160" />
        <el-table-column prop="productSpec" label="产品规格" min-width="160" />
        <el-table-column label="制造费用率" width="130">
          <template #default="{ row }">{{ formatRate(row.feeRate) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px">
      <el-form :model="formModel" label-width="110px">
        <el-form-item label="事业部">
          <el-input v-model="formModel.businessDivision" />
        </el-form-item>
        <el-form-item label="料号">
          <el-input v-model="formModel.productCode" />
        </el-form-item>
        <el-form-item label="产品大类">
          <el-input v-model="formModel.productCategory" placeholder="例如 J系列" />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="formModel.productName" />
        </el-form-item>
        <el-form-item label="产品型号">
          <el-input v-model="formModel.productModel" />
        </el-form-item>
        <el-form-item label="产品规格">
          <el-input v-model="formModel.productSpec" />
        </el-form-item>
        <el-form-item label="制造费用率">
          <el-input v-model="formModel.feeRate" placeholder="例如 5% 或 0.05" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formModel.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchManufactureRates,
  importManufactureRates,
  createManufactureRate,
  updateManufactureRate,
  deleteManufactureRate,
} from '../api/manufactureRates'
import {
  normalizeManufactureRateModel,
  normalizeManufactureRatePlaceholder,
  parseManufactureRate,
  parseManufactureRateRows,
  selectManufactureRateSheetName,
} from './manufactureRateImportUtils.js'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const currentYear = new Date().getFullYear()

const filters = ref({
  businessUnit: '',
})

const emptyForm = () => ({
  businessDivision: '',
  productCategory: '',
  productCode: '',
  productName: '',
  productModel: '',
  productSpec: '',
  feeRate: '',
  remark: '',
})

const formModel = ref(emptyForm())
const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑制造费用率' : '新增制造费用率',
)

const buildParams = () => ({
  businessUnit: filters.value.businessUnit.trim(),
})

const normalizeRow = (row) => ({
  ...row,
  businessDivision: row.businessDivision || row.businessUnit || '',
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchManufactureRates(buildParams())
    tableRows.value = (data?.list || []).map(normalizeRow)
  } catch (error) {
    tableRows.value = []
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  fetchList()
}

const resetFilters = () => {
  filters.value = {
    businessUnit: '',
  }
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
    businessDivision: row.businessDivision || row.businessUnit || '',
    productCategory: row.productCategory ?? '',
    productCode: row.productCode ?? '',
    productName: row.productName ?? '',
    productModel: row.productModel ?? '',
    productSpec: row.productSpec ?? '',
    feeRate: formatRate(row.feeRate),
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

const formatRate = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : `${(parsed * 100).toFixed(2)}%`
}

const submitRow = async () => {
  const feeRate = parseManufactureRate(formModel.value.feeRate)
  const businessDivision = formModel.value.businessDivision.trim()
  const productCategory = formModel.value.productCategory.trim()
  const productCode = normalizeManufactureRatePlaceholder(formModel.value.productCode)
  const productName = formModel.value.productName.trim()
  const normalizedModel = normalizeManufactureRateModel(formModel.value.productModel)
  const productModel = normalizedModel.value
  if (feeRate === null) {
    ElMessage.warning('制造费用率必填')
    return
  }
  if (!productCode && !productModel && !(businessDivision && productName) && !businessDivision) {
    ElMessage.warning('料号、产品型号、产品大类+事业部、产品名称+事业部、事业部至少满足一个匹配条件')
    return
  }
  const payload = {
    rateYear: currentYear,
    period: `${currentYear}-01`,
    businessDivision,
    businessUnit: businessDivision,
    productCategory,
    productCode,
    productName,
    productModel,
    productSpec: formModel.value.productSpec,
    feeRate,
    remark: [formModel.value.remark.trim(), normalizedModel.note].filter(Boolean).join('；'),
  }
  try {
    if (editingId.value) {
      await updateManufactureRate(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createManufactureRate(payload)
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
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (error) {
    return
  }
  try {
    await deleteManufactureRate(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  importing.value = true
  try {
    let XLSX = null
    try {
      const mod = await import('xlsx')
      XLSX = mod
    } catch (error) {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = selectManufactureRateSheetName(workbook.SheetNames)
    if (!sheetName) {
      ElMessage.error('未找到“制造费用”工作表，请确认Sheet名称')
      return
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const parsed = parseManufactureRateRows(rows, { rateYear: currentYear })
    if (parsed.error) {
      ElMessage.error(parsed.error)
      return
    }
    const result = await importManufactureRates({
      rateYear: currentYear,
      rows: parsed.rows,
    })
    const imported = (result?.inserted || 0) + (result?.updated || 0)
    if (result?.errors) {
      ElMessage.warning(`已导入${imported}条，失败${result.errors}条：${result.errorMessages?.[0] || ''}`)
    } else {
      ElMessage.success(`已导入${imported}条制造费用率`)
    }
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.base-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-actions {
  display: flex;
  gap: 8px;
}
</style>
