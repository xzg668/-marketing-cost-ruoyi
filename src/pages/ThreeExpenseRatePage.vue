<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">三项费用费率对照表</div>
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
        <el-form-item label="年度">
          <el-input-number v-model="filters.periodYear" :controls="false" :min="2000" :max="2100" placeholder="2026" />
        </el-form-item>
        <el-form-item label="产品口径">
          <el-select v-model="filters.productCategory" clearable placeholder="全部" style="width: 180px">
            <el-option v-for="item in productCategoryOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="产线">
          <el-select v-model="filters.productLine" clearable placeholder="全部" style="width: 160px">
            <el-option v-for="item in productLineOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请部门">
          <el-input v-model="filters.applicantDepartment" placeholder="亚洲业务部" />
        </el-form-item>
        <el-form-item label="申请处室">
          <el-input v-model="filters.applicantOffice" placeholder="华南业务部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading" class="three-expense-table">
        <el-table-column prop="periodYear" label="年度" width="90" />
        <el-table-column prop="productCategory" label="产品口径" min-width="150" />
        <el-table-column prop="productLine" label="产线" min-width="130" />
        <el-table-column prop="applicantDepartment" label="申请部门" min-width="190" />
        <el-table-column label="申请处室" min-width="140">
          <template #default="{ row }">
            {{ displayApplicantOffice(row.applicantOffice) }}
          </template>
        </el-table-column>
        <el-table-column label="管理费用" width="120" align="right">
          <template #default="{ row }">
            {{ formatRate(row.managementExpenseRate) }}
          </template>
        </el-table-column>
        <el-table-column label="财务费用" width="120" align="right">
          <template #default="{ row }">
            {{ formatRate(row.financeExpenseRate) }}
          </template>
        </el-table-column>
        <el-table-column label="营业费用" width="120" align="right">
          <template #default="{ row }">
            {{ formatRate(row.salesExpenseRate) }}
          </template>
        </el-table-column>
        <el-table-column label="三项费用合计" width="140" align="right">
          <template #default="{ row }">
            {{ formatRate(row.threeExpenseTotalRate) }}
          </template>
        </el-table-column>
        <el-table-column label="OEM费用率" width="120" align="right">
          <template #default="{ row }">
            {{ formatRate(row.oemExpenseRate) }}
          </template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源" width="120" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
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
        <el-form-item label="年度">
          <el-input-number v-model="formModel.periodYear" :controls="false" :min="2000" :max="2100" />
        </el-form-item>
        <el-form-item label="产品口径">
          <el-select v-model="formModel.productCategory" placeholder="请选择">
            <el-option v-for="item in productCategoryOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="产线">
          <el-select v-model="formModel.productLine" placeholder="请选择">
            <el-option v-for="item in productLineOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请部门">
          <el-input v-model="formModel.applicantDepartment" />
        </el-form-item>
        <el-form-item label="申请处室">
          <el-input v-model="formModel.applicantOffice" placeholder="留空或 / 表示按申请部门匹配" />
        </el-form-item>
        <el-form-item label="管理费用">
          <el-input v-model="formModel.managementExpenseRate" />
        </el-form-item>
        <el-form-item label="财务费用">
          <el-input v-model="formModel.financeExpenseRate" />
        </el-form-item>
        <el-form-item label="营业费用">
          <el-input v-model="formModel.salesExpenseRate" />
        </el-form-item>
        <el-form-item label="三项费用合计">
          <el-input v-model="formModel.threeExpenseTotalRate" />
        </el-form-item>
        <el-form-item label="OEM费用率">
          <el-input v-model="formModel.oemExpenseRate" />
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
  fetchThreeExpenseRates,
  importThreeExpenseRates,
  createThreeExpenseRate,
  updateThreeExpenseRate,
  deleteThreeExpenseRate,
} from '../api/threeExpenseRates'
import { parseThreeExpenseRateRows } from './threeExpenseRateImportUtils'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const productCategoryOptions = ['商用直销产品', '家代商代销产品']
const productLineOptions = ['国内产线', '墨西哥产线', '越南事业部']

const filters = ref({
  periodYear: null,
  productCategory: '',
  productLine: '',
  applicantDepartment: '',
  applicantOffice: '',
})

const formModel = ref({
  periodYear: null,
  productCategory: '',
  productLine: '',
  applicantDepartment: '',
  applicantOffice: '',
  managementExpenseRate: '',
  financeExpenseRate: '',
  salesExpenseRate: '',
  threeExpenseTotalRate: '',
  oemExpenseRate: '',
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑三项费用' : '新增三项费用',
)

const displayApplicantOffice = (value) => {
  const text = String(value ?? '').trim()
  return text || '/'
}

const formatRate = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }
  return `${(parsed * 100).toFixed(1)}%`
}

const buildParams = () => ({
  periodYear: filters.value.periodYear || undefined,
  productCategory: filters.value.productCategory || undefined,
  productLine: filters.value.productLine || undefined,
  applicantDepartment: filters.value.applicantDepartment.trim(),
  applicantOffice: filters.value.applicantOffice.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchThreeExpenseRates(buildParams())
    tableRows.value = data?.list || []
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
    periodYear: null,
    productCategory: '',
    productLine: '',
    applicantDepartment: '',
    applicantOffice: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    periodYear: new Date().getFullYear(),
    productCategory: '',
    productLine: '',
    applicantDepartment: '',
    applicantOffice: '',
    managementExpenseRate: '',
    financeExpenseRate: '',
    salesExpenseRate: '',
    threeExpenseTotalRate: '',
    oemExpenseRate: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    periodYear: row.periodYear ?? null,
    productCategory: row.productCategory ?? '',
    productLine: row.productLine ?? '',
    applicantDepartment: row.applicantDepartment ?? '',
    applicantOffice: row.applicantOffice ?? '',
    managementExpenseRate: row.managementExpenseRate ?? '',
    financeExpenseRate: row.financeExpenseRate ?? '',
    salesExpenseRate: row.salesExpenseRate ?? '',
    threeExpenseTotalRate: row.threeExpenseTotalRate ?? '',
    oemExpenseRate: row.oemExpenseRate ?? '',
  }
  dialogVisible.value = true
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const hasPercent = text.includes('%')
  const parsed = Number(text.replace('%', ''))
  if (Number.isNaN(parsed)) {
    return null
  }
  if (hasPercent || Math.abs(parsed) > 1) {
    return Number((parsed / 100).toFixed(6))
  }
  return Number(parsed.toFixed(6))
}

const submitRow = async () => {
  if (
    !formModel.value.periodYear ||
    !formModel.value.productCategory ||
    !formModel.value.productLine ||
    !formModel.value.applicantDepartment ||
    !String(formModel.value.managementExpenseRate).trim() ||
    !String(formModel.value.financeExpenseRate).trim() ||
    !String(formModel.value.salesExpenseRate).trim() ||
    !String(formModel.value.threeExpenseTotalRate).trim()
  ) {
    ElMessage.warning('年度、产品口径、产线、申请部门和费率必填')
    return
  }
  const productCategory = formModel.value.productCategory
  const payload = {
    periodYear: formModel.value.periodYear,
    productCategory,
    productLine: formModel.value.productLine,
    applicantDepartment: formModel.value.applicantDepartment,
    applicantOffice: formModel.value.applicantOffice,
    managementExpenseRate: parseNumber(formModel.value.managementExpenseRate),
    financeExpenseRate: parseNumber(formModel.value.financeExpenseRate),
    salesExpenseRate: parseNumber(formModel.value.salesExpenseRate),
    threeExpenseTotalRate: parseNumber(formModel.value.threeExpenseTotalRate),
    oemExpenseRate: parseNumber(formModel.value.oemExpenseRate),
    sourceType: 'MANUAL',
    businessUnitType: productCategory === '家代商代销产品' ? 'HOUSEHOLD' : 'COMMERCIAL',
  }
  try {
    if (editingId.value) {
      await updateThreeExpenseRate(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createThreeExpenseRate(payload)
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
    await deleteThreeExpenseRate(row.id)
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
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const { rows: dataRows, errors } = parseThreeExpenseRateRows(rows, {
      defaultPeriodYear: filters.value.periodYear || new Date().getFullYear(),
    })
    if (errors.length > 0) {
      const preview = errors.slice(0, 5).map((item) => item.message).join('；')
      ElMessage.error(`导入校验失败：${preview}`)
      return
    }
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importThreeExpenseRates({ rows: dataRows })
    if (result?.errors?.length) {
      ElMessage.error(`导入失败：${result.errors.slice(0, 5).join('；')}`)
      return
    }
    const imported = result?.insertedCount ?? (Array.isArray(result) ? result.length : dataRows.length)
    const updated = result?.updatedCount ?? 0
    const duplicate = result?.duplicateOverrideCount ?? 0
    ElMessage.success(`导入完成：新增${imported}条，更新${updated}条，同批覆盖${duplicate}条`)
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
