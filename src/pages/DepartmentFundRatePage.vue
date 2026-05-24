<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">部门经费率对照表</div>
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
          <el-input v-model="filters.rateYear" placeholder="2026" class="year-input" />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.businessUnit" placeholder="商用四通阀事业部" />
        </el-form-item>
        <el-form-item label="费用科目">
          <el-input v-model="filters.expenseSubject" placeholder="水电费用" />
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
        <el-table-column prop="businessDivision" label="事业部" min-width="150">
          <template #default="{ row }">{{ row.businessDivision || row.businessUnit }}</template>
        </el-table-column>
        <el-table-column prop="expenseSubject" label="费用科目" min-width="140" />
        <el-table-column prop="budgetAmount" label="预算费用" width="130" />
        <el-table-column prop="totalWorkMinutes" label="总工时" width="130" />
        <el-table-column prop="planRate" label="计划（元/分钟）" width="150" />
        <el-table-column prop="upliftRatio" label="上浮比例" width="120" />
        <el-table-column prop="quoteRatio" label="报价比例（元/分钟）" width="170" />
        <el-table-column prop="manhourRate" label="工时率" width="120" />
        <el-table-column prop="rateYear" label="年度" width="90" />
        <el-table-column prop="remark" label="备注" min-width="150" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="removeRow(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="150px">
        <el-form-item label="年度">
          <el-input v-model="formModel.rateYear" />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="formModel.businessDivision" />
        </el-form-item>
        <el-form-item label="费用科目">
          <el-input v-model="formModel.expenseSubject" />
        </el-form-item>
        <el-form-item label="预算费用">
          <el-input v-model="formModel.budgetAmount" />
        </el-form-item>
        <el-form-item label="总工时">
          <el-input v-model="formModel.totalWorkMinutes" />
        </el-form-item>
        <el-form-item label="计划（元/分钟）">
          <el-input v-model="formModel.planRate" />
        </el-form-item>
        <el-form-item label="上浮比例">
          <el-input v-model="formModel.upliftRatio" />
        </el-form-item>
        <el-form-item label="报价比例（元/分钟）">
          <el-input v-model="formModel.quoteRatio" />
        </el-form-item>
        <el-form-item label="工时率">
          <el-input v-model="formModel.manhourRate" />
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
  fetchDepartmentFundRates,
  importDepartmentFundRates,
  createDepartmentFundRate,
  updateDepartmentFundRate,
  deleteDepartmentFundRate,
} from '../api/departmentFundRates'

const currentYear = new Date().getFullYear()
const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  rateYear: String(currentYear),
  businessUnit: '',
  expenseSubject: '',
})

const blankForm = () => ({
  rateYear: String(currentYear),
  businessDivision: '',
  expenseSubject: '',
  budgetAmount: '',
  totalWorkMinutes: '',
  planRate: '',
  upliftRatio: '',
  quoteRatio: '',
  manhourRate: '',
  remark: '',
})

const formModel = ref(blankForm())
const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑部门经费率' : '新增部门经费率',
)

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseYear = (value) => {
  const parsed = parseNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

const buildParams = () => ({
  rateYear: parseYear(filters.value.rateYear),
  businessUnit: filters.value.businessUnit.trim(),
  expenseSubject: filters.value.expenseSubject.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchDepartmentFundRates(buildParams())
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
    rateYear: String(currentYear),
    businessUnit: '',
    expenseSubject: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = blankForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    rateYear: row.rateYear ?? '',
    businessDivision: row.businessDivision ?? row.businessUnit ?? '',
    expenseSubject: row.expenseSubject ?? '',
    budgetAmount: row.budgetAmount ?? '',
    totalWorkMinutes: row.totalWorkMinutes ?? '',
    planRate: row.planRate ?? '',
    upliftRatio: row.upliftRatio ?? '',
    quoteRatio: row.quoteRatio ?? '',
    manhourRate: row.manhourRate ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

const submitRow = async () => {
  if (
    !String(formModel.value.rateYear).trim() ||
    !String(formModel.value.businessDivision).trim() ||
    !String(formModel.value.expenseSubject).trim() ||
    !String(formModel.value.quoteRatio).trim()
  ) {
    ElMessage.warning('年度、事业部、费用科目、报价比例必填')
    return
  }
  const payload = {
    rateYear: parseYear(formModel.value.rateYear),
    businessDivision: String(formModel.value.businessDivision).trim(),
    businessUnit: String(formModel.value.businessDivision).trim(),
    expenseSubject: String(formModel.value.expenseSubject).trim(),
    budgetAmount: parseNumber(formModel.value.budgetAmount),
    totalWorkMinutes: parseNumber(formModel.value.totalWorkMinutes),
    planRate: parseNumber(formModel.value.planRate),
    upliftRatio: parseNumber(formModel.value.upliftRatio),
    quoteRatio: parseNumber(formModel.value.quoteRatio),
    manhourRate: parseNumber(formModel.value.manhourRate),
    remark: String(formModel.value.remark || '').trim(),
  }
  try {
    if (editingId.value) {
      await updateDepartmentFundRate(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createDepartmentFundRate(payload)
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
    await deleteDepartmentFundRate(row.id)
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
    .replace(/[()（）]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

const normalizeCell = (value) => String(value ?? '').trim()

const fillMergedCells = (sheet, XLSX) => {
  const merges = sheet['!merges'] || []
  merges.forEach((merge) => {
    const firstAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })
    const firstValue = sheet[firstAddress]?.v ?? sheet[firstAddress]?.w ?? ''
    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      for (let col = merge.s.c; col <= merge.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        if (!sheet[address]) {
          sheet[address] = { t: 's', v: firstValue }
        }
      }
    }
  })
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
    fillMergedCells(sheet, XLSX)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const headerAliases = {
      businessDivision: ['事业部'],
      expenseSubject: ['费用科目'],
      budgetAmount: ['预算费用'],
      totalWorkMinutes: ['总工时'],
      planRate: ['计划元/分钟', '计划'],
      upliftRatio: ['上浮比例'],
      quoteRatio: ['报价比例元/分钟', '报价比例'],
      manhourRate: ['工时率'],
      remark: ['备注'],
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
        return hitCount > best.count ? { index, count: hitCount } : best
      },
      { index: -1, count: 0 },
    ).index
    if (headerIndex === -1) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const fieldIndex = {}
    rows[headerIndex].forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field) {
        fieldIndex[field] = index
      }
    })
    const requiredFields = ['businessDivision', 'expenseSubject', 'quoteRatio']
    const requiredLabels = {
      businessDivision: '事业部',
      expenseSubject: '费用科目',
      quoteRatio: '报价比例（元/分钟）',
    }
    const missing = requiredFields.filter((field) => fieldIndex[field] === undefined)
    if (missing.length > 0) {
      const names = missing.map((field) => requiredLabels[field] || field)
      ElMessage.error(`缺少表头：${names.join('、')}`)
      return
    }
    let lastBusinessDivision = ''
    let lastTotalWorkMinutes = null
    let lastManhourRate = null
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row, index) => {
        const businessDivision = normalizeCell(row[fieldIndex.businessDivision]) || lastBusinessDivision
        const totalWorkMinutes =
          fieldIndex.totalWorkMinutes === undefined
            ? lastTotalWorkMinutes
            : parseNumber(row[fieldIndex.totalWorkMinutes]) ?? lastTotalWorkMinutes
        const manhourRate =
          fieldIndex.manhourRate === undefined
            ? lastManhourRate
            : parseNumber(row[fieldIndex.manhourRate]) ?? lastManhourRate
        if (businessDivision) {
          lastBusinessDivision = businessDivision
        }
        if (totalWorkMinutes !== null) {
          lastTotalWorkMinutes = totalWorkMinutes
        }
        if (manhourRate !== null) {
          lastManhourRate = manhourRate
        }
        return {
          rowNo: headerIndex + index + 2,
          businessDivision,
          businessUnit: businessDivision,
          expenseSubject: normalizeCell(row[fieldIndex.expenseSubject]),
          budgetAmount:
            fieldIndex.budgetAmount === undefined ? null : parseNumber(row[fieldIndex.budgetAmount]),
          totalWorkMinutes,
          planRate: fieldIndex.planRate === undefined ? null : parseNumber(row[fieldIndex.planRate]),
          upliftRatio:
            fieldIndex.upliftRatio === undefined ? null : parseNumber(row[fieldIndex.upliftRatio]),
          quoteRatio: parseNumber(row[fieldIndex.quoteRatio]),
          manhourRate,
          remark: fieldIndex.remark === undefined ? '' : normalizeCell(row[fieldIndex.remark]),
        }
      })
      .filter((row) => row.businessDivision && row.expenseSubject && row.quoteRatio !== null)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importDepartmentFundRates({
      rateYear: parseYear(filters.value.rateYear) || currentYear,
      rows: dataRows,
    })
    const imported = (result?.inserted || 0) + (result?.updated || 0)
    if (result?.errors > 0) {
      ElMessage.warning(`已导入${imported}条，失败${result.errors}条`)
    } else {
      ElMessage.success(`已导入${imported}条经费率`)
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

.year-input {
  width: 120px;
}
</style>
