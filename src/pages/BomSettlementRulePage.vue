<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="page-head">
        <div class="page-title">BOM 结算规则</div>
        <div class="page-actions">
          <el-button type="primary" @click="openCreate">新增规则</el-button>
          <el-button :loading="loading" @click="reload">刷新</el-button>
        </div>
      </div>

      <el-form :inline="true" class="filter-form">
        <el-form-item label="启用状态">
          <el-select v-model="filters.enabled" placeholder="全部" clearable style="width: 130px" @change="reload">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则分类">
          <el-select v-model="filters.ruleCategory" placeholder="全部" clearable style="width: 190px" @change="reload">
            <el-option v-for="opt in SETTLEMENT_RULE_CATEGORY_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算动作">
          <el-select v-model="filters.settlementAction" placeholder="全部" clearable style="width: 180px" @change="reload">
            <el-option v-for="opt in SETTLEMENT_ACTION_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading" stripe border>
        <el-table-column prop="priority" label="优先级" width="90" align="right" />
        <el-table-column prop="ruleCode" label="规则编码" min-width="210" show-overflow-tooltip />
        <el-table-column prop="ruleName" label="规则名称" min-width="190" show-overflow-tooltip />
        <el-table-column label="规则分类" width="170">
          <template #default="{ row }">
            <el-tag size="small">{{ optionLabel(SETTLEMENT_RULE_CATEGORY_OPTIONS, row.ruleCategory) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结算动作" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="row.settlementAction === 'EXCLUDE' ? 'danger' : 'warning'">
              {{ optionLabel(SETTLEMENT_ACTION_OPTIONS, row.settlementAction) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结算行类型" width="170">
          <template #default="{ row }">
            {{ optionLabel(SETTLEMENT_ROW_TYPE_OPTIONS, row.settlementRowType) }}
          </template>
        </el-table-column>
        <el-table-column label="子件引用" width="140">
          <template #default="{ row }">{{ row.subRefType || '-' }}</template>
        </el-table-column>
        <el-table-column label="子树取价" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.markSubtreeCostRequired === 1" size="small" type="warning">是</el-tag>
            <span v-else class="dim">否</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === 1 ? 'success' : 'info'" size="small">
              {{ row.enabled === 1 ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生效期" width="200">
          <template #default="{ row }">
            <span class="dim">{{ row.effectiveFrom || '-' }} ~ {{ row.effectiveTo || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="businessUnitType" label="业务单元" width="120" show-overflow-tooltip />
        <el-table-column prop="bomPurpose" label="BOM 目的" width="120" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="onToggle(row)">{{ row.enabled === 1 ? '停用' : '启用' }}</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无 BOM 结算规则" />
        </template>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑 BOM 结算规则' : '新增 BOM 结算规则'"
      width="720px"
      :close-on-click-modal="false"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="130px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="规则编码" prop="ruleCode">
              <el-input v-model="form.ruleCode" :disabled="Boolean(editingId)" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="form.ruleName" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="规则分类" prop="ruleCategory">
              <el-select v-model="form.ruleCategory" style="width: 100%">
                <el-option v-for="opt in SETTLEMENT_RULE_CATEGORY_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结算动作" prop="settlementAction">
              <el-select v-model="form.settlementAction" style="width: 100%">
                <el-option v-for="opt in SETTLEMENT_ACTION_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="结算行类型" prop="settlementRowType">
              <el-select v-model="form.settlementRowType" filterable allow-create style="width: 100%">
                <el-option v-for="opt in SETTLEMENT_ROW_TYPE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="子件引用类型">
              <el-input v-model="form.subRefType" placeholder="SPECIAL_ROLLUP_CHILD" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="优先级" prop="priority">
              <el-input-number v-model="form.priority" :min="1" :max="9999" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="启用">
              <el-switch v-model="form.enabledBool" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="子树取价">
              <el-switch v-model="form.markSubtreeCostRequiredBool" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="业务单元">
              <el-input v-model="form.businessUnitType" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="BOM 目的">
              <el-input v-model="form.bomPurpose" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效日期">
              <el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" clearable style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="失效日期">
              <el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" clearable style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="匹配条件 JSON" prop="matchConditionJson">
          <el-input v-model="form.matchConditionJson" type="textarea" :rows="6" spellcheck="false" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  SETTLEMENT_ACTION_OPTIONS,
  SETTLEMENT_ROW_TYPE_OPTIONS,
  SETTLEMENT_RULE_CATEGORY_OPTIONS,
  createSettlementRule,
  deleteSettlementRule,
  listSettlementRules,
  toggleSettlementRule,
  updateSettlementRule,
} from '../api/bom'

const filters = reactive({ enabled: undefined, ruleCategory: '', settlementAction: '' })
const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const emptyForm = () => ({
  ruleCode: '',
  ruleName: '',
  ruleCategory: 'SPECIAL_PURCHASE_ROLLUP',
  settlementAction: 'ROLLUP_TO_PARENT',
  settlementRowType: 'SPECIAL_ROLLUP_PARENT',
  subRefType: 'SPECIAL_ROLLUP_CHILD',
  matchConditionJson: '{"nodeConditions":[]}',
  markSubtreeCostRequiredBool: true,
  priority: 100,
  enabledBool: true,
  businessUnitType: '',
  bomPurpose: '',
  effectiveFrom: '',
  effectiveTo: '',
  remark: '',
})

const form = reactive(emptyForm())

const formRules = {
  ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  ruleCategory: [{ required: true, message: '请选择规则分类', trigger: 'change' }],
  settlementAction: [{ required: true, message: '请选择结算动作', trigger: 'change' }],
  settlementRowType: [{ required: true, message: '请选择结算行类型', trigger: 'change' }],
  priority: [{ required: true, message: '请输入优先级', trigger: 'change' }],
  matchConditionJson: [
    { required: true, message: '请输入匹配条件 JSON', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        try {
          JSON.parse(value)
          callback()
        } catch (_err) {
          callback(new Error('JSON 格式不正确'))
        }
      },
      trigger: 'blur',
    },
  ],
}

const optionLabel = (options, value) => options.find((item) => item.value === value)?.label || value || '-'

const reload = async () => {
  loading.value = true
  try {
    rows.value = await listSettlementRules({
      enabled: filters.enabled,
      ruleCategory: filters.ruleCategory,
      settlementAction: filters.settlementAction,
    })
  } catch (error) {
    rows.value = []
    ElMessage.error(error?.message || '查询 BOM 结算规则失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, emptyForm())
  editingId.value = null
  formRef.value?.clearValidate?.()
}

const openCreate = () => {
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  resetForm()
  editingId.value = row.id
  Object.assign(form, {
    ruleCode: row.ruleCode || '',
    ruleName: row.ruleName || '',
    ruleCategory: row.ruleCategory || 'SPECIAL_PURCHASE_ROLLUP',
    settlementAction: row.settlementAction || 'ROLLUP_TO_PARENT',
    settlementRowType: row.settlementRowType || 'SPECIAL_ROLLUP_PARENT',
    subRefType: row.subRefType || '',
    matchConditionJson: row.matchConditionJson || '{"nodeConditions":[]}',
    markSubtreeCostRequiredBool: row.markSubtreeCostRequired === 1,
    priority: row.priority || 100,
    enabledBool: row.enabled === 1,
    businessUnitType: row.businessUnitType || '',
    bomPurpose: row.bomPurpose || '',
    effectiveFrom: row.effectiveFrom || '',
    effectiveTo: row.effectiveTo || '',
    remark: row.remark || '',
  })
  dialogVisible.value = true
}

const trimOrNull = (value) => {
  const text = typeof value === 'string' ? value.trim() : value
  return text === '' ? null : text
}

const buildPayload = () => ({
  ruleCode: trimOrNull(form.ruleCode),
  ruleName: trimOrNull(form.ruleName),
  ruleCategory: trimOrNull(form.ruleCategory),
  settlementAction: trimOrNull(form.settlementAction),
  settlementRowType: trimOrNull(form.settlementRowType),
  subRefType: trimOrNull(form.subRefType),
  matchConditionJson: trimOrNull(form.matchConditionJson),
  markSubtreeCostRequired: form.markSubtreeCostRequiredBool ? 1 : 0,
  priority: form.priority,
  enabled: form.enabledBool ? 1 : 0,
  businessUnitType: trimOrNull(form.businessUnitType),
  bomPurpose: trimOrNull(form.bomPurpose),
  effectiveFrom: trimOrNull(form.effectiveFrom),
  effectiveTo: trimOrNull(form.effectiveTo),
  remark: trimOrNull(form.remark),
})

const submitForm = async () => {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editingId.value) {
      await updateSettlementRule(editingId.value, buildPayload())
      ElMessage.success('BOM 结算规则已更新')
    } else {
      await createSettlementRule(buildPayload())
      ElMessage.success('BOM 结算规则已新增')
    }
    dialogVisible.value = false
    await reload()
  } catch (error) {
    ElMessage.error(error?.message || '保存 BOM 结算规则失败')
  } finally {
    saving.value = false
  }
}

const onToggle = async (row) => {
  try {
    await toggleSettlementRule(row.id)
    ElMessage.success(row.enabled === 1 ? '规则已停用' : '规则已启用')
    await reload()
  } catch (error) {
    ElMessage.error(error?.message || '切换规则状态失败')
  }
}

const onDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除规则「${row.ruleName || row.ruleCode}」？`, '删除确认', { type: 'warning' })
    await deleteSettlementRule(row.id)
    ElMessage.success('规则已删除')
    await reload()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error?.message || '删除规则失败')
  }
}

onMounted(reload)
</script>

<style scoped>
.base-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  border-radius: 8px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.page-title {
  color: #1f2a37;
  font-size: 16px;
  font-weight: 600;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-form {
  margin-bottom: -18px;
}

.dim {
  color: #8a9099;
}

@media (max-width: 760px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
