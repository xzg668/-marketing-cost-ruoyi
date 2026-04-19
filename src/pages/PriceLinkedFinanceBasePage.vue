<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">影响因素表</div>
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
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.priceMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="简称/影响因素" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="base-title">{{ monthTitle }}</div>
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="seq" label="序号" width="90" />
        <el-table-column
          prop="factorName"
          label="价表影响因素名称"
          min-width="360"
          show-overflow-tooltip
        />
        <el-table-column prop="shortName" label="简称" width="140" />
        <el-table-column prop="priceSource" label="取价来源" width="140" />
        <el-table-column prop="price" label="价格" width="140" />
        <el-table-column prop="unit" label="单位" width="120" />
        <el-table-column prop="linkType" label="固定/联动" width="140" />
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
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑影响因素" width="520px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="formModel.priceMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="序号">
          <el-input v-model="formModel.seq" />
        </el-form-item>
        <el-form-item label="影响因素">
          <el-input v-model="formModel.factorName" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="formModel.shortName" />
        </el-form-item>
        <el-form-item label="取价来源">
          <el-input v-model="formModel.priceSource" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input v-model="formModel.price" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" placeholder="公斤" />
        </el-form-item>
        <el-form-item label="固定/联动">
          <el-select v-model="formModel.linkType" placeholder="固定">
            <el-option label="固定" value="固定" />
            <el-option label="联动" value="联动" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchBasePrices,
  importBasePrices,
  updateBasePrice,
  deleteBasePrice,
} from '../api/basePrices'

const loading = ref(false)
const tableRows = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const importing = ref(false)

const filters = ref({
  priceMonth: '',
  keyword: '',
})

const formModel = ref({
  priceMonth: '',
  seq: '',
  factorName: '',
  shortName: '',
  priceSource: '',
  price: '',
  unit: '公斤',
  linkType: '固定',
})

const monthTitle = computed(() => {
  const month = filters.value.priceMonth || tableRows.value[0]?.priceMonth || ''
  if (!month) {
    return '参照基准'
  }
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) {
    return '参照基准'
  }
  return `${year}年${Number(monthPart)}月参照基准`
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchBasePrices({
      priceMonth: filters.value.priceMonth,
      keyword: filters.value.keyword,
    })
    tableRows.value = Array.isArray(data) ? data : []
    if (!filters.value.priceMonth && tableRows.value.length > 0) {
      filters.value.priceMonth = tableRows.value[0].priceMonth || ''
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取影响因素表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    priceMonth: '',
    keyword: '',
  }
  fetchList()
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    priceMonth: row.priceMonth,
    seq: row.seq,
    factorName: row.factorName,
    shortName: row.shortName,
    priceSource: row.priceSource,
    price: row.price,
    unit: row.unit,
    linkType: row.linkType,
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!editingId.value) {
    dialogVisible.value = false
    return
  }
  if (!formModel.value.priceMonth || !formModel.value.shortName) {
    ElMessage.warning('月份和简称必填')
    return
  }
  await updateBasePrice(editingId.value, formModel.value)
  ElMessage.success('影响因素已更新')
  dialogVisible.value = false
  fetchList()
}

const removeRow = async (row) => {
  await ElMessageBox.confirm('确定删除该影响因素吗？', '提示', {
    type: 'warning',
  })
  await deleteBasePrice(row.id)
  ElMessage.success('已删除')
  fetchList()
}

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/[：:]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .trim()

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseInteger = (value) => {
  const parsed = parseNumber(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.trunc(parsed)
}

const formatMonth = (value) => {
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
      priceMonth: ['价格月份', '月份', '价格月', '期间'],
      seq: ['序号', '序'],
      factorName: ['价表影响因素名称', '影响因素', '影响因素名称'],
      shortName: ['简称'],
      factorCode: ['因素编码', '编码', '代码'],
      priceSource: ['取价来源', '来源'],
      price: ['价格', '单价'],
      unit: ['单位'],
      linkType: ['固定/联动', '联动/固定', '类型'],
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
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => ({
        priceMonth: formatMonth(row[fieldIndex.priceMonth]),
        seq: parseInteger(row[fieldIndex.seq]),
        factorName: String(row[fieldIndex.factorName] || '').trim(),
        shortName: String(row[fieldIndex.shortName] || '').trim(),
        factorCode: String(row[fieldIndex.factorCode] || '').trim(),
        priceSource: String(row[fieldIndex.priceSource] || '').trim(),
        price: parseNumber(row[fieldIndex.price]),
        unit: String(row[fieldIndex.unit] || '').trim(),
        linkType: String(row[fieldIndex.linkType] || '').trim(),
      }))
      .filter((row) => row.factorName || row.shortName)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const importMonth =
      dataRows.find((row) => row.priceMonth)?.priceMonth || filters.value.priceMonth
    if (!importMonth) {
      ElMessage.warning('缺少价格月份，请填写或在Excel中提供')
      return
    }
    const payloadRows = dataRows.map((row) => ({
      seq: row.seq,
      factorName: row.factorName,
      shortName: row.shortName,
      factorCode: row.factorCode,
      priceSource: row.priceSource,
      price: row.price,
      unit: row.unit,
      linkType: row.linkType,
    }))
    await importBasePrices({ priceMonth: importMonth, rows: payloadRows })
    filters.value.priceMonth = importMonth
    ElMessage.success(`已导入${payloadRows.length}条影响因素`)
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

.base-title {
  font-size: 18px;
  font-weight: 600;
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
