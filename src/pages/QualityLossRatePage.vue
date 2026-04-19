<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">质量损失率对照表</div>
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
        <el-form-item label="公司">
          <el-input v-model="filters.company" placeholder="浙江三花智联" />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.businessUnit" placeholder="四通阀事业部" />
        </el-form-item>
        <el-form-item label="产品大类">
          <el-input v-model="filters.productCategory" placeholder="热力膨胀阀" />
        </el-form-item>
        <el-form-item label="产品小类">
          <el-input v-model="filters.productSubcategory" placeholder="RFGF/RFGK" />
        </el-form-item>
        <el-form-item label="客户">
          <el-input v-model="filters.customer" placeholder="客户名称" />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="filters.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
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
        <el-table-column prop="lossRate" label="质量损失率" width="120" />
        <el-table-column prop="customer" label="客户" min-width="120" />
        <el-table-column prop="period" label="期间" width="100" />
        <el-table-column prop="sourceBasis" label="来源依据" min-width="160" />
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
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
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
        <el-form-item label="质量损失率">
          <el-input v-model="formModel.lossRate" />
        </el-form-item>
        <el-form-item label="客户">
          <el-input v-model="formModel.customer" />
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
        <el-form-item label="来源依据">
          <el-input v-model="formModel.sourceBasis" />
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

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  company: '',
  businessUnit: '',
  productCategory: '',
  productSubcategory: '',
  customer: '',
  period: '',
})

const formModel = ref({
  company: '',
  businessUnit: '',
  productCategory: '',
  productSubcategory: '',
  lossRate: '',
  customer: '',
  period: '',
  sourceBasis: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑质量损失率' : '新增质量损失率',
)

const buildParams = () => ({
  company: filters.value.company.trim(),
  businessUnit: filters.value.businessUnit.trim(),
  productCategory: filters.value.productCategory.trim(),
  productSubcategory: filters.value.productSubcategory.trim(),
  customer: filters.value.customer.trim(),
  period: filters.value.period,
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
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    company: '',
    businessUnit: '',
    productCategory: '',
    productSubcategory: '',
    customer: '',
    period: '',
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
    lossRate: '',
    customer: '',
    period: '',
    sourceBasis: '',
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
    lossRate: row.lossRate ?? '',
    customer: row.customer ?? '',
    period: row.period ?? '',
    sourceBasis: row.sourceBasis ?? '',
  }
  dialogVisible.value = true
}

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

watch(currentPage, () => {
  fetchList()
})

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
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/^(\d{4})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}`
  }
  const compact = text.match(/^(\d{4})(\d{2})$/)
  if (compact) {
    return `${compact[1]}-${compact[2]}`
  }
  return text
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
    !formModel.value.productCategory ||
    !formModel.value.productSubcategory ||
    !String(formModel.value.lossRate).trim() ||
    !formModel.value.period
  ) {
    ElMessage.warning('公司、事业部、产品大类/小类、质量损失率、期间必填')
    return
  }
  const payload = {
    company: formModel.value.company,
    businessUnit: formModel.value.businessUnit,
    productCategory: formModel.value.productCategory,
    productSubcategory: formModel.value.productSubcategory,
    lossRate: parseNumber(formModel.value.lossRate),
    customer: formModel.value.customer,
    period: formModel.value.period,
    sourceBasis: formModel.value.sourceBasis,
  }
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
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (error) {
    return
  }
  try {
    await deleteQualityLossRate(row.id)
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
    const headerAliases = {
      company: ['公司'],
      businessUnit: ['生产事业部', '事业部'],
      productCategory: ['产品大类'],
      productSubcategory: ['产品小类'],
      lossRate: ['质量损失率', '损失率'],
      customer: ['客户'],
      period: ['期间', '月份'],
      sourceBasis: ['来源依据', '来源'],
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
      'lossRate',
      'period',
    ]
    const requiredLabels = {
      company: '公司',
      businessUnit: '生产事业部',
      productCategory: '产品大类',
      productSubcategory: '产品小类',
      lossRate: '质量损失率',
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
        lossRate: parseNumber(row[fieldIndex.lossRate]),
        customer: String(row[fieldIndex.customer] || '').trim(),
        period: formatPeriod(row[fieldIndex.period]),
        sourceBasis: String(row[fieldIndex.sourceBasis] || '').trim(),
      }))
      .filter(
        (row) =>
          row.company &&
          row.businessUnit &&
          row.productCategory &&
          row.productSubcategory &&
          row.lossRate !== null &&
          row.period,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importQualityLossRates({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条质量损失率`)
    if (currentPage.value === 1) {
      fetchList()
    } else {
      currentPage.value = 1
    }
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
