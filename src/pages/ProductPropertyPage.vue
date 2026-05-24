<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">产品属性对照表</div>
        <div class="filter-actions">
          <el-button :loading="importing" @click="openImportDialog">导入</el-button>
          <el-button type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="110px" class="filter-form">
        <el-form-item label="年度" required>
          <el-date-picker
            v-model="filters.propertyYear"
            type="year"
            value-format="YYYY"
            placeholder="选择年度"
            @change="onFilterYearChange"
          />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.businessDivision" placeholder="四通阀事业部" clearable />
        </el-form-item>
        <el-form-item label="产品料号">
          <el-input v-model="filters.productCode" placeholder="产品料号" clearable />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="filters.productName" placeholder="产品名称" clearable />
        </el-form-item>
        <el-form-item label="产品属性">
          <el-input v-model="filters.productAttr" placeholder="标准品/非标品" clearable />
        </el-form-item>
        <el-form-item label="属性来源">
          <el-select v-model="filters.attrSourceType" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="技术导入" value="TECH_IMPORT" />
            <el-option label="手工维护" value="MANUAL" />
            <el-option label="OA报价" value="OA_QUOTE_USAGE" />
          </el-select>
        </el-form-item>
        <el-form-item label="年用量来源">
          <el-select v-model="filters.annualUsageSourceType" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="技术导入" value="TECH_IMPORT" />
            <el-option label="手工维护" value="MANUAL" />
            <el-option label="OA报价" value="OA_QUOTE_USAGE" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-form-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="businessDivision" label="事业部" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ displayBusinessDivision(row) }}</template>
        </el-table-column>
        <el-table-column prop="productCode" label="产品料号" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ displayProductCode(row) }}</template>
        </el-table-column>
        <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ displayProductName(row) }}</template>
        </el-table-column>
        <el-table-column prop="productModel" label="产品型号" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ displayProductModel(row) }}</template>
        </el-table-column>
        <el-table-column prop="productSpec" label="产品规格" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ displayProductSpec(row) }}</template>
        </el-table-column>
        <el-table-column prop="productAttr" label="产品属性" width="120" />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column prop="annualUsage" label="预计年用量" width="130" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px">
      <el-form :model="formModel" label-width="110px" class="property-form">
        <div class="form-grid">
          <el-form-item label="年度" required>
            <el-date-picker
              v-model="formModel.propertyYear"
              type="year"
              value-format="YYYY"
              placeholder="选择年度"
            />
          </el-form-item>
          <el-form-item label="事业部" required>
            <el-input v-model="formModel.businessDivision" />
          </el-form-item>
          <el-form-item label="产品料号" required>
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
          <el-form-item label="产品属性" required>
            <el-input v-model="formModel.productAttr" />
          </el-form-item>
          <el-form-item label="预计年用量">
            <el-input-number
              v-model="formModel.annualUsage"
              :precision="2"
              :min="0"
              :controls="false"
              placeholder="预计年用量"
            />
          </el-form-item>
          <el-form-item label="属性系数">
            <el-input v-model="formModel.coefficient" disabled />
          </el-form-item>
          <el-form-item label="年用量来源">
            <el-input :model-value="sourceText(formModel.annualUsageSourceType)" disabled />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="formModel.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入产品属性" width="760px">
      <el-form label-width="90px" class="import-form">
        <el-form-item label="导入年度" required>
          <el-date-picker
            v-model="importYear"
            type="year"
            value-format="YYYY"
            placeholder="选择年度"
          />
        </el-form-item>
        <el-form-item label="上传文件" required>
          <el-upload
            class="upload-field"
            drag
            :limit="1"
            :show-file-list="true"
            :auto-upload="false"
            accept=".xlsx,.xls,.csv"
            :on-change="handleImportFileChange"
            :on-remove="handleImportFileRemove"
          >
            <div class="upload-text">选择 Excel 文件</div>
          </el-upload>
        </el-form-item>
      </el-form>

      <section v-if="importResult" class="import-result">
        <div class="result-grid">
          <div><span>新增</span><strong>{{ importResult.inserted || 0 }}</strong></div>
          <div><span>更新</span><strong>{{ importResult.updated || 0 }}</strong></div>
          <div><span>跳过</span><strong>{{ importResult.skipped || 0 }}</strong></div>
          <div><span>错误</span><strong>{{ importResult.errors || 0 }}</strong></div>
          <div><span>风险</span><strong>{{ importResult.risks || 0 }}</strong></div>
        </div>
        <el-table
          v-if="importIssues.length"
          :data="importIssues"
          size="small"
          max-height="260"
          class="issue-table"
        >
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === '错误' ? 'danger' : 'warning'" effect="light">
                {{ row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="明细" show-overflow-tooltip />
        </el-table>
      </section>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
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

const currentYear = () => String(new Date().getFullYear())

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const editingId = ref(null)
const importYear = ref(currentYear())
const importFile = ref(null)
const importResult = ref(null)
const localImportWarnings = ref([])

const filters = ref({
  propertyYear: currentYear(),
  businessDivision: '',
  productCode: '',
  productName: '',
  productAttr: '',
  attrSourceType: '',
  annualUsageSourceType: '',
})

const formModel = ref({
  propertyYear: currentYear(),
  businessDivision: '',
  productCode: '',
  productName: '',
  productModel: '',
  productSpec: '',
  productAttr: '',
  annualUsage: null,
  remark: '',
  coefficient: '',
  annualUsageSourceType: '',
  annualUsageSourceBatchNo: '',
  annualUsageOaNo: '',
  annualUsageOaLineId: '',
  originalAnnualUsage: null,
})

const tableRows = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑产品属性' : '新增产品属性',
)

const importIssues = computed(() => {
  const errors = (importResult.value?.errorMessages || []).map((message) => ({
    type: '错误',
    message,
  }))
  const warnings = [
    ...localImportWarnings.value,
    ...(importResult.value?.warnings || []),
  ].map((message) => ({
    type: '风险',
    message,
  }))
  return [...errors, ...warnings]
})

const sourceLabels = {
  TECH_IMPORT: '技术导入',
  MANUAL: '手工维护',
  OA_QUOTE_USAGE: 'OA报价',
}

const sourceText = (value) => sourceLabels[value] || value || '-'

const displayBusinessDivision = (row) => row.businessDivision || row.level1Name || '-'
const displayProductCode = (row) => row.productCode || row.parentCode || '-'
const displayProductName = (row) => row.productName || row.parentName || '-'
const displayProductModel = (row) => row.productModel || row.parentModel || '-'
const displayProductSpec = (row) => row.productSpec || row.parentSpec || '-'

const buildParams = () => ({
  propertyYear: filters.value.propertyYear ? Number(filters.value.propertyYear) : undefined,
  businessDivision: filters.value.businessDivision.trim(),
  productCode: filters.value.productCode.trim(),
  productName: filters.value.productName.trim(),
  productAttr: filters.value.productAttr.trim(),
  attrSourceType: filters.value.attrSourceType,
  annualUsageSourceType: filters.value.annualUsageSourceType,
})

const fetchList = async () => {
  if (!filters.value.propertyYear) {
    tableRows.value = []
    ElMessage.warning('年度必选')
    return
  }
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

const onFilterYearChange = () => {
  importYear.value = filters.value.propertyYear || currentYear()
  fetchList()
}

const resetFilters = () => {
  filters.value = {
    propertyYear: currentYear(),
    businessDivision: '',
    productCode: '',
    productName: '',
    productAttr: '',
    attrSourceType: '',
    annualUsageSourceType: '',
  }
  importYear.value = filters.value.propertyYear
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    propertyYear: filters.value.propertyYear || currentYear(),
    businessDivision: '',
    productCode: '',
    productName: '',
    productModel: '',
    productSpec: '',
    productAttr: '',
    annualUsage: null,
    remark: '',
    coefficient: '1.0000',
    annualUsageSourceType: '',
    annualUsageSourceBatchNo: '',
    annualUsageOaNo: '',
    annualUsageOaLineId: '',
    originalAnnualUsage: null,
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    propertyYear: row.propertyYear ? String(row.propertyYear) : currentYear(),
    businessDivision: row.businessDivision ?? row.level1Name ?? '',
    productCode: row.productCode ?? row.parentCode ?? '',
    productName: row.productName ?? row.parentName ?? '',
    productModel: row.productModel ?? row.parentModel ?? '',
    productSpec: row.productSpec ?? row.parentSpec ?? '',
    productAttr: row.productAttr ?? '',
    annualUsage: row.annualUsage ?? null,
    remark: row.remark ?? '',
    coefficient: row.coefficient ?? '1.0000',
    annualUsageSourceType: row.annualUsageSourceType ?? '',
    annualUsageSourceBatchNo: row.annualUsageSourceBatchNo ?? '',
    annualUsageOaNo: row.annualUsageOaNo ?? '',
    annualUsageOaLineId: row.annualUsageOaLineId ?? '',
    originalAnnualUsage: row.annualUsage ?? null,
  }
  dialogVisible.value = true
}

const hasAnnualUsage = (value) =>
  value !== undefined && value !== null && String(value).trim() !== ''

const sameNumberValue = (left, right) => {
  if (!hasAnnualUsage(left) && !hasAnnualUsage(right)) return true
  return Number(left) === Number(right)
}

const submitRow = async () => {
  if (
    !formModel.value.propertyYear ||
    !formModel.value.businessDivision ||
    !formModel.value.productCode ||
    !formModel.value.productAttr
  ) {
    ElMessage.warning('年度、事业部、产品料号、产品属性必填')
    return
  }
  const annualUsageChanged = !sameNumberValue(
    formModel.value.annualUsage,
    formModel.value.originalAnnualUsage,
  )
  const annualUsageSourceType = annualUsageChanged
    ? 'MANUAL'
    : formModel.value.annualUsageSourceType || (hasAnnualUsage(formModel.value.annualUsage) ? 'MANUAL' : '')
  const payload = {
    propertyYear: Number(formModel.value.propertyYear),
    businessDivision: formModel.value.businessDivision,
    productCode: formModel.value.productCode,
    productName: formModel.value.productName,
    productModel: formModel.value.productModel,
    productSpec: formModel.value.productSpec,
    productAttr: formModel.value.productAttr,
    annualUsage: hasAnnualUsage(formModel.value.annualUsage)
      ? Number(formModel.value.annualUsage)
      : null,
    remark: formModel.value.remark,
    level1Code: formModel.value.businessDivision,
    level1Name: formModel.value.businessDivision,
    parentCode: formModel.value.productCode,
    parentName: formModel.value.productName,
    parentSpec: formModel.value.productSpec,
    parentModel: formModel.value.productModel,
    period: `${formModel.value.propertyYear}-01`,
    annualUsageSourceType,
    annualUsageSourceBatchNo: annualUsageChanged
      ? ''
      : formModel.value.annualUsageSourceBatchNo,
    annualUsageOaNo: annualUsageChanged ? '' : formModel.value.annualUsageOaNo,
    annualUsageOaLineId: annualUsageChanged ? '' : formModel.value.annualUsageOaLineId,
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
    .replace(/[（）()，,；;_/\\-]/g, '')
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

const openImportDialog = () => {
  importYear.value = filters.value.propertyYear || currentYear()
  importFile.value = null
  importResult.value = null
  localImportWarnings.value = []
  importDialogVisible.value = true
}

const handleImportFileChange = (uploadFile) => {
  importFile.value = uploadFile.raw || null
  importResult.value = null
  localImportWarnings.value = []
}

const handleImportFileRemove = () => {
  importFile.value = null
}

const headerAliases = {
  level1Code: ['一级编码'],
  businessDivision: ['事业部', '一级编码名称', '生产事业部'],
  productCode: ['产品料号', '父件编码', '物料编码', '料号'],
  productName: ['产品名称', '父件名称', '物料名称', '品名', '品名描述'],
  productSpec: ['产品规格', '父件规格', '规格'],
  productModel: ['产品型号', '父件型号', '型号', '主花型号'],
  propertyYear: ['年度', '年份'],
  period: ['期间', '月份'],
  productAttr: ['产品属性'],
  annualUsage: ['预计年用量', '年用量'],
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

const findHeader = (rows) => {
  const maxScanRow = Math.min(rows.length, 20)
  let best = { start: -1, end: -1, count: 0, fields: {} }
  for (let start = 0; start < maxScanRow; start += 1) {
    for (let span = 1; span <= 3 && start + span <= rows.length; span += 1) {
      const fields = {}
      const maxColumns = Math.max(
        ...rows.slice(start, start + span).map((row) => row.length),
        0,
      )
      for (let column = 0; column < maxColumns; column += 1) {
        const combined = rows
          .slice(start, start + span)
          .map((row) => row[column])
          .filter((cell) => String(cell || '').trim())
          .join('')
        const field = resolveHeaderField(combined)
        if (field && fields[field] === undefined) {
          fields[field] = column
        }
      }
      const count = Object.keys(fields).length
      if (count > best.count) {
        best = { start, end: start + span - 1, count, fields }
      }
    }
  }
  return best.count >= 3 ? best : { start: -1, end: -1, count: 0, fields: {} }
}

const parseNumber = (raw) => {
  if (raw === undefined || raw === null) return null
  const text = String(raw).trim().replace(/,/g, '')
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

const parseYear = (raw) => {
  if (raw === undefined || raw === null) return null
  const match = String(raw).match(/\d{4}/)
  return match ? Number(match[0]) : null
}

const cellText = (row, index) => {
  if (index === undefined || index === null) return ''
  return String(row[index] || '').trim()
}

const isImportRowEmpty = (row) =>
  !row.productCode &&
  !row.productName &&
  !row.productModel &&
  !row.productSpec &&
  !row.productAttr &&
  row.annualUsage === null

const parseImportRows = (rows) => {
  const header = findHeader(rows)
  if (header.start === -1) {
    return {
      rows: [],
      warnings: [],
      errors: ['未找到表头，请确认Excel格式是否正确'],
    }
  }
  const requiredFields = ['productAttr']
  const requiredLabels = {
    productAttr: '产品属性',
  }
  const missing = requiredFields.filter((field) => header.fields[field] === undefined)
  if (missing.length > 0) {
    return {
      rows: [],
      warnings: [],
      errors: [`缺少表头：${missing.map((field) => requiredLabels[field] || field).join('、')}`],
    }
  }
  const warnings = []
  const errors = []
  const parsedRows = []
  rows.slice(header.end + 1).forEach((sourceRow, offset) => {
    const excelRowNo = header.end + offset + 2
    const item = {
      level1Code: cellText(sourceRow, header.fields.level1Code),
      level1Name: cellText(sourceRow, header.fields.businessDivision),
      businessDivision: cellText(sourceRow, header.fields.businessDivision),
      parentCode: cellText(sourceRow, header.fields.productCode),
      productCode: cellText(sourceRow, header.fields.productCode),
      parentName: cellText(sourceRow, header.fields.productName),
      productName: cellText(sourceRow, header.fields.productName),
      parentSpec: cellText(sourceRow, header.fields.productSpec),
      productSpec: cellText(sourceRow, header.fields.productSpec),
      parentModel: cellText(sourceRow, header.fields.productModel),
      productModel: cellText(sourceRow, header.fields.productModel),
      period: formatPeriod(cellText(sourceRow, header.fields.period)),
      propertyYear: parseYear(cellText(sourceRow, header.fields.propertyYear)),
      productAttr: cellText(sourceRow, header.fields.productAttr),
      annualUsage:
        header.fields.annualUsage === undefined
          ? null
          : parseNumber(sourceRow[header.fields.annualUsage]),
      remark: cellText(sourceRow, header.fields.remark),
    }
    if (isImportRowEmpty(item)) {
      return
    }
    if (!item.productAttr) {
      errors.push(`Excel第${excelRowNo}行缺产品属性`)
      return
    }
    if (!item.productCode) {
      errors.push(`Excel第${excelRowNo}行缺产品料号`)
      return
    }
    parsedRows.push(item)
  })
  return { rows: parsedRows, warnings, errors }
}

const submitImport = async () => {
  const rawFile = importFile.value
  if (!importYear.value) {
    ElMessage.warning('请先选择导入年度')
    return
  }
  if (!rawFile) {
    ElMessage.warning('请先选择导入文件')
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
    const parsed = parseImportRows(rows)
    localImportWarnings.value = parsed.warnings
    if (parsed.errors.length > 0) {
      importResult.value = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: parsed.errors.length,
        risks: parsed.warnings.length,
        errorMessages: parsed.errors,
        warnings: [],
      }
      ElMessage.error(parsed.errors[0])
      return
    }
    const dataRows = parsed.rows
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importProductProperties({
      propertyYear: importYear.value ? Number(importYear.value) : undefined,
      rows: dataRows,
    })
    importResult.value = {
      ...result,
      risks: (result?.risks || 0) + localImportWarnings.value.length,
    }
    const imported = (result?.inserted || 0) + (result?.updated || 0)
    const riskText = importResult.value?.risks ? `，风险${importResult.value.risks}条` : ''
    ElMessage.success(`已处理${imported}条产品属性${riskText}`)
    filters.value.propertyYear = importYear.value
    fetchList()
    if (result?.errors) {
      ElMessage.warning(`导入完成但存在错误：${result.errors}条`)
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
  align-items: center;
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

.filter-form :deep(.el-select),
.filter-form :deep(.el-date-editor) {
  width: 240px;
}

.filter-form-actions {
  margin-left: auto;
}

.property-form :deep(.el-input),
.property-form :deep(.el-date-editor),
.property-form :deep(.el-input-number) {
  width: 100%;
}

.import-form :deep(.el-date-editor) {
  width: 220px;
}

.upload-field {
  width: 100%;
}

.upload-text {
  color: #1f2a37;
  font-size: 14px;
  line-height: 88px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.import-result {
  margin-top: 12px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.result-grid > div {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
}

.result-grid span {
  color: #6b7280;
  display: block;
  font-size: 12px;
}

.result-grid strong {
  color: #111827;
  font-size: 18px;
  line-height: 24px;
}

.issue-table {
  width: 100%;
}

@media (max-width: 760px) {
  .filter-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .filter-actions,
  .form-grid {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
