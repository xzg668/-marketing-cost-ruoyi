<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">工资成本表</div>
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
        <el-form-item label="物料编码">
          <el-input v-model="filters.materialCode" placeholder="1008900031271" />
        </el-form-item>
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
        <el-table-column prop="materialCode" label="物料编码" width="150" />
        <el-table-column prop="productName" label="产品名称" min-width="140" />
        <el-table-column prop="spec" label="规格" min-width="140" />
        <el-table-column prop="model" label="型号" min-width="140" />
        <el-table-column prop="refMaterialCode" label="参考料号" width="140" />
        <el-table-column prop="directLaborCost" label="直接人工成本" width="140" />
        <el-table-column prop="indirectLaborCost" label="辅助人工成本" width="140" />
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="businessUnit" label="生产事业部" width="140" />
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
          <el-input
            v-model="formModel.refMaterialCode"
            class="ref-input"
            placeholder="点击选择参考料号"
            readonly
            clearable
            @click="openRefSelector"
          >
            <template #append>
              <el-button @click="openRefSelector">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="直接人工成本" required>
          <el-input v-model="formModel.directLaborCost" />
        </el-form-item>
        <el-form-item label="辅助人工成本" required>
          <el-input v-model="formModel.indirectLaborCost" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.source" />
        </el-form-item>
        <el-form-item label="生产事业部">
          <el-input v-model="formModel.businessUnit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="refSelectorVisible"
      title="选择参考料号"
      width="860px"
    >
      <div class="selector-filter">
        <el-form label-position="top" class="selector-form">
          <div class="selector-grid">
            <el-form-item label="物料编码">
              <el-input
                v-model="refSelectorFilters.materialCode"
                placeholder="输入物料编码"
                clearable
              />
            </el-form-item>
            <el-form-item label="事业部">
              <el-input
                v-model="refSelectorFilters.businessUnit"
                placeholder="输入事业部"
                clearable
              />
            </el-form-item>
          </div>
        </el-form>
        <div class="selector-actions">
          <el-button type="primary" @click="applyRefSelectorFilters">查询</el-button>
          <el-button @click="resetRefSelectorFilters">重置</el-button>
        </div>
      </div>
      <el-table :data="refSelectorRows" stripe v-loading="refSelectorLoading" max-height="420">
        <el-table-column prop="materialCode" label="物料编码" width="160" />
        <el-table-column prop="productName" label="产品名称" min-width="160" />
        <el-table-column prop="spec" label="规格" min-width="160" />
        <el-table-column prop="model" label="型号" min-width="160" />
        <el-table-column prop="businessUnit" label="事业部" width="140" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="selectRefMaterial(row)">
              选择
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无可选料号" />
        </template>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchSalaryCosts,
  importSalaryCosts,
  createSalaryCost,
  updateSalaryCost,
  deleteSalaryCost,
} from '../api/salaryCosts'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const refSelectorVisible = ref(false)
const refSelectorLoading = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
  businessUnit: '',
})

const formModel = ref({
  materialCode: '',
  productName: '',
  spec: '',
  model: '',
  refMaterialCode: '',
  directLaborCost: '',
  indirectLaborCost: '',
  source: '',
  businessUnit: '',
})

const tableRows = ref([])
const refSelectorRows = ref([])

const refSelectorFilters = ref({
  materialCode: '',
  businessUnit: '',
})

const dialogTitle = computed(() =>
  editingId.value ? '编辑工资成本' : '新增工资成本',
)

const buildParams = () => ({
  materialCode: filters.value.materialCode.trim(),
  businessUnit: filters.value.businessUnit.trim(),
})

const buildRefSelectorParams = () => ({
  materialCode: refSelectorFilters.value.materialCode.trim(),
  businessUnit: refSelectorFilters.value.businessUnit.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchSalaryCosts(buildParams())
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
    materialCode: '',
    businessUnit: '',
  }
  applyFilters()
}

const hasValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== ''

const fetchRefSelectorRows = async () => {
  refSelectorLoading.value = true
  try {
    const data = await fetchSalaryCosts(buildRefSelectorParams())
    const rows = Array.isArray(data?.list) ? data.list : []
    const uniqueRows = []
    const seenMaterialCodes = new Set()
    rows.forEach((row) => {
      const materialCode = String(row?.materialCode || '').trim()
      const hasDirectLaborCost = hasValue(row?.directLaborCost)
      const hasIndirectLaborCost = hasValue(row?.indirectLaborCost)
      if (
        !materialCode ||
        !hasDirectLaborCost ||
        !hasIndirectLaborCost ||
        seenMaterialCodes.has(materialCode)
      ) {
        return
      }
      seenMaterialCodes.add(materialCode)
      uniqueRows.push(row)
    })
    refSelectorRows.value = uniqueRows
  } catch (error) {
    refSelectorRows.value = []
    ElMessage.error(error?.message || '加载参考料号失败')
  } finally {
    refSelectorLoading.value = false
  }
}

const openRefSelector = async () => {
  refSelectorVisible.value = true
  await fetchRefSelectorRows()
}

const applyRefSelectorFilters = () => {
  fetchRefSelectorRows()
}

const resetRefSelectorFilters = () => {
  refSelectorFilters.value = {
    materialCode: '',
    businessUnit: '',
  }
  fetchRefSelectorRows()
}

const trimText = (value) => String(value ?? '').trim()
const toFormNumberText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

const selectRefMaterial = (row) => {
  const materialCode = trimText(row?.materialCode)
  const directLaborCost = toFormNumberText(row?.directLaborCost)
  const indirectLaborCost = toFormNumberText(row?.indirectLaborCost)

  formModel.value.refMaterialCode = materialCode
  formModel.value.directLaborCost = directLaborCost
  formModel.value.indirectLaborCost = indirectLaborCost

  refSelectorVisible.value = false
  ElMessage.success('已带入参考料号及人工成本')
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    materialCode: '',
    productName: '',
    spec: '',
    model: '',
    refMaterialCode: '',
    directLaborCost: '',
    indirectLaborCost: '',
    source: '',
    businessUnit: '',
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
    directLaborCost: row.directLaborCost ?? '',
    indirectLaborCost: row.indirectLaborCost ?? '',
    source: row.source ?? '',
    businessUnit: row.businessUnit ?? '',
  }
  dialogVisible.value = true
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

const submitRow = async () => {
  if (
    !formModel.value.materialCode ||
    !String(formModel.value.directLaborCost).trim() ||
    !String(formModel.value.indirectLaborCost).trim()
  ) {
    ElMessage.warning('物料编码、人工成本必填')
    return
  }
  const payload = {
    materialCode: formModel.value.materialCode,
    productName: formModel.value.productName,
    spec: formModel.value.spec,
    model: formModel.value.model,
    refMaterialCode: formModel.value.refMaterialCode,
    directLaborCost: parseNumber(formModel.value.directLaborCost),
    indirectLaborCost: parseNumber(formModel.value.indirectLaborCost),
    source: formModel.value.source,
    businessUnit: formModel.value.businessUnit,
  }
  try {
    if (editingId.value) {
      await updateSalaryCost(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createSalaryCost(payload)
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
    await deleteSalaryCost(row.id)
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
      materialCode: ['物料编码', '物料代码', '料号'],
      productName: ['产品名称', '名称'],
      spec: ['规格'],
      model: ['型号'],
      refMaterialCode: ['参考料号', '参考料编码'],
      directLaborCost: ['直接人工成本', '直接人工'],
      indirectLaborCost: ['辅助人工成本', '辅助人工'],
      source: ['来源'],
      businessUnit: ['生产事业部', '事业部'],
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
    const requiredFields = ['materialCode', 'directLaborCost', 'indirectLaborCost']
    const requiredLabels = {
      materialCode: '物料编码',
      directLaborCost: '直接人工成本',
      indirectLaborCost: '辅助人工成本',
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
        directLaborCost: parseNumber(row[fieldIndex.directLaborCost]),
        indirectLaborCost: parseNumber(row[fieldIndex.indirectLaborCost]),
        source: String(row[fieldIndex.source] || '').trim(),
        businessUnit: String(row[fieldIndex.businessUnit] || '').trim(),
      }))
      .filter(
        (row) =>
          row.materialCode &&
          row.directLaborCost !== null &&
          row.indirectLaborCost !== null,
      )
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importSalaryCosts({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条工资成本`)
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

.ref-input :deep(.el-input__inner) {
  cursor: pointer;
}

.selector-filter {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.selector-form {
  flex: 1;
  min-width: 480px;
}

.selector-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 0 16px;
}

.selector-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.selector-form :deep(.el-form-item__label) {
  line-height: 1;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 8px;
}

.selector-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 10px;
}

@media (max-width: 900px) {
  .selector-form {
    min-width: 100%;
  }

  .selector-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .selector-actions {
    width: 100%;
    padding-bottom: 0;
  }
}
</style>
