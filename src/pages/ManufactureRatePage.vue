<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">制造费用率对照表</div>
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
        <el-table-column prop="company" label="公司" min-width="140" />
        <el-table-column prop="businessUnit" label="生产事业部" min-width="140" />
        <el-table-column prop="productCategory" label="产品大类" min-width="140" />
        <el-table-column prop="productSubcategory" label="产品小类" min-width="140" />
        <el-table-column prop="productSpec" label="产品规格" min-width="140" />
        <el-table-column prop="productModel" label="产品型号" min-width="140" />
        <el-table-column prop="feeRate" label="费用率" width="120" />
        <el-table-column prop="period" label="期间" width="120" />
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
      <el-form :model="formModel" label-width="100px">
        <el-form-item label="公司">
          <el-input v-model="formModel.company" />
        </el-form-item>
        <el-form-item label="生产事业部">
          <el-input v-model="formModel.businessUnit" />
        </el-form-item>
        <el-form-item label="产品大类">
          <el-input v-model="formModel.productCategory" />
        </el-form-item>
        <el-form-item label="产品小类">
          <el-input v-model="formModel.productSubcategory" />
        </el-form-item>
        <el-form-item label="产品规格">
          <el-input v-model="formModel.productSpec" />
        </el-form-item>
        <el-form-item label="产品型号">
          <el-input v-model="formModel.productModel" />
        </el-form-item>
        <el-form-item label="费用率">
          <el-input v-model="formModel.feeRate" />
        </el-form-item>
        <el-form-item label="期间">
          <el-input v-model="formModel.period" />
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

const filters = ref({
  businessUnit: '',
})

const formModel = ref({
  company: '',
  businessUnit: '',
  productCategory: '',
  productSubcategory: '',
  productSpec: '',
  productModel: '',
  feeRate: '',
  period: '',
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑制造费用率' : '新增制造费用率',
)

const buildParams = () => ({
  businessUnit: filters.value.businessUnit.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchManufactureRates(buildParams())
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
    company: '',
    businessUnit: '',
    productCategory: '',
    productSubcategory: '',
    productSpec: '',
    productModel: '',
    feeRate: '',
    period: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    company: row.company ?? '',
    businessUnit: row.businessUnit ?? '',
    productCategory: row.productCategory ?? '',
    productSubcategory: row.productSubcategory ?? '',
    productSpec: row.productSpec ?? '',
    productModel: row.productModel ?? '',
    feeRate: row.feeRate ?? '',
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

const submitRow = async () => {
  if (
    !formModel.value.company ||
    !formModel.value.businessUnit ||
    !formModel.value.productCategory ||
    !formModel.value.productSubcategory ||
    !String(formModel.value.feeRate).trim() ||
    !String(formModel.value.period).trim()
  ) {
    ElMessage.warning('公司、事业部、产品大类/小类、费用率、期间必填')
    return
  }
  const payload = {
    company: formModel.value.company,
    businessUnit: formModel.value.businessUnit,
    productCategory: formModel.value.productCategory,
    productSubcategory: formModel.value.productSubcategory,
    productSpec: formModel.value.productSpec,
    productModel: formModel.value.productModel,
    feeRate: parseNumber(formModel.value.feeRate),
    period: String(formModel.value.period).trim(),
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
      company: ['公司'],
      businessUnit: ['生产事业部', '事业部'],
      productCategory: ['产品大类'],
      productSubcategory: ['产品小类'],
      productSpec: ['产品规格'],
      productModel: ['产品型号'],
      feeRate: ['费用率'],
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
      'productCategory',
      'productSubcategory',
      'feeRate',
      'period',
    ]
    const requiredLabels = {
      company: '公司',
      businessUnit: '生产事业部',
      productCategory: '产品大类',
      productSubcategory: '产品小类',
      feeRate: '费用率',
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
        productCategory: String(row[fieldIndex.productCategory] || '').trim(),
        productSubcategory: String(row[fieldIndex.productSubcategory] || '').trim(),
        productSpec: String(row[fieldIndex.productSpec] || '').trim(),
        productModel: String(row[fieldIndex.productModel] || '').trim(),
        feeRate: parseNumber(row[fieldIndex.feeRate]),
        period: formatPeriod(row[fieldIndex.period]),
      }))
      .filter(
        (row) =>
          row.company &&
          row.businessUnit &&
          row.productCategory &&
          row.productSubcategory &&
          row.feeRate !== null &&
          row.period,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importManufactureRates({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条制造费用率`)
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
