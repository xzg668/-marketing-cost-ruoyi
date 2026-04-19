<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">辅料科目表</div>
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
        <el-form-item label="科目编码">
          <el-input v-model="filters.auxSubjectCode" placeholder="1001" />
        </el-form-item>
        <el-form-item label="物料编码">
          <el-input v-model="filters.materialCode" placeholder="1008900031271" />
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
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="productName" label="产品名称" min-width="140" />
        <el-table-column prop="spec" label="规格" min-width="120" />
        <el-table-column prop="model" label="型号" min-width="120" />
        <el-table-column prop="refMaterialCode" label="参考料号" width="140" />
        <el-table-column prop="auxSubjectCode" label="辅料科目编码" width="120" />
        <el-table-column prop="auxSubjectName" label="辅料科目名称" min-width="140" />
        <el-table-column prop="unitPrice" label="单价" width="100" />
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
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="物料编码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="formModel.productName" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formModel.spec" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="formModel.model" />
        </el-form-item>
        <el-form-item label="参考料号">
          <el-input v-model="formModel.refMaterialCode" @blur="fetchUnitPrice">
            <template #append>
              <el-button @click="fetchUnitPrice">取价</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="辅料科目编码">
          <el-input v-model="formModel.auxSubjectCode" />
        </el-form-item>
        <el-form-item label="辅料科目名称">
          <el-input v-model="formModel.auxSubjectName" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.unitPrice" />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="formModel.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
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
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchAuxSubjects,
  importAuxSubjects,
  createAuxSubject,
  updateAuxSubject,
  deleteAuxSubject,
  fetchAuxSubjectQuote,
} from '../api/auxSubjects'

const filters = ref({
  materialCode: '',
  auxSubjectCode: '',
  period: '',
})

const dialogVisible = ref(false)
const editingId = ref(null)
const loading = ref(false)
const importing = ref(false)
const formModel = ref({
  materialCode: '',
  productName: '',
  spec: '',
  model: '',
  refMaterialCode: '',
  auxSubjectCode: '',
  auxSubjectName: '',
  unitPrice: '',
  period: '',
})

const currentPage = ref(1)
const pageSize = ref(20)
const tableRows = ref([])
const total = ref(0)

const dialogTitle = computed(() =>
  editingId.value ? '编辑辅料科目' : '新增辅料科目',
)

const buildParams = () => ({
  materialCode: filters.value.materialCode.trim(),
  auxSubjectCode: filters.value.auxSubjectCode.trim(),
  period: filters.value.period,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchAuxSubjects(buildParams())
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
    materialCode: '',
    auxSubjectCode: '',
    period: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    materialCode: '',
    productName: '',
    spec: '',
    model: '',
    refMaterialCode: '',
    auxSubjectCode: '',
    auxSubjectName: '',
    unitPrice: '',
    period: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    materialCode: row.materialCode ?? '',
    productName: row.productName ?? '',
    spec: row.spec ?? '',
    model: row.model ?? '',
    refMaterialCode: row.refMaterialCode ?? '',
    auxSubjectCode: row.auxSubjectCode ?? '',
    auxSubjectName: row.auxSubjectName ?? '',
    unitPrice: row.unitPrice ?? '',
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
    !formModel.value.materialCode ||
    !formModel.value.auxSubjectCode ||
    !formModel.value.auxSubjectName ||
    !formModel.value.period
  ) {
    ElMessage.warning('物料编码、科目编码、科目名称、期间必填')
    return
  }
  const payload = {
    materialCode: formModel.value.materialCode,
    productName: formModel.value.productName,
    spec: formModel.value.spec,
    model: formModel.value.model,
    refMaterialCode: formModel.value.refMaterialCode,
    auxSubjectCode: formModel.value.auxSubjectCode,
    auxSubjectName: formModel.value.auxSubjectName,
    unitPrice: parseNumber(formModel.value.unitPrice),
    period: formModel.value.period,
  }
  try {
    if (editingId.value) {
      await updateAuxSubject(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createAuxSubject(payload)
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
    await deleteAuxSubject(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
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
  const match = text.match(/^(\\d{4})[-/.](\\d{1,2})/)
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}`
  }
  const compact = text.match(/^(\\d{4})(\\d{2})$/)
  if (compact) {
    return `${compact[1]}-${compact[2]}`
  }
  return text
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
      materialCode: ['物料编码', '物料代码', '料号'],
      productName: ['产品名称', '物料名称'],
      spec: ['规格'],
      model: ['型号'],
      refMaterialCode: ['参考料号'],
      auxSubjectCode: ['辅料科目编码'],
      auxSubjectName: ['辅料科目名称'],
      unitPrice: ['单价'],
      period: ['期间', '价格期间', '月份'],
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
    const requiredFields = ['materialCode', 'auxSubjectCode', 'auxSubjectName', 'period']
    const requiredLabels = {
      materialCode: '物料编码',
      auxSubjectCode: '辅料科目编码',
      auxSubjectName: '辅料科目名称',
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
        materialCode: String(row[fieldIndex.materialCode] || '').trim(),
        productName: String(row[fieldIndex.productName] || '').trim(),
        spec: String(row[fieldIndex.spec] || '').trim(),
        model: String(row[fieldIndex.model] || '').trim(),
        refMaterialCode: String(row[fieldIndex.refMaterialCode] || '').trim(),
        auxSubjectCode: String(row[fieldIndex.auxSubjectCode] || '').trim(),
        auxSubjectName: String(row[fieldIndex.auxSubjectName] || '').trim(),
        unitPrice: parseNumber(row[fieldIndex.unitPrice]),
        period: formatPeriod(row[fieldIndex.period]),
      }))
      .filter((row) =>
        row.materialCode &&
        row.auxSubjectCode &&
        row.auxSubjectName &&
        row.period
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importAuxSubjects({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条辅料科目`)
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

const fetchUnitPrice = async () => {
  if (
    !formModel.value.refMaterialCode ||
    !formModel.value.auxSubjectCode ||
    !formModel.value.period
  ) {
    return
  }
  try {
    const data = await fetchAuxSubjectQuote({
      refMaterialCode: formModel.value.refMaterialCode.trim(),
      auxSubjectCode: formModel.value.auxSubjectCode.trim(),
      period: formModel.value.period,
    })
    if (data?.unitPrice !== null && data?.unitPrice !== undefined) {
      formModel.value.unitPrice = data.unitPrice
      ElMessage.success('已获取单价')
    } else {
      ElMessage.warning('未找到参考单价')
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取单价失败')
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
