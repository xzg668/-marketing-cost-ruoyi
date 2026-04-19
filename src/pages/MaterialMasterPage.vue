<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">物料表</div>
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
        <el-form-item label="物料名称">
          <el-input v-model="filters.materialName" placeholder="热力膨胀阀" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="filters.itemSpec" placeholder="RFG-K19060A-3128" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="filters.itemModel" placeholder="RFGK19E-6.0A-3128" />
        </el-form-item>
        <el-form-item label="图号">
          <el-input v-model="filters.drawingNo" placeholder="RFG-K19060A-3128" />
        </el-form-item>
        <el-form-item label="形态属性">
          <el-select v-model="filters.shapeAttr" placeholder="全部">
            <el-option label="全部" value="" />
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item label="材质">
          <el-input v-model="filters.material" placeholder="SUS301" />
        </el-form-item>
        <el-form-item label="事业部">
          <el-input v-model="filters.bizUnit" placeholder="四通阀事业部" />
        </el-form-item>
        <el-form-item label="生产部门">
          <el-input v-model="filters.productionDept" placeholder="商用四通阀" />
        </el-form-item>
        <el-form-item label="生产车间">
          <el-input v-model="filters.productionWorkshop" placeholder="装配一车间" />
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
        <el-table-column prop="materialName" label="物料名称" min-width="160" />
        <el-table-column prop="itemSpec" label="规格" min-width="160" />
        <el-table-column prop="itemModel" label="型号" min-width="160" />
        <el-table-column prop="drawingNo" label="图号" min-width="160" />
        <el-table-column prop="shapeAttr" label="物料形态属性" width="120" />
        <el-table-column prop="material" label="材质" width="120" />
        <el-table-column prop="theoreticalWeightG" label="理论重量g" width="120" />
        <el-table-column prop="netWeightKg" label="单品净重kg" width="120" />
        <el-table-column prop="bizUnit" label="属生产事业" width="140" />
        <el-table-column prop="productionDept" label="生产部门" width="140" />
        <el-table-column prop="productionWorkshop" label="生产车间" width="140" />
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
      <el-form :model="formModel" label-width="100px">
        <el-form-item label="物料编码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="formModel.itemSpec" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="formModel.itemModel" />
        </el-form-item>
        <el-form-item label="图号">
          <el-input v-model="formModel.drawingNo" />
        </el-form-item>
        <el-form-item label="形态属性">
          <el-select v-model="formModel.shapeAttr" placeholder="制造件">
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item label="材质">
          <el-input v-model="formModel.material" />
        </el-form-item>
        <el-form-item label="理论重量g">
          <el-input v-model="formModel.theoreticalWeightG" />
        </el-form-item>
        <el-form-item label="单品净重kg">
          <el-input v-model="formModel.netWeightKg" />
        </el-form-item>
        <el-form-item label="属生产事业">
          <el-input v-model="formModel.bizUnit" />
        </el-form-item>
        <el-form-item label="生产部门">
          <el-input v-model="formModel.productionDept" />
        </el-form-item>
        <el-form-item label="生产车间">
          <el-input v-model="formModel.productionWorkshop" />
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
  fetchMaterialMasters,
  importMaterialMasters,
  createMaterialMaster,
  updateMaterialMaster,
  deleteMaterialMaster,
} from '../api/materialMasters'

const loading = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
  materialName: '',
  itemSpec: '',
  itemModel: '',
  drawingNo: '',
  shapeAttr: '',
  material: '',
  bizUnit: '',
  productionDept: '',
  productionWorkshop: '',
})

const formModel = ref({
  materialCode: '',
  materialName: '',
  itemSpec: '',
  itemModel: '',
  drawingNo: '',
  shapeAttr: '制造件',
  material: '',
  theoreticalWeightG: '',
  netWeightKg: '',
  bizUnit: '',
  productionDept: '',
  productionWorkshop: '',
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const dialogTitle = computed(() =>
  editingId.value ? '编辑物料' : '新增物料',
)

const buildParams = () => ({
  materialCode: filters.value.materialCode.trim(),
  materialName: filters.value.materialName.trim(),
  spec: filters.value.itemSpec.trim(),
  model: filters.value.itemModel.trim(),
  drawingNo: filters.value.drawingNo.trim(),
  shapeAttr: filters.value.shapeAttr,
  material: filters.value.material.trim(),
  bizUnit: filters.value.bizUnit.trim(),
  productionDept: filters.value.productionDept.trim(),
  productionWorkshop: filters.value.productionWorkshop.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchMaterialMasters(buildParams())
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
    materialName: '',
    itemSpec: '',
    itemModel: '',
    drawingNo: '',
    shapeAttr: '',
    material: '',
    bizUnit: '',
    productionDept: '',
    productionWorkshop: '',
  }
  applyFilters()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    materialCode: '',
    materialName: '',
    itemSpec: '',
    itemModel: '',
    drawingNo: '',
    shapeAttr: '制造件',
    material: '',
    theoreticalWeightG: '',
    netWeightKg: '',
    bizUnit: '',
    productionDept: '',
    productionWorkshop: '',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    materialCode: row.materialCode,
    materialName: row.materialName,
    itemSpec: row.itemSpec,
    itemModel: row.itemModel,
    drawingNo: row.drawingNo,
    shapeAttr: row.shapeAttr || '制造件',
    material: row.material ?? '',
    theoreticalWeightG: row.theoreticalWeightG ?? '',
    netWeightKg: row.netWeightKg ?? '',
    bizUnit: row.bizUnit ?? '',
    productionDept: row.productionDept ?? '',
    productionWorkshop: row.productionWorkshop ?? '',
  }
  dialogVisible.value = true
}

const submitRow = async () => {
  if (!formModel.value.materialCode || !formModel.value.materialName) {
    ElMessage.warning('物料编码和物料名称必填')
    return
  }
  const payload = {
    ...formModel.value,
    theoreticalWeightG: parseNumber(formModel.value.theoreticalWeightG),
    netWeightKg: parseNumber(formModel.value.netWeightKg),
  }
  try {
    if (editingId.value) {
      await updateMaterialMaster(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createMaterialMaster(payload)
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
    await deleteMaterialMaster(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
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
      物料编码: 'materialCode',
      物料名称: 'materialName',
      规格: 'itemSpec',
      型号: 'itemModel',
      图号: 'drawingNo',
      物料形态属性: 'shapeAttr',
      材质: 'material',
      理论重量g: 'theoreticalWeightG',
      单品净重kg: 'netWeightKg',
      属生产事业: 'bizUnit',
      属生产事业部: 'bizUnit',
      生产部门: 'productionDept',
      生产车间: 'productionWorkshop',
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
      .map((row) => ({
        materialCode: String(row[fieldIndex.materialCode] || '').trim(),
        materialName: String(row[fieldIndex.materialName] || '').trim(),
        itemSpec: String(row[fieldIndex.itemSpec] || '').trim(),
        itemModel: String(row[fieldIndex.itemModel] || '').trim(),
        drawingNo: String(row[fieldIndex.drawingNo] || '').trim(),
        shapeAttr: String(row[fieldIndex.shapeAttr] || '').trim(),
        material: String(row[fieldIndex.material] || '').trim(),
        theoreticalWeightG: parseNumber(row[fieldIndex.theoreticalWeightG]),
        netWeightKg: parseNumber(row[fieldIndex.netWeightKg]),
        bizUnit: String(row[fieldIndex.bizUnit] || '').trim(),
        productionDept: String(row[fieldIndex.productionDept] || '').trim(),
        productionWorkshop: String(row[fieldIndex.productionWorkshop] || '').trim(),
      }))
      .filter((row) => row.materialCode && row.materialName)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const importRows = dataRows.map((row) => ({
      ...row,
      source: 'import',
    }))
    const result = await importMaterialMasters({ rows: importRows })
    const imported = Array.isArray(result) ? result.length : importRows.length
    ElMessage.success(`已导入${imported}条物料`)
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
