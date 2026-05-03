<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">产品属性对照表</div>
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
      <el-form :inline="true" label-width="110px" class="filter-form">
        <el-form-item label="一级编码名称">
          <el-input v-model="filters.level1Name" placeholder="四通阀事业部" />
        </el-form-item>
        <el-form-item label="父件编码">
          <el-input v-model="filters.parentCode" placeholder="1008900031271" />
        </el-form-item>
        <el-form-item class="filter-form-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="level1Code" label="一级编码" width="100" />
        <el-table-column prop="level1Name" label="一级编码名称" min-width="140" />
        <el-table-column prop="parentCode" label="父件编码" width="140" />
        <el-table-column prop="parentName" label="父件名称" min-width="140" />
        <el-table-column prop="parentSpec" label="父件规格" min-width="140" />
        <el-table-column prop="parentModel" label="父件型号" min-width="140" />
        <el-table-column prop="period" label="期间" width="100" />
        <el-table-column prop="productAttr" label="产品属性" width="120" />
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
      <el-form :model="formModel" label-width="110px">
        <el-form-item label="一级编码">
          <el-input v-model="formModel.level1Code" />
        </el-form-item>
        <el-form-item label="一级编码名称">
          <el-input v-model="formModel.level1Name" />
        </el-form-item>
        <el-form-item label="父件编码">
          <el-input v-model="formModel.parentCode" />
        </el-form-item>
        <el-form-item label="父件名称">
          <el-input v-model="formModel.parentName" />
        </el-form-item>
        <el-form-item label="父件规格">
          <el-input v-model="formModel.parentSpec" />
        </el-form-item>
        <el-form-item label="父件型号">
          <el-input v-model="formModel.parentModel" />
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
        <el-form-item label="产品属性">
          <el-input v-model="formModel.productAttr" />
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
  fetchProductProperties,
  createProductProperty,
  updateProductProperty,
  deleteProductProperty,
  importProductProperties,
} from '../api/productProperties'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  level1Name: '',
  parentCode: '',
})

const formModel = ref({
  level1Code: '',
  level1Name: '',
  parentCode: '',
  parentName: '',
  parentSpec: '',
  parentModel: '',
  period: '',
  productAttr: '',
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑产品属性' : '新增产品属性',
)

const buildParams = () => ({
  level1Name: filters.value.level1Name.trim(),
  parentCode: filters.value.parentCode.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchProductProperties(buildParams())
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
    level1Name: '',
    parentCode: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    level1Code: '',
    level1Name: '',
    parentCode: '',
    parentName: '',
    parentSpec: '',
    parentModel: '',
    period: '',
    productAttr: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    level1Code: row.level1Code ?? '',
    level1Name: row.level1Name ?? '',
    parentCode: row.parentCode ?? '',
    parentName: row.parentName ?? '',
    parentSpec: row.parentSpec ?? '',
    parentModel: row.parentModel ?? '',
    period: row.period ?? '',
    productAttr: row.productAttr ?? '',
  }
  dialogVisible.value = true
}

const submitRow = async () => {
  if (
    !formModel.value.level1Code ||
    !formModel.value.level1Name ||
    !formModel.value.parentCode ||
    !formModel.value.period ||
    !formModel.value.productAttr
  ) {
    ElMessage.warning('一级编码、名称、父件编码、期间、产品属性必填')
    return
  }
  const payload = {
    level1Code: formModel.value.level1Code,
    level1Name: formModel.value.level1Name,
    parentCode: formModel.value.parentCode,
    parentName: formModel.value.parentName,
    parentSpec: formModel.value.parentSpec,
    parentModel: formModel.value.parentModel,
    period: formModel.value.period,
    productAttr: formModel.value.productAttr,
  }
  try {
    if (editingId.value) {
      await updateProductProperty(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createProductProperty(payload)
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
    await deleteProductProperty(row.id)
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
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/^(\d{4})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, '0')}`
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
      level1Code: ['一级编码'],
      level1Name: ['一级编码名称'],
      parentCode: ['父件编码'],
      parentName: ['父件名称'],
      parentSpec: ['父件规格'],
      parentModel: ['父件型号'],
      period: ['期间'],
      productAttr: ['产品属性'],
      coefficient: ['系数', '产品属性系数'],
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
    const requiredFields = ['level1Code', 'level1Name', 'parentCode', 'period', 'productAttr']
    const requiredLabels = {
      level1Code: '一级编码',
      level1Name: '一级编码名称',
      parentCode: '父件编码',
      period: '期间',
      productAttr: '产品属性',
    }
    const missing = requiredFields.filter((field) => fieldIndex[field] === undefined)
    if (missing.length > 0) {
      const names = missing.map((field) => requiredLabels[field] || field)
      ElMessage.error(`缺少表头：${names.join('、')}`)
      return
    }
    const parseCoefficient = (raw) => {
      if (raw === undefined || raw === null) return null
      const text = String(raw).trim()
      if (!text) return null
      const num = Number(text)
      return Number.isFinite(num) ? num : null
    }
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => ({
        level1Code: String(row[fieldIndex.level1Code] || '').trim(),
        level1Name: String(row[fieldIndex.level1Name] || '').trim(),
        parentCode: String(row[fieldIndex.parentCode] || '').trim(),
        parentName: String(row[fieldIndex.parentName] || '').trim(),
        parentSpec: String(row[fieldIndex.parentSpec] || '').trim(),
        parentModel: String(row[fieldIndex.parentModel] || '').trim(),
        period: formatPeriod(row[fieldIndex.period]),
        productAttr: String(row[fieldIndex.productAttr] || '').trim(),
        // 系数列可选；空 → null → 后端落库走 schema DEFAULT 1.0000
        coefficient:
          fieldIndex.coefficient === undefined
            ? null
            : parseCoefficient(row[fieldIndex.coefficient]),
      }))
      .filter(
        (row) =>
          row.level1Code &&
          row.level1Name &&
          row.parentCode &&
          row.period &&
          row.productAttr,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importProductProperties({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条产品属性`)
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

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}

.filter-form :deep(.el-form-item) {
  margin-right: 0;
  margin-bottom: 0;
}

.filter-form :deep(.el-form-item__label) {
  white-space: nowrap;
}

.filter-form :deep(.el-input) {
  width: 240px;
}

.filter-form-actions {
  margin-left: auto;
}
</style>
