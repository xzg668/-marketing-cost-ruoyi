<template>
  <div class="fixed-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">固定价</div>
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
          <el-input v-model="filters.materialCode" placeholder="1008000300944" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="filters.supplierCode" placeholder="1004" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="orgCode" label="组织" width="80" />
        <el-table-column prop="sourceName" label="来源" width="100" />
        <el-table-column prop="supplierName" label="供应商名称" width="160" />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" />
        <el-table-column prop="purchaseClass" label="采购分类" width="120" />
        <el-table-column prop="materialName" label="物料名称" min-width="140" />
        <el-table-column prop="materialCode" label="物料代码" width="160" />
        <el-table-column prop="specModel" label="规格型号" width="140" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="formulaExpr" label="联动公式" min-width="160" />
        <el-table-column prop="blankWeight" label="下料重" width="100" />
        <el-table-column prop="netWeight" label="净重" width="100" />
        <el-table-column prop="processFee" label="加工费" width="100" />
        <el-table-column prop="agentFee" label="代理费" width="100" />
        <el-table-column prop="fixedPrice" label="单价" width="100" />
        <el-table-column label="是否含税" width="100">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column prop="effectiveTo" label="失效日期" width="120" />
        <el-table-column prop="orderType" label="订单类型" width="120" />
        <el-table-column prop="quota" label="配额" width="100" />
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
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="组织">
          <el-input v-model="formModel.orgCode" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.sourceName" />
        </el-form-item>
        <el-form-item label="供应商名称">
          <el-input v-model="formModel.supplierName" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="formModel.supplierCode" />
        </el-form-item>
        <el-form-item label="采购分类">
          <el-input v-model="formModel.purchaseClass" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" />
        </el-form-item>
        <el-form-item label="联动公式">
          <el-input v-model="formModel.formulaExpr" />
        </el-form-item>
        <el-form-item label="下料重">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="加工费">
          <el-input v-model="formModel.processFee" />
        </el-form-item>
        <el-form-item label="代理费">
          <el-input v-model="formModel.agentFee" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.fixedPrice" />
        </el-form-item>
        <el-form-item label="是否含税">
          <el-select v-model="formModel.taxIncluded" placeholder="含税">
            <el-option label="含税" :value="true" />
            <el-option label="未税" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-input v-model="formModel.orderType" />
        </el-form-item>
        <el-form-item label="配额">
          <el-input v-model="formModel.quota" />
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
  fetchFixedItems,
  importFixedItems,
  createFixedItem,
  updateFixedItem,
  deleteFixedItem,
} from '../api/priceFixedItems'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
  supplierCode: '',
})

const formModel = ref({
  orgCode: '',
  sourceName: '',
  supplierName: '',
  supplierCode: '',
  purchaseClass: '',
  materialName: '',
  materialCode: '',
  specModel: '',
  unit: '',
  formulaExpr: '',
  blankWeight: '',
  netWeight: '',
  processFee: '',
  agentFee: '',
  fixedPrice: '',
  taxIncluded: true,
  effectiveFrom: '',
  effectiveTo: '',
  orderType: '',
  quota: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑固定价' : '新增固定价',
)

const buildParams = () => ({
  materialCode: filters.value.materialCode.trim(),
  supplierCode: filters.value.supplierCode.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchFixedItems(buildParams())
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
    materialCode: '',
    supplierCode: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    orgCode: '',
    sourceName: '',
    supplierName: '',
    supplierCode: '',
    purchaseClass: '',
    materialName: '',
    materialCode: '',
    specModel: '',
    unit: '',
    formulaExpr: '',
    blankWeight: '',
    netWeight: '',
    processFee: '',
    agentFee: '',
    fixedPrice: '',
    taxIncluded: true,
    effectiveFrom: '',
    effectiveTo: '',
    orderType: '',
    quota: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    orgCode: row.orgCode ?? '',
    sourceName: row.sourceName ?? '',
    supplierName: row.supplierName ?? '',
    supplierCode: row.supplierCode ?? '',
    purchaseClass: row.purchaseClass ?? '',
    materialName: row.materialName ?? '',
    materialCode: row.materialCode ?? '',
    specModel: row.specModel ?? '',
    unit: row.unit ?? '',
    formulaExpr: row.formulaExpr ?? '',
    blankWeight: row.blankWeight ?? '',
    netWeight: row.netWeight ?? '',
    processFee: row.processFee ?? '',
    agentFee: row.agentFee ?? '',
    fixedPrice: row.fixedPrice ?? '',
    taxIncluded: row.taxIncluded === null ? true : !!row.taxIncluded,
    effectiveFrom: row.effectiveFrom ?? '',
    effectiveTo: row.effectiveTo ?? '',
    orderType: row.orderType ?? '',
    quota: row.quota ?? '',
  }
  dialogVisible.value = true
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
  const match = text.match(/(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return text.replace(/\//g, '-')
}

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
  if (['1', 'true', 'yes', 'y', '是', '含税'].includes(text)) {
    return true
  }
  if (['0', 'false', 'no', 'n', '否', '未税'].includes(text)) {
    return false
  }
  return null
}

const submitRow = async () => {
  if (!formModel.value.materialCode || formModel.value.fixedPrice === '') {
    ElMessage.warning('物料代码和单价必填')
    return
  }
  const payload = {
    orgCode: formModel.value.orgCode,
    sourceName: formModel.value.sourceName,
    supplierName: formModel.value.supplierName,
    supplierCode: formModel.value.supplierCode,
    purchaseClass: formModel.value.purchaseClass,
    materialName: formModel.value.materialName,
    materialCode: formModel.value.materialCode,
    specModel: formModel.value.specModel,
    unit: formModel.value.unit,
    formulaExpr: formModel.value.formulaExpr,
    blankWeight: parseNumber(formModel.value.blankWeight),
    netWeight: parseNumber(formModel.value.netWeight),
    processFee: parseNumber(formModel.value.processFee),
    agentFee: parseNumber(formModel.value.agentFee),
    fixedPrice: parseNumber(formModel.value.fixedPrice),
    taxIncluded: formModel.value.taxIncluded,
    effectiveFrom: formModel.value.effectiveFrom || null,
    effectiveTo: formModel.value.effectiveTo || null,
    orderType: formModel.value.orderType,
    quota: parseNumber(formModel.value.quota),
  }
  try {
    if (editingId.value) {
      await updateFixedItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createFixedItem(payload)
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
    await deleteFixedItem(row.id)
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
      orgCode: ['组织'],
      sourceName: ['来源'],
      supplierName: ['供应商名称'],
      supplierCode: ['供应商代码'],
      purchaseClass: ['采购分类'],
      materialName: ['物料名称'],
      materialCode: ['物料代码', '物料编码'],
      specModel: ['规格型号'],
      unit: ['单位'],
      formulaExpr: ['联动公式'],
      blankWeight: ['下料重', '下料量'],
      netWeight: ['净重'],
      processFee: ['加工费'],
      agentFee: ['代理费'],
      fixedPrice: ['单价', '固定价'],
      taxIncluded: ['是否含税'],
      effectiveFrom: ['生效日期'],
      effectiveTo: ['失效日期'],
      orderType: ['订单类型'],
      quota: ['配额'],
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
    const requiredFields = ['materialCode', 'fixedPrice']
    const requiredLabels = {
      materialCode: '物料代码',
      fixedPrice: '单价',
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
        orgCode: String(row[fieldIndex.orgCode] || '').trim(),
        sourceName: String(row[fieldIndex.sourceName] || '').trim(),
        supplierName: String(row[fieldIndex.supplierName] || '').trim(),
        supplierCode: String(row[fieldIndex.supplierCode] || '').trim(),
        purchaseClass: String(row[fieldIndex.purchaseClass] || '').trim(),
        materialName: String(row[fieldIndex.materialName] || '').trim(),
        materialCode: String(row[fieldIndex.materialCode] || '').trim(),
        specModel: String(row[fieldIndex.specModel] || '').trim(),
        unit: String(row[fieldIndex.unit] || '').trim(),
        formulaExpr: String(row[fieldIndex.formulaExpr] || '').trim(),
        blankWeight: parseNumber(row[fieldIndex.blankWeight]),
        netWeight: parseNumber(row[fieldIndex.netWeight]),
        processFee: parseNumber(row[fieldIndex.processFee]),
        agentFee: parseNumber(row[fieldIndex.agentFee]),
        fixedPrice: parseNumber(row[fieldIndex.fixedPrice]),
        taxIncluded: parseBoolean(row[fieldIndex.taxIncluded]),
        effectiveFrom: normalizeDate(row[fieldIndex.effectiveFrom]) || null,
        effectiveTo: normalizeDate(row[fieldIndex.effectiveTo]) || null,
        orderType: String(row[fieldIndex.orderType] || '').trim(),
        quota: parseNumber(row[fieldIndex.quota]),
      }))
      .filter((row) => row.materialCode && row.fixedPrice !== null)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const result = await importFixedItems({ rows: dataRows })
    const imported = Array.isArray(result) ? result.length : dataRows.length
    ElMessage.success(`已导入${imported}条固定价`)
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
.fixed-page {
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
