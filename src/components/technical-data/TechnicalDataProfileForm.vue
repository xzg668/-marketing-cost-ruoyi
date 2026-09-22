<template>
  <el-form label-position="top" class="profile-form" :disabled="!editable || saving" @submit.prevent>
    <h3>产品信息</h3>
    <div class="profile-fields">
    <el-form-item label="产品型号"><el-input :model-value="product.sourceModel || ''" disabled placeholder="来源未提供" /></el-form-item>
    <el-form-item label="产品属性" required>
      <el-select v-model="draft.productProperty" placeholder="请选择产品属性"><el-option v-for="option in PRODUCT_PROPERTY_OPTIONS" :key="option" :label="option" :value="option" /></el-select>
    </el-form-item>
    <el-form-item label="是否含新增工装模具认证费" required>
      <el-select v-model="draft.hasAdditionalFees" placeholder="请选择">
        <el-option label="是" :value="true" /><el-option label="否" :value="false" />
      </el-select>
    </el-form-item>
    </div>
    <h3>费用信息</h3>
    <p class="fee-note">填写本产品每件计入成本的费用，无费用填 /。选“是”时三项必填；选“否”时可留空。</p>
    <table class="fee-table"><thead><tr><th>费用项目</th><th>单件费用（元/件） / 无费用</th></tr></thead><tbody>
      <tr v-for="fee in fees" :key="fee.field"><td>{{ fee.label }}<span v-if="draft.hasAdditionalFees" class="required"> *</span></td><td><el-input v-model="draft[fee.field]" :aria-label="fee.label" maxlength="24" placeholder="单件金额或 /" /></td></tr>
    </tbody></table>
  </el-form>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveTechnicalDataProfile } from '../../api/technicalDataTasks'
import { PRODUCT_PROPERTY_OPTIONS, validateTechnicalDataProfile } from '../../utils/technicalDataWorkbench'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ product: { type: Object, required: true }, editable: Boolean })
const fees = [{ field: 'unitMouldFee', label: '模具费' }, { field: 'unitToolingFee', label: '工装费' }, { field: 'unitCertificationFee', label: '认证费' }]
const emit = defineEmits(['saved', 'dirty', 'busy'])
const draft = ref({})
const original = ref('{}')
const saving = ref(false)
const dirty = computed(() => JSON.stringify(draft.value) !== original.value)
watch(() => props.product, product => {
  if (dirty.value) return
  draft.value = { ...product.profile }
  original.value = JSON.stringify(draft.value)
}, { immediate: true })
watch(dirty, value => emit('dirty', value))
watch(saving, value => emit('busy', value), { flush: 'sync' })
async function save(next) {
  const message = validateTechnicalDataProfile(draft.value)
  if (message) return ElMessage.warning(message)
  saving.value = true
  try {
    draft.value = await saveTechnicalDataProfile(props.product.id, draft.value)
    original.value = JSON.stringify(draft.value)
    emit('dirty', false)
    ElMessage.success('产品资料已保存')
    emit('saved', { next })
  } catch (error) { showErrorOnce(error, '产品资料未保存，请核对提示后重试') }
  finally { saving.value = false }
}

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => props.editable && !saving.value) })
</script>

<style scoped>
.profile-form h3 { margin: 4px 0 16px; font-size: 14px; font-weight: 600; }
.profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-bottom: 18px; }
.profile-fields .el-form-item { margin-bottom: 18px; } .profile-fields .el-select { width: 100%; }
.fee-note { margin: 0 0 14px; color: #758298; font-size: 12px; line-height: 1.7; }
.fee-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fee-table th, .fee-table td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
.fee-table th { background: #f5f7fa; color: #66758c; font-weight: 500; } .fee-table td:first-child { width: 120px; } .required { color: #e05a54; }
@media(max-width: 600px) { .profile-fields { grid-template-columns: 1fr; } }
</style>
