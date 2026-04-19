<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">BOM明细录入</div>
        <div class="header-actions">
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
      <div class="filter-content">
        <el-form label-position="top" class="filter-form">
          <div class="filter-grid">
            <el-form-item label="BOM编码">
              <el-input
                v-model="filters.bomCode"
                placeholder="BOM0001"
                clearable
              />
            </el-form-item>
            <el-form-item label="料号">
              <el-input
                v-model="filters.itemCode"
                placeholder="物料编码"
                clearable
              />
            </el-form-item>
            <el-form-item label="父件">
              <el-input
                v-model="filters.parentCode"
                placeholder="父件料号"
                clearable
              />
            </el-form-item>
            <el-form-item label="层级">
              <el-input
                v-model="filters.bomLevel"
                placeholder="1"
                clearable
              />
            </el-form-item>
            <el-form-item label="形态属性">
              <el-select v-model="filters.shapeAttr" placeholder="全部" clearable>
                <el-option label="全部" value="" />
                <el-option label="制造件" value="制造件" />
                <el-option label="采购件" value="采购件" />
              </el-select>
            </el-form-item>
          </div>
        </el-form>
        <div class="filter-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="result-header">
        <div class="result-title">BOM明细列表</div>
        <el-tag size="small" type="success">共 {{ total }} 条</el-tag>
      </div>
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="bomCode" label="BOM编码" min-width="220" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetails(row)">
              查看
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

    <el-drawer
      v-model="detailDrawerVisible"
      :title="detailTitle"
      size="75%"
      destroy-on-close
    >
      <div class="detail-meta" v-if="activeSummary">
        <el-tag type="info">BOM编码：{{ activeSummary.bomCode }}</el-tag>
        <el-tag>明细数：{{ activeSummary.detailCount || 0 }}</el-tag>
      </div>
      <el-table :data="detailRows" stripe v-loading="detailLoading">
        <el-table-column prop="itemCode" label="料号" width="160" />
        <el-table-column prop="itemName" label="名称" min-width="160" />
        <el-table-column prop="itemSpec" label="规格" min-width="160" />
        <el-table-column prop="itemModel" label="型号" min-width="160" />
        <el-table-column prop="bomLevel" label="层级" width="90" />
        <el-table-column prop="parentCode" label="父件" width="160" />
        <el-table-column prop="shapeAttr" label="形态属性" width="100" />
        <el-table-column prop="bomQty" label="BOM用量" width="120" />
        <el-table-column prop="material" label="材质" width="120" />
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
          <el-empty description="暂无明细数据" />
        </template>
      </el-table>
    </el-drawer>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="料号">
          <el-input v-model="formModel.itemCode" />
        </el-form-item>
        <el-form-item label="BOM编码">
          <el-input v-model="formModel.bomCode" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="formModel.itemName" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formModel.itemSpec" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="formModel.itemModel" />
        </el-form-item>
        <el-form-item label="层级">
          <el-input v-model="formModel.bomLevel" />
        </el-form-item>
        <el-form-item label="父件">
          <el-input v-model="formModel.parentCode" />
        </el-form-item>
        <el-form-item label="形态属性">
          <el-select v-model="formModel.shapeAttr" placeholder="制造件">
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item label="BOM用量">
          <el-input v-model="formModel.bomQty" placeholder="1" />
        </el-form-item>
        <el-form-item label="材质">
          <el-input v-model="formModel.material" placeholder="SUS301" />
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
  fetchBomManualItemDetails,
  fetchBomManualSummaryItems,
  importBomManualItems,
  createBomManualItem,
  updateBomManualItem,
  deleteBomManualItem,
} from '../api/bomManualItems'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  bomCode: '',
  itemCode: '',
  parentCode: '',
  bomLevel: '',
  shapeAttr: '',
})

const formModel = ref({
  bomCode: '',
  itemCode: '',
  itemName: '',
  itemSpec: '',
  itemModel: '',
  bomLevel: '',
  parentCode: '',
  shapeAttr: '制造件',
  bomQty: '',
  material: '',
})

const tableRows = ref([])
const total = ref(0)
const detailDrawerVisible = ref(false)
const detailLoading = ref(false)
const detailRows = ref([])
const activeSummary = ref(null)

const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑BOM明细' : '新增BOM明细',
)

const detailTitle = computed(() => {
  if (!activeSummary.value) {
    return 'BOM明细'
  }
  return `BOM明细 - ${activeSummary.value.bomCode || ''}`
})

const parseLevel = (value) => {
  const level = Number(value)
  return !Number.isNaN(level) && String(value).trim() !== '' ? level : undefined
}

const buildParams = () => ({
  bomCode: filters.value.bomCode.trim(),
  itemCode: filters.value.itemCode.trim(),
  parentCode: filters.value.parentCode.trim(),
  level: parseLevel(filters.value.bomLevel),
  shapeAttr: filters.value.shapeAttr,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const buildDetailParams = (bomCode) => ({
  bomCode,
  itemCode: filters.value.itemCode.trim(),
  parentCode: filters.value.parentCode.trim(),
  level: parseLevel(filters.value.bomLevel),
  shapeAttr: filters.value.shapeAttr,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchBomManualSummaryItems(buildParams())
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

const fetchDetailList = async (summaryRow) => {
  if (!summaryRow?.bomCode) {
    detailRows.value = []
    return
  }
  detailLoading.value = true
  try {
    const data = await fetchBomManualItemDetails(buildDetailParams(summaryRow.bomCode))
    detailRows.value = Array.isArray(data) ? data : []
  } catch (error) {
    detailRows.value = []
    ElMessage.error(error?.message || '加载明细失败')
  } finally {
    detailLoading.value = false
  }
}

const openDetails = async (row) => {
  activeSummary.value = row
  detailRows.value = []
  detailDrawerVisible.value = true
  await fetchDetailList(row)
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

watch(detailDrawerVisible, (value) => {
  if (!value) {
    detailRows.value = []
    activeSummary.value = null
  }
})

const applyFilters = async () => {
  if (currentPage.value === 1) {
    await fetchList()
  } else {
    currentPage.value = 1
    return
  }
  if (detailDrawerVisible.value && activeSummary.value?.bomCode) {
    const stillExists = tableRows.value.some((row) => row.bomCode === activeSummary.value.bomCode)
    if (stillExists) {
      await fetchDetailList(activeSummary.value)
    } else {
      detailDrawerVisible.value = false
    }
  }
}

const resetFilters = () => {
  filters.value = {
    bomCode: '',
    itemCode: '',
    parentCode: '',
    bomLevel: '',
    shapeAttr: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    bomCode: activeSummary.value?.bomCode || filters.value.bomCode || '',
    itemCode: '',
    itemName: '',
    itemSpec: '',
    itemModel: '',
    bomLevel: '',
    parentCode: '',
    shapeAttr: '制造件',
    bomQty: '',
    material: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    bomCode: row.bomCode,
    itemCode: row.itemCode,
    itemName: row.itemName,
    itemSpec: row.itemSpec,
    itemModel: row.itemModel,
    bomLevel: row.bomLevel,
    parentCode: row.parentCode,
    shapeAttr: row.shapeAttr,
    bomQty: row.bomQty ?? '',
    material: row.material ?? '',
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
  const level = Number(formModel.value.bomLevel)
  if (
    !formModel.value.bomCode ||
    !formModel.value.itemCode ||
    Number.isNaN(level)
  ) {
    ElMessage.warning('BOM编码、料号和层级必填')
    return
  }
  const payload = {
    ...formModel.value,
    bomLevel: level,
    bomQty: parseNumber(formModel.value.bomQty),
    material: formModel.value.material,
  }
  try {
    if (editingId.value) {
      await updateBomManualItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createBomManualItem(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await applyFilters()
    if (detailDrawerVisible.value && activeSummary.value?.bomCode) {
      await fetchDetailList(activeSummary.value)
    }
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
    await deleteBomManualItem(row.id)
    ElMessage.success('已删除')
    await applyFilters()
    if (detailDrawerVisible.value && activeSummary.value?.bomCode) {
      await fetchDetailList(activeSummary.value)
    }
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
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const headerMap = {
      BOM编码: 'bomCode',
      料号: 'itemCode',
      名称: 'itemName',
      规格: 'itemSpec',
      型号: 'itemModel',
      层级: 'bomLevel',
      父件: 'parentCode',
      形态属性: 'shapeAttr',
      BOM用量: 'bomQty',
      材质: 'material',
    }
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => headerMap[String(cell).trim()]),
    )
    if (headerIndex === -1) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = headerMap[String(cell).trim()]
      if (field) {
        fieldIndex[field] = index
      }
    })
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => {
        const bomCode = String(row[fieldIndex.bomCode] || '').trim()
        const itemCode = String(row[fieldIndex.itemCode] || '').trim()
        const bomLevel = parseNumber(row[fieldIndex.bomLevel])
        return {
          bomCode,
          itemCode,
          itemName: String(row[fieldIndex.itemName] || '').trim(),
          itemSpec: String(row[fieldIndex.itemSpec] || '').trim(),
          itemModel: String(row[fieldIndex.itemModel] || '').trim(),
          bomLevel,
          parentCode: String(row[fieldIndex.parentCode] || '').trim(),
          shapeAttr: String(row[fieldIndex.shapeAttr] || '').trim() || '制造件',
          bomQty: parseNumber(row[fieldIndex.bomQty]),
          material: String(row[fieldIndex.material] || '').trim(),
        }
      })
      .filter((row) => row.itemCode && row.bomCode)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const importRows = dataRows
      .filter((row) => row.bomLevel !== null)
      .map((row) => ({
        ...row,
        source: 'import',
      }))
    if (importRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const uniqueRows = []
    const seenKeys = new Set()
    importRows.forEach((row) => {
      const key = `${row.bomCode}__${row.itemCode}__${row.bomLevel}`
      if (seenKeys.has(key)) {
        return
      }
      seenKeys.add(key)
      uniqueRows.push(row)
    })
    const result = await importBomManualItems({ rows: uniqueRows })
    const imported = Array.isArray(result) ? result.length : uniqueRows.length
    ElMessage.success(`已导入${imported}条BOM明细`)
    await applyFilters()
    if (detailDrawerVisible.value && activeSummary.value?.bomCode) {
      await fetchDetailList(activeSummary.value)
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
  border-radius: 8px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a37;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-form {
  flex: 1;
  min-width: 760px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(150px, 1fr));
  gap: 0 16px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.filter-form :deep(.el-form-item__label) {
  line-height: 1;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 8px;
}

.filter-form :deep(.el-input),
.filter-form :deep(.el-select) {
  width: 100%;
}

.filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
  align-self: flex-end;
  padding-bottom: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

@media (max-width: 1400px) {
  .filter-form {
    min-width: 100%;
  }

  .filter-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .filter-actions {
    width: 100%;
    justify-content: flex-start;
    padding-bottom: 0;
  }
}
</style>
