<template>
  <div class="formula-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">公式配置</div>
        <div class="filter-actions">
          <el-button type="primary" @click="openCreate">新增公式</el-button>
          <el-button @click="fetchList">刷新</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部">
            <el-option label="全部" value="" />
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
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
        <el-table-column prop="formulaName" label="公式名称" min-width="160" />
        <el-table-column label="公式表达式" min-width="360">
          <template #default="{ row }">
            <div class="expr-primary">{{ row.expr }}</div>
            <div class="expr-secondary">{{ toChineseExpr(row.expr) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
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
        <el-form-item label="公式名称">
          <el-input v-model="formModel.formulaName" placeholder="公式名称" />
        </el-form-item>
        <el-form-item label="表达式">
          <el-input
            v-model="formModel.expr"
            type="textarea"
            :rows="3"
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <el-form-item label="中文说明">
          <el-input
            :model-value="formulaPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="formModel.status">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { toChineseExpr } from '../utils/formula'
import {
  fetchFormulaList,
  createFormula,
  updateFormula,
  deleteFormula,
} from '../mock/priceLinkedSimple'

const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)

const filters = ref({
  materialCode: '',
  status: '',
})

const formModel = ref({
  materialCode: '',
  formulaName: '',
  expr: '',
  status: 'active',
})

const dialogTitle = computed(() =>
  editingId.value ? '编辑公式' : '新增公式',
)

const formulaPreview = computed(() => toChineseExpr(formModel.value.expr))

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchFormulaList({
      materialCode: filters.value.materialCode?.trim(),
      status: filters.value.status,
    })
    tableRows.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取公式失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    materialCode: '',
    status: '',
  }
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    materialCode: '',
    formulaName: '',
    expr: '',
    status: 'active',
  }
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    materialCode: row.materialCode,
    formulaName: row.formulaName,
    expr: row.expr,
    status: row.status,
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formModel.value.materialCode || !formModel.value.expr) {
    ElMessage.warning('物料代码和表达式必填')
    return
  }
  if (editingId.value) {
    await updateFormula({ id: editingId.value, ...formModel.value })
    ElMessage.success('公式已更新')
  } else {
    await createFormula(formModel.value)
    ElMessage.success('公式已新增')
  }
  dialogVisible.value = false
  fetchList()
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该公式吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteFormula(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const syncQueryFilters = () => {
  if (route.query?.materialCode) {
    filters.value.materialCode = String(route.query.materialCode)
  }
}

watch(
  () => route.query,
  () => {
    syncQueryFilters()
    fetchList()
  },
  { immediate: true },
)
</script>

<style scoped>
.formula-page {
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

.expr-primary {
  font-family: 'SFMono-Regular', Menlo, monospace;
  color: #111827;
}

.expr-secondary {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

</style>
