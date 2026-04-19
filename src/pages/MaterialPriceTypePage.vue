<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">物料价格类型对照表</div>
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
        <el-form-item label="单据号">
          <el-input v-model="filters.billNo" placeholder="JG202601010001" />
        </el-form-item>
        <el-form-item label="物料编码">
          <el-input v-model="filters.materialCode" placeholder="1008000300944" />
        </el-form-item>
        <el-form-item label="价格类型">
          <el-select v-model="filters.priceType" placeholder="全部">
            <el-option label="全部" value="" />
            <el-option label="联动价" value="联动价" />
            <el-option label="固定价" value="固定价" />
            <el-option label="区间价" value="区间价" />
            <el-option label="结算价" value="结算价" />
          </el-select>
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
        <el-table-column prop="rowNo" label="行号" width="80" />
        <el-table-column prop="billNo" label="单据号" width="160" />
        <el-table-column prop="materialCode" label="物料编码" width="160" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" />
        <el-table-column prop="materialSpec" label="规格" min-width="160" />
        <el-table-column prop="materialModel" label="型号" min-width="160" />
        <el-table-column prop="materialShape" label="物料形态属性" width="120" />
        <el-table-column prop="priceType" label="价格类型" width="120" />
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
        <el-form-item label="行号">
          <el-input v-model="formModel.rowNo" />
        </el-form-item>
        <el-form-item label="单据号">
          <el-input v-model="formModel.billNo" />
        </el-form-item>
        <el-form-item label="物料编码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formModel.materialSpec" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="formModel.materialModel" />
        </el-form-item>
        <el-form-item label="物料形态属性">
          <el-select v-model="formModel.materialShape" placeholder="制造件">
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格类型">
          <el-select v-model="formModel.priceType" placeholder="联动价">
            <el-option label="联动价" value="联动价" />
            <el-option label="固定价" value="固定价" />
            <el-option label="区间价" value="区间价" />
            <el-option label="结算价" value="结算价" />
          </el-select>
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
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchMaterialPriceTypes,
  importMaterialPriceTypes,
  createMaterialPriceType,
  updateMaterialPriceType,
  deleteMaterialPriceType,
} from '../api/materialPriceTypes'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  billNo: '',
  materialCode: '',
  priceType: '',
  period: '',
})

const formModel = ref({
  rowNo: '',
  billNo: '',
  materialCode: '',
  materialName: '',
  materialSpec: '',
  materialModel: '',
  materialShape: '制造件',
  priceType: '联动价',
  period: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑物料价格类型' : '新增物料价格类型',
)

const buildParams = () => ({
  billNo: filters.value.billNo.trim(),
  materialCode: filters.value.materialCode.trim(),
  priceType: filters.value.priceType,
  period: filters.value.period,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchMaterialPriceTypes(buildParams())
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

watch(currentPage, () => {
  fetchList()
})

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    billNo: '',
    materialCode: '',
    priceType: '',
    period: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    rowNo: '',
    billNo: '',
    materialCode: '',
    materialName: '',
    materialSpec: '',
    materialModel: '',
    materialShape: '制造件',
    priceType: '联动价',
    period: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    rowNo: row.rowNo ?? '',
    billNo: row.billNo,
    materialCode: row.materialCode,
    materialName: row.materialName,
    materialSpec: row.materialSpec,
    materialModel: row.materialModel,
    materialShape: row.materialShape,
    priceType: row.priceType,
    period: row.period,
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
    !formModel.value.billNo ||
    !formModel.value.materialCode ||
    !formModel.value.priceType ||
    !formModel.value.period
  ) {
    ElMessage.warning('单据号、物料编码、价格类型、期间必填')
    return
  }
  const payload = {
    rowNo: parseNumber(formModel.value.rowNo),
    billNo: formModel.value.billNo,
    materialCode: formModel.value.materialCode,
    materialName: formModel.value.materialName,
    materialSpec: formModel.value.materialSpec,
    materialModel: formModel.value.materialModel,
    materialShape: formModel.value.materialShape,
    priceType: formModel.value.priceType,
    period: formModel.value.period,
  }
  try {
    if (editingId.value) {
      await updateMaterialPriceType(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createMaterialPriceType(payload)
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
    await deleteMaterialPriceType(row.id)
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    const text = String(Math.trunc(value))
    if (text.length === 6) {
      return `${text.slice(0, 4)}-${text.slice(4)}`
    }
    return text
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
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    })
    const headerAliases = {
      rowNo: ['行号', '序号'],
      billNo: ['单据号', '单据编号'],
      materialCode: ['物料编码', '物料编号', '料号'],
      materialName: ['物料名称', '名称'],
      materialSpec: ['规格'],
      materialModel: ['型号'],
      materialShape: ['物料形态属性', '形态属性'],
      priceType: ['价格类型', '价格类别'],
      period: ['期间', '价格期间', '月份'],
    }
    const headerMap = Object.entries(headerAliases).reduce((acc, [key, values]) => {
      values.forEach((value) => {
        acc[normalizeHeader(value)] = key
      })
      return acc
    }, {})
    const headerKeys = Object.keys(headerMap).sort(
      (a, b) => b.length - a.length,
    )
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
    const requiredFields = ['billNo', 'materialCode', 'priceType', 'period']
    const requiredLabels = {
      billNo: '单据号',
      materialCode: '物料编码',
      priceType: '价格类型',
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
      .map((row) => {
        const period = formatPeriod(row[fieldIndex.period])
        return {
          rowNo: parseNumber(row[fieldIndex.rowNo]),
          billNo: String(row[fieldIndex.billNo] || '').trim(),
          materialCode: String(row[fieldIndex.materialCode] || '').trim(),
          materialName: String(row[fieldIndex.materialName] || '').trim(),
          materialSpec: String(row[fieldIndex.materialSpec] || '').trim(),
          materialModel: String(row[fieldIndex.materialModel] || '').trim(),
          materialShape: String(row[fieldIndex.materialShape] || '').trim(),
          priceType: String(row[fieldIndex.priceType] || '').trim(),
          period,
        }
      })
      .filter((row) => row.materialCode && row.billNo && row.priceType && row.period)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importMaterialPriceTypes({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条记录`)
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

onMounted(() => {
  fetchList()
})
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
