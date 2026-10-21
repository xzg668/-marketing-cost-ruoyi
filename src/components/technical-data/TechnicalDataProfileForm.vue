<template>
  <el-form label-position="top" class="profile-form" :disabled="!editable || busy" @submit.prevent>
    <h3>产品信息</h3>
    <div class="profile-fields">
    <el-form-item label="产品型号"><el-input :model-value="product.sourceModel || ''" disabled placeholder="来源未提供" /></el-form-item>
    <el-form-item label="产品属性" required>
      <el-select v-model="draft.productProperty" aria-label="产品属性" placeholder="请选择产品属性"><el-option v-for="option in PRODUCT_PROPERTY_OPTIONS" :key="option" :label="option" :value="option" /></el-select>
    </el-form-item>
    <el-form-item v-if="plate && plate.mode !== 'HIDDEN'" label="板片材质" :required="plate.mode === 'MANUAL_REQUIRED' && editable">
      <el-select v-model="plate.value" aria-label="板片材质" placeholder="请选择板片材质" :disabled="plate.mode === 'CONFIG_LOCKED' || plate.historical" clearable>
        <el-option v-for="option in PLATE_MATERIAL_OPTIONS" :key="option" :label="option" :value="option" />
      </el-select>
      <small class="material-note">{{ plate.historical ? '本版本保存的板片材质' : plate.mode === 'CONFIG_LOCKED' ? '由型号—板片材质对照表自动带出，不可修改' : '请按实际产品选择板片材质' }}</small>
    </el-form-item>
    <el-form-item label="是否含新增工装模具认证费" required>
      <el-select v-model="draft.hasAdditionalFees" aria-label="是否含新增费用" placeholder="请选择">
        <el-option label="是" :value="true" /><el-option label="否" :value="false" />
      </el-select>
    </el-form-item>
    </div>
    <p v-if="!plate && ['FROZEN', 'SUBMITTED', 'APPROVED'].includes(draft.versionStatus)" class="material-note">该历史版本未采集板片材质。</p>
    <el-alert v-if="plate?.sourceChanged" title="板片材质来源已变化，请核对当前判定后重新保存。" type="warning" :closable="false" show-icon>
      <p>上次保存：{{ plate.saved?.material || '不适用' }}。当前{{ plate.mode === 'HIDDEN' ? '无需填写此项' : plate.mode === 'CONFIG_LOCKED' ? '按对照表自动带出' : '需选择板片材质' }}。</p>
    </el-alert>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div v-if="needsRefresh && editable" class="material-refresh">
      <span>其他未保存内容已保留。</span>
      <el-button :loading="refreshing" :disabled="busy" @click="refreshMaterial">重新读取材质判定</el-button>
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
import { saveTechnicalDataProfile, fetchTechnicalDataTask } from '../../api/technicalDataTasks'
import { PRODUCT_PROPERTY_OPTIONS, validateTechnicalDataProfile } from '../../utils/technicalDataWorkbench'
import { PLATE_MATERIAL_OPTIONS, profileDraft, validatePlateMaterial, refreshProfilePlateMaterial } from '../../utils/technicalDataPlateMaterial'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ product: { type: Object, required: true }, taskId: { type: [String, Number], required: true }, editable: Boolean })
const fees = [{ field: 'unitMouldFee', label: '模具费' }, { field: 'unitToolingFee', label: '工装费' }, { field: 'unitCertificationFee', label: '认证费' }]
const emit = defineEmits(['saved', 'dirty', 'busy'])
const draft = ref({})
const original = ref('{}')
const saving = ref(false)
const refreshing = ref(false), needsRefresh = ref(false), error = ref('')
const busy = computed(() => saving.value || refreshing.value)
const plate = computed(() => draft.value.plateMaterial)
const dirty = computed(() => JSON.stringify(draft.value) !== original.value)
let productId = null
watch(() => props.product, product => {
  if (productId === product.id && dirty.value) return
  productId = product.id
  draft.value = profileDraft(product.profile)
  original.value = JSON.stringify(draft.value)
  needsRefresh.value = false; error.value = ''
}, { immediate: true })
watch(dirty, value => emit('dirty', value))
watch(busy, value => emit('busy', value), { flush: 'sync' })
async function refreshMaterial() {
  if (busy.value || !props.editable) return
  refreshing.value = true; error.value = ''
  try {
    const task = await fetchTechnicalDataTask(props.taskId)
    const latest = task.products.find(product => String(product.id) === String(props.product.id))
    if (!latest) throw new Error('当前产品已不在任务中，请刷新任务；本次输入已保留')
    draft.value = refreshProfilePlateMaterial(draft.value, latest.profile)
    needsRefresh.value = false
    ElMessage.success('已重新读取材质判定，其他输入已保留，请核对后保存')
  } catch (failure) { error.value = failure.message }
  finally { refreshing.value = false }
}
async function save(next) {
  if (!props.editable || busy.value || needsRefresh.value) return
  const message = validateTechnicalDataProfile(draft.value) || validatePlateMaterial(plate.value)
  if (message) return ElMessage.warning(message)
  saving.value = true; error.value = ''
  try {
    draft.value = profileDraft(await saveTechnicalDataProfile(props.product.id, draft.value))
    original.value = JSON.stringify(draft.value)
    emit('dirty', false)
    ElMessage.success('产品资料已保存')
    emit('saved', { next })
  } catch (failure) {
    error.value = failure.message
    needsRefresh.value = Number(failure.resultCode) === 409
    showErrorOnce(failure, '产品资料未保存，请核对提示后重试')
  }
  finally { saving.value = false }
}

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => props.editable && !busy.value && !needsRefresh.value) })
</script>

<style scoped>
.profile-form h3 { margin: 4px 0 16px; font-size: 14px; font-weight: 600; }
.profile-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-bottom: 18px; }
.profile-fields .el-form-item { margin-bottom: 18px; } .profile-fields .el-select { width: 100%; }
.fee-note { margin: 0 0 14px; color: #758298; font-size: 12px; line-height: 1.7; }
.material-note { color: #758298; font-size: 12px; line-height: 1.7; }
.material-refresh { display: flex; align-items: center; gap: 16px; margin: 12px 0; font-size: 13px; }
.profile-form > .el-alert { margin-bottom: 14px; }
.fee-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fee-table th, .fee-table td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
.fee-table th { background: #f5f7fa; color: #66758c; font-weight: 500; } .fee-table td:first-child { width: 120px; } .required { color: #e05a54; }
@media(max-width: 600px) { .profile-fields { grid-template-columns: 1fr; } }
</style>
