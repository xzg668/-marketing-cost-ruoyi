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
        <el-form-item label="事业部">
          <el-input v-model="filters.businessUnit" placeholder="四通阀事业部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="businessUnit" label="事业部" min-width="140" />
        <el-table-column prop="overhaulRate" label="大修费" width="120" />
        <el-table-column prop="toolingRepairRate" label="工装零星修理费" width="140" />
        <el-table-column prop="waterPowerRate" label="水电费" width="120" />
        <el-table-column prop="otherRate" label="其他费用" width="120" />
        <el-table-column prop="upliftRate" label="上浮比率" width="120" />
        <el-table-column prop="manhourRate" label="工时率" width="120" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px">
      <el-form :model="formModel" label-width="120px">
        <el-form-item label="事业部">
          <el-input v-model="formModel.businessUnit" />
        </el-form-item>
        <el-form-item label="大修费">
          <el-input v-model="formModel.overhaulRate" />
        </el-form-item>
        <el-form-item label="工装零星修理费">
          <el-input v-model="formModel.toolingRepairRate" />
        </el-form-item>
        <el-form-item label="水电费">
          <el-input v-model="formModel.waterPowerRate" />
        </el-form-item>
        <el-form-item label="其他费用">
          <el-input v-model="formModel.otherRate" />
        </el-form-item>
        <el-form-item label="上浮比率">
          <el-input v-model="formModel.upliftRate" />
        </el-form-item>
        <el-form-item label="工时率">
          <el-input v-model="formModel.manhourRate" />
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

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  businessUnit: '',
})

const formModel = ref({
  businessUnit: '',
  overhaulRate: '',
  toolingRepairRate: '',
  waterPowerRate: '',
  otherRate: '',
  upliftRate: '',
  manhourRate: '',
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑部门经费率' : '新增部门经费率',
)

const buildParams = () => ({
  businessUnit: filters.value.businessUnit.trim(),
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
    businessUnit: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    businessUnit: '',
    overhaulRate: '',
    toolingRepairRate: '',
    waterPowerRate: '',
    otherRate: '',
    upliftRate: '',
    manhourRate: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    businessUnit: row.businessUnit ?? '',
    overhaulRate: row.overhaulRate ?? '',
    toolingRepairRate: row.toolingRepairRate ?? '',
    waterPowerRate: row.waterPowerRate ?? '',
    otherRate: row.otherRate ?? '',
    upliftRate: row.upliftRate ?? '',
    manhourRate: row.manhourRate ?? '',
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
    !formModel.value.businessUnit ||
    !String(formModel.value.overhaulRate).trim() ||
    !String(formModel.value.toolingRepairRate).trim() ||
    !String(formModel.value.waterPowerRate).trim() ||
    !String(formModel.value.otherRate).trim() ||
    !String(formModel.value.upliftRate).trim() ||
    !String(formModel.value.manhourRate).trim()
  ) {
    ElMessage.warning('事业部和各项费率必填')
    return
  }
  const payload = {
    businessUnit: formModel.value.businessUnit,
    overhaulRate: parseNumber(formModel.value.overhaulRate),
    toolingRepairRate: parseNumber(formModel.value.toolingRepairRate),
    waterPowerRate: parseNumber(formModel.value.waterPowerRate),
    otherRate: parseNumber(formModel.value.otherRate),
    upliftRate: parseNumber(formModel.value.upliftRate),
    manhourRate: parseNumber(formModel.value.manhourRate),
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
    .replace(/[\s\u3000]+/g, '')
    .trim()

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
      businessUnit: ['事业部'],
      overhaulRate: ['大修费'],
      toolingRepairRate: ['工装零星修理费'],
      waterPowerRate: ['水电费'],
      otherRate: ['其他费用'],
      upliftRate: ['上浮比率'],
      manhourRate: ['工时率'],
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
      'businessUnit',
      'overhaulRate',
      'toolingRepairRate',
      'waterPowerRate',
      'otherRate',
      'upliftRate',
      'manhourRate',
    ]
    const requiredLabels = {
      businessUnit: '事业部',
      overhaulRate: '大修费',
      toolingRepairRate: '工装零星修理费',
      waterPowerRate: '水电费',
      otherRate: '其他费用',
      upliftRate: '上浮比率',
      manhourRate: '工时率',
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
        businessUnit: String(row[fieldIndex.businessUnit] || '').trim(),
        overhaulRate: parseNumber(row[fieldIndex.overhaulRate]),
        toolingRepairRate: parseNumber(row[fieldIndex.toolingRepairRate]),
        waterPowerRate: parseNumber(row[fieldIndex.waterPowerRate]),
        otherRate: parseNumber(row[fieldIndex.otherRate]),
        upliftRate: parseNumber(row[fieldIndex.upliftRate]),
        manhourRate: parseNumber(row[fieldIndex.manhourRate]),
      }))
      .filter(
        (row) =>
          row.businessUnit &&
          row.overhaulRate !== null &&
          row.toolingRepairRate !== null &&
          row.waterPowerRate !== null &&
          row.otherRate !== null &&
          row.upliftRate !== null &&
          row.manhourRate !== null,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importDepartmentFundRates({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条经费率`)
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
