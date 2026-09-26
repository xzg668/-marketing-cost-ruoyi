<template>
  <section class="product-workbench" aria-label="产品补录资料">
    <header class="workbench-header">
      <div><h2>补录资料</h2><p v-if="task">{{ task.oaNo }} · {{ task.accountingMonth }}</p></div>
      <el-button :disabled="busy" @click="close">返回列表</el-button>
    </header>
    <el-skeleton v-if="loading && !task" :rows="8" animated />
    <el-result v-else-if="!task" icon="warning" title="暂时无法查看补录任务"><template #extra><el-button @click="load">重新加载</el-button></template></el-result>
    <template v-else>
      <el-alert v-if="readOnly" title="仅查看已提交资料；尚未提交的内容仍为待处理。" type="info" :closable="false" />
        <main class="product-editor" v-loading="loading">
          <template v-if="product">
            <div class="product-heading"><h3>当前产品：{{ product.materialNo || product.sourceModel }}</h3><el-button link type="primary" :disabled="busy" @click="refresh">刷新资料</el-button></div>
            <el-alert v-for="person in workflow?.participants?.filter(person => person.returnReason && ['OPEN', 'RETURN_PENDING'].includes(person.status)) || []"
              :key="person.recipientId" :title="`${person.status === 'RETURN_PENDING' ? '退回待确认' : '修改要求'}：${person.returnReason}`" type="warning" :closable="false" show-icon />
            <p class="scope">{{ readOnly ? '查看板块' : '需要补录' }}：{{ scope.map(moduleName).join('、') || '暂无可查看内容' }} · {{ task.accountingMonth }}</p>
            <nav class="module-tabs" aria-label="补录模块">
              <el-button v-for="code in scope" :key="code" :type="activeModule === code ? 'primary' : ''" @click="selectModule(code)">{{ moduleName(code) }} · {{ moduleStatus(code) }}</el-button>
            </nav>
            <el-table v-if="validation && !validation.valid" :data="validation.issues" size="small" border>
              <el-table-column label="板块" width="130"><template #default="{ row }">{{ moduleName(row.moduleType) }}</template></el-table-column>
              <el-table-column prop="lineNo" label="明细行" width="80" /><el-table-column prop="message" label="问题" />
              <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click="selectModule(row.moduleType)">去处理</el-button></template></el-table-column>
            </el-table>
            <component v-if="showForm" :is="formComponent" ref="formRef" :key="formKey" v-bind="formProps" @dirty="dirty = $event" @busy="busy = $event" @saved="afterSave" />
            <el-empty v-else :description="readOnly ? '本板块尚未提交，当前为待处理。' : '请选择本人需要补录的板块。'" />
            <details v-if="workflow && !submissionId" class="progress-details"><summary>查看办理进度</summary><TechnicalDataApprovalPanel :task="task" :workflow="workflow" @changed="load" /></details>
            <div v-if="editable" class="product-actions">
              <span>{{ dirty ? '当前修改尚未保存' : '草稿仅本人可见' }}</span>
              <el-button :loading="busy" :disabled="!formRef?.canSave" @click="save(false)">保存草稿</el-button>
              <el-button type="primary" :loading="busy" :disabled="!formRef?.canSave" @click="save(true)">保存并继续</el-button>
            </div>
          </template>
        </main>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchTechnicalDataTask, fetchTechnicalDataWorkflow, fetchTechnicalDataDocument, validateTechnicalDataTask } from '../../api/technicalDataTasks'
import { moduleName, findModule, canEditTechnicalModule } from '../../utils/technicalDataWorkbench'
import { showErrorOnce } from '../../utils/errorHandler'
import TechnicalDataApprovalPanel from './TechnicalDataApprovalPanel.vue'
import TechnicalDataProfileForm from './TechnicalDataProfileForm.vue'
import TechnicalDataDrawingForm from './TechnicalDataDrawingForm.vue'
import TechnicalDataManufacturingForm from './TechnicalDataManufacturingForm.vue'
import TechnicalDataPackageForm from './TechnicalDataPackageForm.vue'
import TechnicalDataAuxiliaryForm from './TechnicalDataAuxiliaryForm.vue'
import TechnicalDataSolderForm from './TechnicalDataSolderForm.vue'
import TechnicalDataSalaryForm from './TechnicalDataSalaryForm.vue'
import TechnicalDataNetLossForm from './TechnicalDataNetLossForm.vue'
import TechnicalDataPriceForm from './TechnicalDataPriceForm.vue'


const props = defineProps({ taskId: { type: [String, Number], required: true }, submissionId: String })
const emit = defineEmits(['close', 'changed'])
const route = useRoute()
const task = ref(null), workflow = ref(null), loading = ref(false), busy = ref(false), dirty = ref(false)
const activeModule = ref(''), revision = ref(0), formRef = ref(null), validation = ref(null)
let generation = 0
const readOnly = computed(() => Boolean(props.submissionId || workflow.value?.canViewSupplementOverview))
const product = computed(() => task.value?.products[0])
const scope = computed(() => product.value?.modules.filter(module => module.required
  && (readOnly.value || workflow.value?.assignedModules.includes(module.moduleType))).map(module => module.moduleType) || [])
const activeState = computed(() => findModule(product.value, activeModule.value))
const editable = computed(() => !readOnly.value && canEditTechnicalModule(workflow.value, activeModule.value, activeState.value?.moduleStatus))
const showForm = computed(() => !!formComponent.value && !!activeState.value && (!readOnly.value || activeState.value.currentVersionId != null))
const forms = { PROFILE: TechnicalDataProfileForm, DRAWING_BOM: TechnicalDataDrawingForm, MANUFACTURING: TechnicalDataManufacturingForm, PACKAGE: TechnicalDataPackageForm, AUXILIARY: TechnicalDataAuxiliaryForm, SOLDER: TechnicalDataSolderForm, SALARY: TechnicalDataSalaryForm, NET_LOSS: TechnicalDataNetLossForm, PRICE: TechnicalDataPriceForm }
const formComponent = computed(() => forms[activeModule.value])
const formProps = computed(() => activeModule.value === 'PROFILE' ? { product: product.value, editable: editable.value }
  : { productId: product.value.id, editable: editable.value, oaNo: task.value.oaNo,
    versionId: readOnly.value ? activeState.value?.currentVersionId : undefined })
const formKey = computed(() => `${props.taskId}:${activeModule.value}:${props.submissionId || ''}:${revision.value}`)

function moduleStatus(code) { return ({ PENDING: '待处理', EDITING: '填写中', READY: '已补齐', FROZEN: '待确认', SUBMITTED: '已提交', APPROVED: '已通过', RETURNED: '待修改' })[findModule(product.value, code)?.moduleStatus] || '待处理' }
async function load() {
  const current = ++generation
  loading.value = true
  try {
    const [detail, state] = await Promise.all([fetchTechnicalDataTask(props.taskId), fetchTechnicalDataWorkflow(props.taskId)])
    let visibleTask = detail
    if (props.submissionId) {
      const snapshot = await fetchTechnicalDataDocument(detail.oaFormId, props.submissionId)
      visibleTask = snapshot.tasks.find(item => String(item.id) === String(props.taskId))
      if (!visibleTask) throw new Error('本次提交中没有该产品')
    }
    if (current !== generation) return
    task.value = visibleTask; workflow.value = state
    if (!scope.value.includes(activeModule.value)) activeModule.value = scope.value.includes(route.query.module) ? route.query.module : scope.value[0]
  } catch (cause) {
    if (current === generation) { task.value = null; workflow.value = null; showErrorOnce(cause, '任务加载失败') }
  } finally { if (current === generation) loading.value = false }
}
async function mayLeave() {
  if (busy.value) { ElMessage.warning('正在保存，请稍候'); return false }
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前修改尚未保存，是否放弃这些修改？', '未保存的资料', { confirmButtonText: '放弃修改', cancelButtonText: '继续填写', type: 'warning' })
    dirty.value = false; return true
  } catch { return false }
}
async function selectModule(code) { if (code !== activeModule.value && await mayLeave()) { activeModule.value = code; validation.value = null } }
async function refresh() { if (await mayLeave()) { await load(); revision.value++ } }
async function save(next) { if (editable.value && !busy.value) await formRef.value?.save(next) }
async function afterSave({ next = false } = {}) {
  dirty.value = false
  await load(); emit('changed')
  if (!next || !task.value) return
  const incomplete = scope.value.find(code => !['READY', 'SUBMITTED', 'APPROVED'].includes(findModule(product.value, code)?.moduleStatus))
  if (incomplete) { activeModule.value = incomplete; return }
  try {
    validation.value = await validateTechnicalDataTask(task.value.id)
    if (!validation.value.valid) return
    ElMessage.success('本产品已补齐，请在列表确认提交本单资料')
    emit('close')
  } catch (cause) { showErrorOnce(cause, '资料已保存，完整性检查失败，请重试') }
}
async function close() { if (await mayLeave()) emit('close') }
function beforeUnload(event) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeRouteLeave(mayLeave)
onBeforeRouteUpdate(mayLeave)
onBeforeUnmount(() => { generation++; window.removeEventListener('beforeunload', beforeUnload) })
watch(() => [props.taskId, props.submissionId], () => { task.value = null; workflow.value = null; activeModule.value = ''; dirty.value = false; load() }, { immediate: true })
</script>

<style scoped>
.product-workbench { display:flex; flex-direction:column; height:calc(100vh - 80px); min-height:480px; background:#fff; color:#344256; }
.workbench-header,.product-heading,.product-actions { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.workbench-header { padding:18px 24px; border-bottom:1px solid #e6eaf0; } h2,h3 { margin:0; } h2 { font-size:21px; } h3 { font-size:17px; }
.workbench-header p,.scope { font-size:13px; color:#748196; margin:10px 0 0; }
.product-editor { flex:1; min-height:0; overflow:auto; padding:24px; }
.module-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0; } .module-tabs .el-button { margin:0; }
.product-actions { justify-content:flex-end; padding:20px 0 0; } .product-actions span { margin-right:auto; color:#7c899c; font-size:12px; }
</style>
