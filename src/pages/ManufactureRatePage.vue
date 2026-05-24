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
    productCode: row.productCode ?? '',
    productName: row.productName ?? '',
    productModel: row.productModel ?? '',
    productSpec: row.productSpec ?? '',
    feeRate: formatRate(row.feeRate),
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

const parseRate = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  if (text.endsWith('%')) {
    const parsed = Number(text.slice(0, -1).trim())
    return Number.isNaN(parsed) ? null : parsed / 100
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const formatRate = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? value : `${(parsed * 100).toFixed(2)}%`
}

const submitRow = async () => {
  const feeRate = parseRate(formModel.value.feeRate)
  const businessDivision = formModel.value.businessDivision.trim()
  const productCode = formModel.value.productCode.trim()
  const productName = formModel.value.productName.trim()
  const productModel = formModel.value.productModel.trim()
  if (feeRate === null) {
    ElMessage.warning('制造费用率必填')
    return
  }
  if (!productCode && !productModel && !(businessDivision && productName) && !businessDivision) {
    ElMessage.warning('料号、产品型号、产品名称+事业部、事业部至少满足一个匹配条件')
    return
  }
  const payload = {
    rateYear: currentYear,
    period: `${currentYear}-01`,
    businessDivision,
    businessUnit: businessDivision,
    productCode,
    productName,
    productModel,
    productSpec: formModel.value.productSpec,
    feeRate,
    remark: formModel.value.remark,
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
      businessDivision: ['事业部', '生产事业部'],
      productCode: ['料号', '产品料号'],
      productName: ['产品名称', '品名'],
      productModel: ['产品型号', '型号'],
      productSpec: ['产品规格', '规格'],
      feeRate: ['制造费用率', '费用率'],
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
    const headerSearch = rows.reduce(
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
    )
    if (headerSearch.index === -1 || headerSearch.count < 3) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerSearch.index]
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = resolveHeaderField(cell)
      if (field) {
        fieldIndex[field] = index
      }
    })
    if (fieldIndex.feeRate === undefined) {
      ElMessage.error('缺少表头：制造费用率')
      return
    }
    const dataRows = rows
      .slice(headerSearch.index + 1)
      .map((row, index) => ({
        rowNo: headerSearch.index + index + 2,
        businessDivision: String(row[fieldIndex.businessDivision] || '').trim(),
        businessUnit: String(row[fieldIndex.businessDivision] || '').trim(),
        productCode: String(row[fieldIndex.productCode] || '').trim(),
        productName: String(row[fieldIndex.productName] || '').trim(),
        productModel: String(row[fieldIndex.productModel] || '').trim(),
        productSpec: String(row[fieldIndex.productSpec] || '').trim(),
        feeRate: parseRate(row[fieldIndex.feeRate]),
        remark: String(row[fieldIndex.remark] || '').trim(),
        rateYear: currentYear,
        period: `${currentYear}-01`,
      }))
      .filter(
        (row) =>
          row.feeRate !== null ||
          row.businessDivision ||
          row.productCode ||
          row.productName ||
          row.productModel ||
          row.productSpec ||
          row.remark,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importManufactureRates({
      rateYear: currentYear,
      rows: dataRows,
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
