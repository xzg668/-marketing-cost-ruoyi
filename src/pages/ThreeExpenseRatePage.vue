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
        <el-form-item label="部门">
          <el-input v-model="filters.department" placeholder="亚洲业务部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="company" label="公司" min-width="160" />
        <el-table-column prop="businessUnit" label="生产事业部" min-width="140" />
        <el-table-column prop="department" label="部门" min-width="140" />
        <el-table-column prop="managementExpenseRate" label="管理费用" width="120" />
        <el-table-column prop="financeExpenseRate" label="财务费用" width="120" />
        <el-table-column prop="salesExpenseRate" label="营业费用" width="120" />
        <el-table-column prop="threeExpenseRate2025" label="2025三项费用" width="140" />
        <el-table-column prop="threeExpenseRate2026" label="2026三项费用" width="140" />
        <el-table-column prop="overseasSales" label="是否通过海外销" width="140" />
        <el-table-column prop="period" label="期间" width="100" />
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
        <el-form-item label="公司">
          <el-input v-model="formModel.company" />
        </el-form-item>
        <el-form-item label="生产事业部">
          <el-input v-model="formModel.businessUnit" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="formModel.department" />
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
        <el-form-item label="2025三项费用">
          <el-input v-model="formModel.threeExpenseRate2025" />
        </el-form-item>
        <el-form-item label="2026三项费用">
          <el-input v-model="formModel.threeExpenseRate2026" />
        </el-form-item>
        <el-form-item label="是否通过海外销">
          <el-input v-model="formModel.overseasSales" />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="formModel.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
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

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  department: '',
})

const formModel = ref({
  company: '',
  businessUnit: '',
  department: '',
  managementExpenseRate: '',
  financeExpenseRate: '',
  salesExpenseRate: '',
  threeExpenseRate2025: '',
  threeExpenseRate2026: '',
  overseasSales: '',
  period: '',
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑三项费用' : '新增三项费用',
)

const buildParams = () => ({
  department: filters.value.department.trim(),
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
    department: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    company: '',
    businessUnit: '',
    department: '',
    managementExpenseRate: '',
    financeExpenseRate: '',
    salesExpenseRate: '',
    threeExpenseRate2025: '',
    threeExpenseRate2026: '',
    overseasSales: '',
    period: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    company: row.company ?? '',
    businessUnit: row.businessUnit ?? '',
    department: row.department ?? '',
    managementExpenseRate: row.managementExpenseRate ?? '',
    financeExpenseRate: row.financeExpenseRate ?? '',
    salesExpenseRate: row.salesExpenseRate ?? '',
    threeExpenseRate2025: row.threeExpenseRate2025 ?? '',
    threeExpenseRate2026: row.threeExpenseRate2026 ?? '',
    overseasSales: row.overseasSales ?? '',
    period: row.period ?? '',
  }
  dialogVisible.value = true
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const submitRow = async () => {
  if (
    !formModel.value.company ||
    !formModel.value.businessUnit ||
    !formModel.value.department ||
    !String(formModel.value.managementExpenseRate).trim() ||
    !String(formModel.value.financeExpenseRate).trim() ||
    !String(formModel.value.salesExpenseRate).trim() ||
    !String(formModel.value.threeExpenseRate2025).trim() ||
    !String(formModel.value.threeExpenseRate2026).trim() ||
    !formModel.value.period
  ) {
    ElMessage.warning('公司、事业部、部门、费用、期间必填')
    return
  }
  const payload = {
    company: formModel.value.company,
    businessUnit: formModel.value.businessUnit,
    department: formModel.value.department,
    managementExpenseRate: parseNumber(formModel.value.managementExpenseRate),
    financeExpenseRate: parseNumber(formModel.value.financeExpenseRate),
    salesExpenseRate: parseNumber(formModel.value.salesExpenseRate),
    threeExpenseRate2025: parseNumber(formModel.value.threeExpenseRate2025),
    threeExpenseRate2026: parseNumber(formModel.value.threeExpenseRate2026),
    overseasSales: formModel.value.overseasSales,
    period: formModel.value.period,
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

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

const formatPeriod = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  return String(value).trim()
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
    const headerAliases = {
      company: ['公司'],
      businessUnit: ['生产事业部', '事业部'],
      department: ['部门'],
      managementExpenseRate: ['管理费用'],
      financeExpenseRate: ['财务费用'],
      salesExpenseRate: ['营业费用'],
      threeExpenseRate2025: ['2025三项费用', '2025 三项费用'],
      threeExpenseRate2026: ['2026三项费用', '2026 三项费用'],
      overseasSales: ['是否通过海外销'],
      period: ['期间'],
    }
    const headerMap = Object.entries(headerAliases).reduce((acc, [key, values]) => {
      values.forEach((value) => {
        acc[normalizeHeader(value)] = key
      })
      return acc
    }, {})
    const headerKeys = Object.keys(headerMap).sort((a, b) => b.length - a.length)
    const resolveHeaderField = (cell) => {
      const normalized = normalizeHeader(cell)
      if (!normalized) {
        return null
      }
      if (headerMap[normalized]) {
        return headerMap[normalized]
      }
      const matched = headerKeys.find((key) => normalized.includes(key))
      return matched ? headerMap[matched] : null
    }
    const headerIndex = rows.reduce(
      (best, row, index) => {
        const hitCount = row.reduce((count, cell) => {
          return resolveHeaderField(cell) ? count + 1 : count
        }, 0)
        if (hitCount > best.count) {
          return { index, count: hitCount }
        }
        return best
      },
      { index: -1, count: 0 },
    ).index
    if (headerIndex === -1) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const nextHeaderRow = rows[headerIndex + 1] || []
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field) {
        fieldIndex[field] = index
      }
    })
    nextHeaderRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field && fieldIndex[field] === undefined) {
        fieldIndex[field] = index
      }
    })
    const requiredFields = [
      'company',
      'businessUnit',
      'department',
      'managementExpenseRate',
      'financeExpenseRate',
      'salesExpenseRate',
      'threeExpenseRate2025',
      'threeExpenseRate2026',
      'period',
    ]
    const requiredLabels = {
      company: '公司',
      businessUnit: '生产事业部',
      department: '部门',
      managementExpenseRate: '管理费用',
      financeExpenseRate: '财务费用',
      salesExpenseRate: '营业费用',
      threeExpenseRate2025: '2025三项费用',
      threeExpenseRate2026: '2026三项费用',
      period: '期间',
    }
    const missing = requiredFields.filter((field) => fieldIndex[field] === undefined)
    if (missing.length > 0) {
      const names = missing.map((field) => requiredLabels[field] || field)
      ElMessage.error(`缺少表头：${names.join('、')}`)
      return
    }
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => ({
        company: String(row[fieldIndex.company] || '').trim(),
        businessUnit: String(row[fieldIndex.businessUnit] || '').trim(),
        department: String(row[fieldIndex.department] || '').trim(),
        managementExpenseRate: parseNumber(row[fieldIndex.managementExpenseRate]),
        financeExpenseRate: parseNumber(row[fieldIndex.financeExpenseRate]),
        salesExpenseRate: parseNumber(row[fieldIndex.salesExpenseRate]),
        threeExpenseRate2025: parseNumber(row[fieldIndex.threeExpenseRate2025]),
        threeExpenseRate2026: parseNumber(row[fieldIndex.threeExpenseRate2026]),
        overseasSales: String(row[fieldIndex.overseasSales] || '').trim(),
        period: formatPeriod(row[fieldIndex.period]),
      }))
      .filter(
        (row) =>
          row.company &&
          row.businessUnit &&
          row.department &&
          row.managementExpenseRate !== null &&
          row.financeExpenseRate !== null &&
          row.salesExpenseRate !== null &&
          row.threeExpenseRate2025 !== null &&
          row.threeExpenseRate2026 !== null &&
          row.period,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importThreeExpenseRates({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条三项费用`)
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
