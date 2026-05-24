<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">报价净损失率配置表</div>
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
          <el-date-picker
            v-model="filters.rateYear"
            type="year"
            format="YYYY"
            value-format="YYYY"
            placeholder="选择年度"
          />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.businessDivision" placeholder="四通阀事业部" />
        </el-form-item>
        <el-form-item label="产品料号">
          <el-input v-model="filters.productCode" placeholder="产品料号" />
        </el-form-item>
        <el-form-item label="产品型号">
          <el-input v-model="filters.productModel" placeholder="产品型号" />
        </el-form-item>
        <el-form-item label="产品大类">
          <el-input v-model="filters.productCategory" placeholder="产品大类" />
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
        <el-table-column prop="businessDivision" label="事业部" min-width="140" />
        <el-table-column prop="productCategory" label="产品大类" min-width="140" />
        <el-table-column prop="productCode" label="产品料号" min-width="150" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="productModel" label="产品型号" min-width="150" />
        <el-table-column prop="productSpec" label="产品规格" min-width="150" />
        <el-table-column label="报价净损失率" width="130">
          <template #default="{ row }">{{ formatRate(row.lossRate) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px">
      <el-form :model="formModel" label-width="110px">
        <el-form-item label="年度">
          <el-date-picker
            v-model="formModel.rateYear"
            type="year"
            format="YYYY"
            value-format="YYYY"
            placeholder="选择年度"
          />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="formModel.businessDivision" />
        </el-form-item>
        <el-form-item label="产品大类">
          <el-input v-model="formModel.productCategory" />
        </el-form-item>
        <el-form-item label="产品料号">
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
        <el-form-item label="报价净损失率">
          <el-input v-model="formModel.lossRate" placeholder="例如 1% 或 0.01" />
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

const currentYear = String(new Date().getFullYear())

const filters = ref({
  rateYear: currentYear,
  businessDivision: '',
  productCategory: '',
  productCode: '',
  productName: '',
  productModel: '',
})

const emptyForm = () => ({
  rateYear: filters.value.rateYear || currentYear,
  businessDivision: '',
  productCategory: '',
  productCode: '',
  productName: '',
  productModel: '',
  productSpec: '',
  lossRate: '',
  remark: '',
})

const formModel = ref(emptyForm())
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑报价净损失率' : '新增报价净损失率',
)

const toYearNumber = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const buildParams = () => ({
  rateYear: toYearNumber(filters.value.rateYear),
  businessDivision: filters.value.businessDivision.trim(),
  productCategory: filters.value.productCategory.trim(),
  productCode: filters.value.productCode.trim(),
  productName: filters.value.productName.trim(),
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
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    rateYear: currentYear,
    businessDivision: '',
    productCategory: '',
    productCode: '',
    productName: '',
    productModel: '',
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
    rateYear: row.rateYear ? String(row.rateYear) : currentYear,
    businessDivision: row.businessDivision ?? row.businessUnit ?? '',
    productCategory: row.productCategory ?? '',
    productCode: row.productCode ?? '',
    productName: row.productName ?? '',
    productModel: row.productModel ?? '',
    productSpec: row.productSpec ?? '',
    lossRate: row.lossRate ?? '',
    remark: row.remark ?? '',
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
  const rateYear = toYearNumber(formModel.value.rateYear)
  const lossRate = parseRate(formModel.value.lossRate)
  if (!rateYear || lossRate === null) {
    ElMessage.warning('年度、报价净损失率必填')
    return
  }
  if (!formModel.value.productCode.trim() && !formModel.value.productModel.trim()) {
    ElMessage.warning('产品料号和产品型号至少填写一个')
    return
  }
  const payload = {
    rateYear,
    period: `${rateYear}-01`,
    businessDivision: formModel.value.businessDivision,
    businessUnit: formModel.value.businessDivision,
    productCategory: formModel.value.productCategory,
    productCode: formModel.value.productCode,
    productName: formModel.value.productName,
    productModel: formModel.value.productModel,
    productSpec: formModel.value.productSpec,
    lossRate,
    remark: formModel.value.remark,
    sourceType: 'MANUAL',
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
  const rateYear = toYearNumber(filters.value.rateYear)
  if (!rateYear) {
    ElMessage.warning('请先选择导入年度')
    return
  }
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
      productCategory: ['产品大类'],
      productCode: ['产品料号', '料号'],
      productName: ['产品名称', '品名'],
      productModel: ['产品型号', '型号'],
      productSpec: ['产品规格', '规格'],
      lossRate: ['报价净损失率', '净损失率', '质量损失率', '损失率'],
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
    if (fieldIndex.lossRate === undefined) {
      ElMessage.error('缺少表头：报价净损失率')
      return
    }
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row, index) => ({
        rowNo: headerIndex + index + 2,
        businessDivision: String(row[fieldIndex.businessDivision] || '').trim(),
        businessUnit: String(row[fieldIndex.businessDivision] || '').trim(),
        productCategory: String(row[fieldIndex.productCategory] || '').trim(),
        productCode: String(row[fieldIndex.productCode] || '').trim(),
        productName: String(row[fieldIndex.productName] || '').trim(),
        productModel: String(row[fieldIndex.productModel] || '').trim(),
        productSpec: String(row[fieldIndex.productSpec] || '').trim(),
        lossRate: parseRate(row[fieldIndex.lossRate]),
        remark: String(row[fieldIndex.remark] || '').trim(),
      }))
      .filter((row) =>
        Object.entries(row).some(([key, value]) => key !== 'rowNo' && value !== '' && value !== null),
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importQualityLossRates({ rateYear, rows: dataRows })
    const imported = (result?.inserted || 0) + (result?.updated || 0)
    if (result?.errors > 0) {
      ElMessage.warning(`导入${imported}条，失败${result.errors}条：${result.errorMessages?.[0] || ''}`)
    } else {
      ElMessage.success(`已导入${imported}条报价净损失率`)
    }
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
