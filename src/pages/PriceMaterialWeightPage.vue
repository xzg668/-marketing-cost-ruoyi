<template>
  <div class="weight-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">物料重量表</div>
        <div class="filter-actions">
          <el-button type="primary" @click="openCreate">新增</el-button>
          <el-button @click="fetchList">刷新</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="materialCode" label="物料代码" width="140" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" />
        <el-table-column prop="blankWeight" label="下料重量" width="120" />
        <el-table-column prop="netWeight" label="净重" width="120" />
        <el-table-column prop="unit" label="单位" width="100" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" placeholder="物料名称" />
        </el-form-item>
        <el-form-item label="下料重量">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" placeholder="克/件" />
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
  fetchMaterialWeights,
  createMaterialWeight,
  updateMaterialWeight,
  deleteMaterialWeight,
} from '../mock/priceLinkedSimple'

const loading = ref(false)
const tableRows = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
})

const formModel = ref({
  materialCode: '',
  materialName: '',
  blankWeight: '',
  netWeight: '',
  unit: '克/件',
})

const dialogTitle = computed(() =>
  editingId.value ? '编辑物料重量' : '新增物料重量',
)

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchMaterialWeights({
      materialCode: filters.value.materialCode?.trim(),
    })
    tableRows.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取物料重量失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    materialCode: '',
  }
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    materialCode: '',
    materialName: '',
    blankWeight: '',
    netWeight: '',
    unit: '克/件',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    materialCode: row.materialCode,
    materialName: row.materialName,
    blankWeight: row.blankWeight,
    netWeight: row.netWeight,
    unit: row.unit,
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formModel.value.materialCode) {
    ElMessage.warning('物料代码必填')
    return
  }
  if (editingId.value) {
    await updateMaterialWeight({ id: editingId.value, ...formModel.value })
    ElMessage.success('物料重量已更新')
  } else {
    await createMaterialWeight(formModel.value)
    ElMessage.success('物料重量已新增')
  }
  dialogVisible.value = false
  fetchList()
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteMaterialWeight(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

onMounted(fetchList)
</script>

<style scoped>
.weight-page {
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
