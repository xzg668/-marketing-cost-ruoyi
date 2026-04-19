<template>
  <div class="range-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">区间价</div>
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
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="请输入物料代码" />
        </el-form-item>
        <el-form-item label="帐期">
          <el-date-picker
            v-model="filters.effectiveFrom"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="请选择帐期"
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
        <el-table-column prop="materialName" label="名称" min-width="140" />
        <el-table-column prop="materialCode" label="U9代码" width="160" />
        <el-table-column prop="specModel" label="图号" width="160" />
        <el-table-column label="区间" width="180">
          <template #default="{ row }">
            {{ formatRange(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="priceExclTax" label="不含税价" width="120" />
        <el-table-column prop="priceInclTax" label="含税价" width="120" />
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px">
      <el-form :model="formModel" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="物料名称">
              <el-input v-model="formModel.materialName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物料代码">
              <el-input v-model="formModel.materialCode" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="规格型号">
              <el-input v-model="formModel.specModel" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="区间下限">
              <el-input v-model="formModel.rangeLow" placeholder="元/吨" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="区间上限">
              <el-input v-model="formModel.rangeHigh" placeholder="元/吨" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="不含税价">
              <el-input v-model="formModel.priceExclTax" placeholder="元/米" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="含税价">
              <el-input v-model="formModel.priceInclTax" placeholder="元/米" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生效日期">
              <el-date-picker
                v-model="formModel.effectiveFrom"
                type="date"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
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
  fetchRangeItems,
  importRangeItems,
  createRangeItem,
  updateRangeItem,
  deleteRangeItem,
} from '../api/priceRangeItems'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
  effectiveFrom: '',
})

const emptyForm = () => ({
  materialName: '',
  materialCode: '',
  specModel: '',
  rangeLow: '',
  rangeHigh: '',
  priceExclTax: '',
  priceInclTax: '',
  effectiveFrom: '',
})

const formModel = ref(emptyForm())

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() => (
  editingId.value ? '编辑区间价' : '新增区间价'
))

const buildParams = () => ({
  materialCode: filters.value.materialCode.trim(),
  effectiveFrom: filters.value.effectiveFrom || '',
  page: currentPage.value,
  pageSize: pageSize.value,
})

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseBoolean = (value) => {
  if (value === true || value === false) {
    return value
  }
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (['1', 'true', 'y', 'yes', '是', '含税', '含'].includes(text)) {
    return true
  }
  if (['0', 'false', 'n', 'no', '否', '未税', '不含税', '未含税'].includes(text)) {
    return false
  }
  return null
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const fullMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`
  }
  const ymMatch = text.match(/(\d{4})[-/.](\d{1,2})$/)
  if (ymMatch) {
    return `${ymMatch[1]}-${ymMatch[2].padStart(2, '0')}-01`
  }
  const yearMatch = text.match(/^(\d{4})$/)
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`
  }
  return text.replace(/\//g, '-')
}

const normalizeTaxValue = (value) => {
  if (value === true || value === false) {
    return value
  }
  if (value === 1 || value === '1') {
    return true
  }
  if (value === 0 || value === '0') {
    return false
  }
  return null
}

const formatTaxIncluded = (value) => {
  const normalized = normalizeTaxValue(value)
  if (normalized === true) {
    return '含税'
  }
  if (normalized === false) {
    return '未税'
  }
  return ''
}

const formatRange = (row) => {
  if (row?.rangeLow == null || row?.rangeHigh == null) {
    return ''
  }
  return `${row.rangeLow}—${row.rangeHigh}元/吨`
}

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchRangeItems(buildParams())
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

watch(currentPage, () => fetchList())

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
    materialCode: '',
    effectiveFrom: '',
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
    materialName: row.materialName ?? '',
    materialCode: row.materialCode ?? '',
    specModel: row.specModel ?? '',
    rangeLow: row.rangeLow ?? '',
    rangeHigh: row.rangeHigh ?? '',
    priceExclTax: row.priceExclTax ?? '',
    priceInclTax: row.priceInclTax ?? '',
    effectiveFrom: row.effectiveFrom ?? '',
  }
  dialogVisible.value = true
}

const submitRow = async () => {
  const payload = {
    materialName: formModel.value.materialName.trim(),
    materialCode: formModel.value.materialCode.trim(),
    specModel: formModel.value.specModel.trim(),
    rangeLow: parseNumber(formModel.value.rangeLow),
    rangeHigh: parseNumber(formModel.value.rangeHigh),
    priceExclTax: parseNumber(formModel.value.priceExclTax),
    priceInclTax: parseNumber(formModel.value.priceInclTax),
    effectiveFrom: normalizeDate(formModel.value.effectiveFrom),
  }

  if (!payload.materialCode) {
    ElMessage.warning('物料代码必填')
    return
  }
  if (payload.rangeLow === null || payload.rangeHigh === null) {
    ElMessage.warning('区间上下限必填')
    return
  }
  if (payload.priceExclTax === null && payload.priceInclTax === null) {
    ElMessage.warning('不含税价和含税价至少填写一个')
    return
  }

  try {
    if (editingId.value) {
      await updateRangeItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createRangeItem(payload)
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
    await ElMessageBox.confirm('确定删除该条区间价记录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteRangeItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const normalizeHeader = (value) => String(value ?? '').replace(/[\s\u3000]+/g, '')

const findColumn = (headerRow, aliases) => {
  if (!Array.isArray(headerRow) || !Array.isArray(aliases) || aliases.length === 0) {
    return -1
  }
  for (let index = 0; index < headerRow.length; index += 1) {
    const cellText = normalizeHeader(headerRow[index])
    if (!cellText) {
      continue
    }
    if (aliases.some((alias) => cellText.includes(alias))) {
      return index
    }
  }
  return -1
}

const readString = (row, index) => {
  if (!Array.isArray(row) || index < 0) {
    return ''
  }
  return String(row[index] ?? '').trim()
}

const readNumber = (row, index) => {
  if (!Array.isArray(row) || index < 0) {
    return null
  }
  return parseNumber(row[index])
}

const readDate = (row, index) => {
  if (!Array.isArray(row) || index < 0) {
    return ''
  }
  return normalizeDate(row[index])
}

const isExclTaxHeader = (text) =>
  text.includes('不含税')

const isInclTaxHeader = (text) =>
  !text.includes('不含税') && (text.includes('含税') || /含\d*%?税/.test(text) || text.includes('税价'))

const detectRangeColumns = (headerRow1, headerRow2) => {
  const rangeRegex = /(\d+)\s*(?:元\/吨|元每吨)?\s*[—\-~～至到]+\s*(\d+)\s*(?:元\/吨|元每吨)?/
  const groups = []

  headerRow1.forEach((cell, index) => {
    const title = normalizeHeader(cell)
    const match = title.match(rangeRegex)
    if (!match) {
      return
    }
    const rangeLow = Number(match[1])
    const rangeHigh = Number(match[2])
    const sub = normalizeHeader(headerRow2[index])
    const nextSub = normalizeHeader(headerRow2[index + 1])
    const group = {
      rangeLow,
      rangeHigh,
      priceCol: null,
      exclCol: null,
      inclCol: null,
    }

    if (isExclTaxHeader(sub)) {
      group.exclCol = index
      if (isInclTaxHeader(nextSub)) {
        group.inclCol = index + 1
      }
    } else if (isInclTaxHeader(sub)) {
      group.inclCol = index
      if (isExclTaxHeader(nextSub)) {
        group.exclCol = index + 1
      }
    } else if (isInclTaxHeader(nextSub)) {
      group.exclCol = index
      group.inclCol = index + 1
    } else {
      group.priceCol = index
    }
    groups.push(group)
  })

  return groups
}

const parseFixedColumns = (headerRow) => ({
  orgCode: findColumn(headerRow, ['组织']),
  sourceName: findColumn(headerRow, ['来源']),
  supplierName: findColumn(headerRow, ['供应商名称']),
  supplierCode: findColumn(headerRow, ['供应商代码']),
  purchaseClass: findColumn(headerRow, ['采购分类']),
  materialName: findColumn(headerRow, ['物料名称', '名称']),
  materialCode: findColumn(headerRow, ['物料代码', 'U9代码']),
  specModel: findColumn(headerRow, ['规格型号', '图号']),
  unit: findColumn(headerRow, ['单位']),
  formulaExpr: findColumn(headerRow, ['联动公式', '公式']),
  blankWeight: findColumn(headerRow, ['下料重']),
  netWeight: findColumn(headerRow, ['净重']),
  processFee: findColumn(headerRow, ['加工费']),
  agentFee: findColumn(headerRow, ['代理费']),
  taxIncluded: findColumn(headerRow, ['是否含税']),
  effectiveFrom: findColumn(headerRow, ['生效日期', '帐期', '账期']),
  effectiveTo: findColumn(headerRow, ['失效日期']),
  orderType: findColumn(headerRow, ['订单类型']),
  quota: findColumn(headerRow, ['配额']),
  rangeLow: findColumn(headerRow, ['区间下限', '区间开始']),
  rangeHigh: findColumn(headerRow, ['区间上限', '区间结束']),
  priceExclTax: findColumn(headerRow, ['不含税价', '未税价']),
  priceInclTax: findColumn(headerRow, ['含税价']),
  singlePrice: findColumn(headerRow, ['单价']),
})

const buildImportBase = (row, columns) => ({
  orgCode: readString(row, columns.orgCode),
  sourceName: readString(row, columns.sourceName),
  supplierName: readString(row, columns.supplierName),
  supplierCode: readString(row, columns.supplierCode),
  purchaseClass: readString(row, columns.purchaseClass),
  materialName: readString(row, columns.materialName),
  materialCode: readString(row, columns.materialCode),
  specModel: readString(row, columns.specModel),
  unit: readString(row, columns.unit),
  formulaExpr: readString(row, columns.formulaExpr),
  blankWeight: readNumber(row, columns.blankWeight),
  netWeight: readNumber(row, columns.netWeight),
  processFee: readNumber(row, columns.processFee),
  agentFee: readNumber(row, columns.agentFee),
  taxIncluded: parseBoolean(readString(row, columns.taxIncluded)),
  effectiveFrom: readDate(row, columns.effectiveFrom),
  effectiveTo: readDate(row, columns.effectiveTo),
  orderType: readString(row, columns.orderType),
  quota: readNumber(row, columns.quota),
})

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }

  importing.value = true
  try {
    let XLSX = null
    try {
      const module = await import('xlsx')
      XLSX = module
    } catch {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }

    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })

    if (rows.length < 2) {
      ElMessage.warning('Excel无有效数据')
      return
    }

    const headerRow1 = rows[0] || []
    const headerRow2 = rows[1] || []
    const columns = parseFixedColumns(headerRow1)
    const rangeGroups = detectRangeColumns(headerRow1, headerRow2)
    const hasSubHeader = headerRow2.some((cell) => {
      const text = normalizeHeader(cell)
      return isExclTaxHeader(text) || isInclTaxHeader(text)
    })
    const dataStartRow = hasSubHeader ? 2 : 1
    const importRows = []

    for (let rowIndex = dataStartRow; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      const base = buildImportBase(row, columns)
      if (!base.materialCode) {
        continue
      }

      if (rangeGroups.length > 0) {
        rangeGroups.forEach((range) => {
          let priceExclTax = range.exclCol == null ? null : readNumber(row, range.exclCol)
          let priceInclTax = range.inclCol == null ? null : readNumber(row, range.inclCol)

          if (range.priceCol != null) {
            const singlePrice = readNumber(row, range.priceCol)
            if (singlePrice !== null) {
              if (base.taxIncluded === true) {
                priceInclTax = singlePrice
              } else {
                priceExclTax = singlePrice
              }
            }
          }

          if (priceExclTax === null && priceInclTax === null) {
            return
          }

          importRows.push({
            ...base,
            rangeLow: range.rangeLow,
            rangeHigh: range.rangeHigh,
            priceExclTax,
            priceInclTax,
          })
        })
      } else {
        const rangeLow = readNumber(row, columns.rangeLow)
        const rangeHigh = readNumber(row, columns.rangeHigh)
        let priceExclTax = readNumber(row, columns.priceExclTax)
        let priceInclTax = readNumber(row, columns.priceInclTax)
        const singlePrice = readNumber(row, columns.singlePrice)

        if (singlePrice !== null && priceExclTax === null && priceInclTax === null) {
          if (base.taxIncluded === true) {
            priceInclTax = singlePrice
          } else {
            priceExclTax = singlePrice
          }
        }

        if (rangeLow === null || rangeHigh === null) {
          continue
        }
        if (priceExclTax === null && priceInclTax === null) {
          continue
        }

        importRows.push({
          ...base,
          rangeLow,
          rangeHigh,
          priceExclTax,
          priceInclTax,
        })
      }
    }

    if (importRows.length === 0) {
      ElMessage.warning('未解析到有效区间价数据')
      return
    }

    await importRangeItems({ rows: importRows })
    ElMessage.success(`已导入${importRows.length}条区间价`)
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
.range-page {
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
