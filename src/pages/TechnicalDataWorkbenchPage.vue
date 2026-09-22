<template>
  <section class="technical-data-workbench" :class="{ embedded }" aria-label="产品补录">
    <header class="editor-header">
      <div>
        <div class="editor-eyebrow"><span>补录工作台</span><el-tag v-if="task" :type="finished ? 'success' : modulePresentation(product, activeModule).type" size="small">{{ finished ? '本人资料已齐' : modulePresentation(product, activeModule).label }}</el-tag></div>
        <h2>{{ finished ? '本人资料补录完成' : moduleName(activeModule) || '补录资料' }}<span v-if="product"> · {{ product.materialNo || product.sourceModel || '本次产品' }}</span></h2>
        <p v-if="product">{{ product.productName || product.sourceModel || '来源未提供名称' }} · {{ task.accountingMonth }} · {{ task.oaNo }}</p>
      </div>
      <el-button text aria-label="关闭补录" :disabled="formBusy || submitting" @click="backToTasks">×</el-button>
    </header>
    <div v-if="product && workflow && !overview" class="guide-progress" aria-live="polite">
      <b>{{ selectedPerson?.returnReason ? `本次复核 ${reviewed.length} / ${progress.total}` : `已齐 ${progress.complete} / ${progress.total} 项` }}</b>
      <span>{{ finished ? '资料已补齐，确认后提交本人部门领导' : nextModule ? `当前：${moduleName(activeModule)} → 下一项：${moduleName(nextModule)}` : '当前为最后一项，完成后检查并提交' }}</span>
    </div>
    <div ref="bodyRef" class="editor-body">
      <el-skeleton v-if="loading && !task" :rows="8" animated />
      <el-result v-else-if="accessDenied" icon="warning" title="当前账号不能查看此补录任务" sub-title="请使用分派给本人的任务链接。" />
      <el-result v-else-if="!product || !workflow" icon="warning" title="补录资料加载失败"><template #extra><el-button @click="load">重新加载</el-button></template></el-result>
      <template v-else>
        <el-alert v-if="selectedPerson?.returnReason" :title="`退回说明：${selectedPerson.returnReason}`" type="warning" :closable="false" show-icon />
        <div v-if="finished" class="guide-complete">
          <div class="complete-mark">✓</div><h3>本次负责的资料已补齐</h3>
          <p v-if="selectedPerson">{{ selectedPerson.assigneeName }}负责的 {{ progress.total }} 项资料已检查通过，提交后交 {{ selectedPerson.leaderName }} 审批。</p>
          <p v-else>资料已保存，可返回工作台继续分派和办理。</p>
        </div>
        <details class="task-context">
          <summary>产品来源与办理范围<span>{{ scopeLabel }}</span></summary>
          <el-button link type="primary" :disabled="formBusy" @click="refresh">刷新资料</el-button>
          <el-descriptions :column="2" size="small" border class="source-info">
            <el-descriptions-item label="产品名称">{{ product.productName || '来源未提供' }}</el-descriptions-item>
            <el-descriptions-item label="产品型号">{{ product.sourceModel || '来源未提供' }}</el-descriptions-item>
            <el-descriptions-item label="来源规格">{{ product.sourceSpec || '来源未提供' }}</el-descriptions-item>
            <el-descriptions-item label="预计年用量">{{ product.annualVolume == null ? '来源未提供' : `${product.annualVolume} ${annualVolumeUnitLabel}` }}</el-descriptions-item>
          </el-descriptions>
          <div v-if="workflow.canAdminister && workflow.participants.length > 1" class="person-scope"><span>本次代办人员</span><el-select :model-value="selectedAssignee" @change="selectPerson"><el-option v-for="person in workflow.participants" :key="person.assigneeUserId" :value="person.assigneeUserId" :label="`${person.assigneeName} → ${person.leaderName}审批`" /></el-select></div>
        </details>
        <section v-if="validation && !validation.valid" class="validation-panel">
          <b>还有 {{ validation.issues.length }} 个问题，请处理后再提交</b>
          <el-table :data="validation.issues" size="small" border>
            <el-table-column label="模块" width="135"><template #default="{ row }">{{ moduleName(row.moduleType) }}</template></el-table-column>
            <el-table-column prop="lineNo" label="明细行" width="70" />
            <el-table-column prop="message" label="问题" />
            <el-table-column label="操作" width="75"><template #default="{ row }"><el-button link type="primary" @click="selectModule(row.moduleType)">去处理</el-button></template></el-table-column>
          </el-table>
        </section>
        <section v-if="!finished" class="module-form" :aria-label="`${moduleName(activeModule)}办理`">
          <p class="reason">{{ activeState?.requirementReason || '尚未取得本模块的来源检查结论' }}<span v-if="activeState?.assigneeName"> · {{ moduleOwner(activeModule) }}</span></p>
          <el-alert v-if="activeState?.sourceAvailability === 'ERROR'" title="资料查询失败，请核实来源后重新检查。" type="error" :closable="false" />
          <component v-if="formComponent && !isTechnicalModuleStatusOnly(product, activeModule)" :is="formComponent" ref="formRef" :key="formKey" v-bind="formProps" @dirty="dirty = $event" @busy="formBusy = $event" @saved="afterSave" />
          <el-empty v-else :description="unavailableMessage" />
        </section>
        <details class="module-directory">
          <summary>{{ finished ? '复核已填资料' : '查看其他模块' }}</summary>
          <nav class="module-nav" aria-label="补录模块"><button v-for="item in TECHNICAL_DATA_MODULES" :key="item.code" type="button" :disabled="isTechnicalModuleStatusOnly(product, item.code)" :class="{ active: activeModule === item.code && !finished }" @click="selectModule(item.code)"><b>{{ item.label }}</b><el-tag :type="modulePresentation(product, item.code).type" size="small">{{ modulePresentation(product, item.code).label }}</el-tag><small>{{ moduleOwner(item.code) }}</small></button></nav>
        </details>
        <el-collapse class="approval-details"><el-collapse-item title="查看办理进度与审批意见" name="approval"><technical-data-approval-panel :task="task" :workflow="workflow" @changed="load" /></el-collapse-item></el-collapse>
      </template>
    </div>
    <footer class="editor-footer">
      <span class="save-status" aria-live="polite">{{ formBusy ? '正在处理资料…' : dirty ? '有修改尚未保存' : overview ? '当前资料只读' : '已保存的资料可稍后继续办理' }}</span>
      <div class="footer-actions">
        <el-button :disabled="formBusy || submitting" @click="backToTasks">{{ overview ? '关闭' : finished ? '稍后提交' : '稍后继续' }}</el-button>
        <template v-if="product && workflow">
          <template v-if="finished">
            <el-button v-if="selectedPerson" type="primary" :loading="submitting || validating" :disabled="!selectedPerson.canSubmit" @click="submitAll">{{ selectedPerson.returnReason ? '重新提交审批' : '提交本人资料审批' }}</el-button>
          </template>
          <template v-else-if="editable">
            <el-button :disabled="!formRef?.canSave || loading" :loading="formBusy" @click="saveCurrent(false)">{{ activeModule === 'DRAWING_BOM' ? '检查并保存' : '保存草稿' }}</el-button>
            <el-button type="primary" :disabled="loading || formBusy || (!canContinueWithoutSaving && !formRef?.canSave)" :loading="validating" @click="continueEntry">{{ primaryLabel }}</el-button>
          </template>
          <el-button v-else-if="!overview" type="primary" :disabled="loading || formBusy" @click="goNext">{{ nextModule ? '继续补录下一项' : '检查并完成' }}</el-button>
          <el-button v-else-if="workflow.canViewSupplementOverview" @click="backToQuote">返回报价单</el-button>
        </template>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import TechnicalDataApprovalPanel from '../components/technical-data/TechnicalDataApprovalPanel.vue'
import TechnicalDataProfileForm from '../components/technical-data/TechnicalDataProfileForm.vue'
import TechnicalDataDrawingForm from '../components/technical-data/TechnicalDataDrawingForm.vue'
import TechnicalDataManufacturingForm from '../components/technical-data/TechnicalDataManufacturingForm.vue'
import TechnicalDataPackageForm from '../components/technical-data/TechnicalDataPackageForm.vue'
import TechnicalDataAuxiliaryForm from '../components/technical-data/TechnicalDataAuxiliaryForm.vue'
import TechnicalDataSolderForm from '../components/technical-data/TechnicalDataSolderForm.vue'
import TechnicalDataSalaryForm from '../components/technical-data/TechnicalDataSalaryForm.vue'
import TechnicalDataPriceForm from '../components/technical-data/TechnicalDataPriceForm.vue'
import TechnicalDataNetLossForm from '../components/technical-data/TechnicalDataNetLossForm.vue'
import { fetchTechnicalDataTask, fetchTechnicalDataWorkflow, submitTechnicalDataTask, validateTechnicalDataTask } from '../api/technicalDataTasks'
import { showErrorOnce } from '../utils/errorHandler'
import { TECHNICAL_DATA_MODULES, findModule, canEditTechnicalModule, moduleName, modulePresentation, isTechnicalModuleStatusOnly, nextTechnicalModule, technicalEntryProgress } from '../utils/technicalDataWorkbench'

const props = defineProps({ embedded: Boolean, taskId: [String, Number] })
const emit = defineEmits(['close', 'changed', 'width'])
const formRef = ref(null), bodyRef = ref(null), finished = ref(false), reviewed = ref([])
const route = useRoute()
const router = useRouter()
const task = ref(null)
const workflow = ref(null)
const loading = ref(false)
const accessDenied = ref(false)
const dirty = ref(false)
const formBusy = ref(false)
const validating = ref(false)
const submitting = ref(false)
const validation = ref(null)
const selectedAssignee = ref(null)
const coordinator = computed(() => Boolean(workflow.value?.canViewSupplementOverview))
const overview = computed(() => !workflow.value?.editableModules?.length)
const formWorkflow = computed(() => workflow.value)
const activeModule = ref('')
const formRevision = ref(0)
let generation = 0
const product = computed(() => task.value?.products?.[0])
const annualVolumeUnitLabel = computed(() => ({ PIECE: '只', TEN_THOUSAND_PIECES: '万只' })[product.value?.annualVolumeUnit] || '（来源未注明单位）')
const selectedPerson = computed(() => workflow.value?.participants?.find(person => person.assigneeUserId === selectedAssignee.value))
const scope = computed(() => workflow.value?.canAdminister
  ? selectedPerson.value?.moduleTypes || workflow.value.editableModules || []
  : workflow.value?.assignedModules || [])
const progress = computed(() => technicalEntryProgress(product.value, scope.value))
const scopeLabel = computed(() => overview.value ? '当前资料只读'
  : selectedPerson.value ? `${workflow.value.canAdminister ? selectedPerson.value.assigneeName + '负责' : '我负责'} ${progress.value.total} 项 · ${selectedPerson.value.leaderName}审批`
    : `本次需补 ${progress.value.total} 项`)
const activeState = computed(() => findModule(product.value, activeModule.value))
const editable = computed(() => canEditTechnicalModule(formWorkflow.value, activeModule.value, activeState.value?.moduleStatus))
const nextModule = computed(() => {
  const available = selectedPerson.value?.returnReason ? scope.value.filter(code => !reviewed.value.includes(code)) : scope.value
  return nextTechnicalModule(product.value, workflow.value, activeModule.value, available)
})
const canContinueWithoutSaving = computed(() => !dirty.value && ['READY', 'RETURNED'].includes(activeState.value?.moduleStatus))
const primaryLabel = computed(() => {
  if (activeModule.value === 'DRAWING_BOM' && !canContinueWithoutSaving.value) return '保存并检查明细表'
  if (canContinueWithoutSaving.value) return nextModule.value ? '下一项' : '完成核对'
  return nextModule.value ? '保存并下一项' : '保存并完成'
})
const formComponent = computed(() => ({ PROFILE: TechnicalDataProfileForm, DRAWING_BOM: TechnicalDataDrawingForm, MANUFACTURING: TechnicalDataManufacturingForm, PACKAGE: TechnicalDataPackageForm, AUXILIARY: TechnicalDataAuxiliaryForm, SOLDER: TechnicalDataSolderForm, SALARY: TechnicalDataSalaryForm, NET_LOSS: TechnicalDataNetLossForm, PRICE: TechnicalDataPriceForm })[activeModule.value])
const formProps = computed(() => activeModule.value === 'PROFILE' ? { product: product.value, editable: editable.value }
  : activeModule.value === 'DRAWING_BOM' ? { productId: product.value.id, editable: editable.value, oaNo: task.value.oaNo }
  : { productId: product.value.id, editable: editable.value })
const formKey = computed(() => `${task.value?.id}:${product.value?.id}:${activeModule.value}:${overview.value}:${formRevision.value}`)
const unavailableMessage = computed(() => activeState.value?.sourceAvailability === 'AVAILABLE' ? '本模块已有可用资料，无需补录。' : '本模块暂未开放办理，已填资料会保留。')
function moduleOwner(code) {
  const module = findModule(product.value, code)
  if (!module?.required) return '来源资料'
  const name = module.assigneeName || task.value.assigneeName || '尚未分派'
  const owned = workflow.value.assignedModules?.includes(code)
  const canEdit = canEditTechnicalModule(formWorkflow.value, code, module.moduleStatus)
  if (coordinator.value) return `${name}${name === '尚未分派' ? '' : '负责'} · ${canEdit ? '可补录' : '只读'}`
  return `${name}负责 · ${owned ? (canEdit ? '我负责' : '我负责／只读') : canEdit ? '可代办' : '只读'}`
}
function firstModule() {
  return nextTechnicalModule(product.value, workflow.value, null, scope.value)
    || TECHNICAL_DATA_MODULES.find(item => scope.value.includes(item.code))?.code || 'PROFILE'
}
async function load() {
  const request = ++generation
  loading.value = true
  try {
    const [data, state] = await Promise.all([fetchTechnicalDataTask(props.taskId || route.params.taskId), fetchTechnicalDataWorkflow(props.taskId || route.params.taskId)])
    if (request !== generation) return
    task.value = data
    workflow.value = state
    accessDenied.value = false
    if (!state.participants.some(person => person.assigneeUserId === selectedAssignee.value)) {
      const person = state.canAdminister ? state.participants.find(item => item.canSubmit) || state.participants[0]
        : state.participants.find(item => item.moduleTypes.some(code => state.assignedModules.includes(code)))
      selectedAssignee.value = person?.assigneeUserId ?? null
    }
    if (!activeModule.value) activeModule.value = TECHNICAL_DATA_MODULES.some(item => item.code === route.query.module) ? route.query.module : firstModule()
    followModuleAssignee(activeModule.value)
  } catch (error) {
    if (request !== generation) return
    task.value = null
    workflow.value = null
    accessDenied.value = [401, 403].includes(Number(error?.resultCode))
    if (!accessDenied.value) showErrorOnce(error, '补录工作台加载失败')
  } finally { if (request === generation) loading.value = false }
}
async function discardChanges() {
  if (submitting.value || validating.value) { ElMessage.warning('正在检查或提交资料，请稍候再切换'); return false }
  if (formBusy.value) { ElMessage.warning('正在保存资料，请稍候再切换'); return false }
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前修改尚未保存，离开后将放弃这些修改。', '未保存的资料', { confirmButtonText: '放弃修改', cancelButtonText: '继续填写', type: 'warning' })
    dirty.value = false
    return true
  } catch { return false }
}
async function selectModule(code) {
  if (!TECHNICAL_DATA_MODULES.some(item => item.code === code)) return
  if (isTechnicalModuleStatusOnly(product.value, code)) return
  if (!await discardChanges()) return
  await router.replace({ query: { ...route.query, module: code, mode: undefined } })
  finished.value = false
  activeModule.value = code
  followModuleAssignee(code)
  await nextTick()
  bodyRef.value?.scrollTo({ top: 0 })
}
function followModuleAssignee(code) {
  if (!workflow.value?.canAdminister) return
  const owner = workflow.value.participants.find(person => person.moduleTypes.includes(code))
  if (owner && selectedAssignee.value !== owner.assigneeUserId) {
    selectedAssignee.value = owner.assigneeUserId
    reviewed.value = []
    validation.value = null
  }
}
async function selectPerson(id) {
  if (!await discardChanges()) return
  selectedAssignee.value = id
  reviewed.value = []
  validation.value = null
  await selectModule(firstModule())
}
async function refresh() {
  if (!await discardChanges()) return
  await load()
  formRevision.value++
}
async function saveCurrent(next) {
  if (!editable.value || formBusy.value || !formRef.value?.canSave) return
  await formRef.value.save(next)
}
async function continueEntry() {
  if (canContinueWithoutSaving.value) await goNext()
  else await saveCurrent(true)
}
async function afterSave({ next = false } = {}) {
  dirty.value = false
  validation.value = null
  await load()
  emit('changed')
  if (next && product.value && workflow.value) await goNext()
}
async function goNext() {
  if (dirty.value) return ElMessage.warning('请先保存当前修改，再办理下一项')
  if (selectedPerson.value?.returnReason && !reviewed.value.includes(activeModule.value)) reviewed.value.push(activeModule.value)
  if (nextModule.value) return selectModule(nextModule.value)
  if (selectedPerson.value) {
    if (!(await validateAll())?.valid) { await nextTick(); bodyRef.value?.scrollTo({ top: 0 }); return }
  } else if (progress.value.remaining) {
    ElMessage.warning('还有资料未完整，请按当前模块提示补齐')
    return
  }
  finished.value = true
  await nextTick()
  bodyRef.value?.scrollTo({ top: 0 })
}
async function validateAll() {
  if (dirty.value) { ElMessage.warning('请先保存当前修改，再校验或提交'); return null }
  validating.value = true
  try {
    validation.value = await validateTechnicalDataTask(task.value.id, selectedAssignee.value)
    return validation.value
  } catch (error) { showErrorOnce(error, '资料校验失败'); return null }
  finally { validating.value = false }
}
async function submitAll() {
  if (!(await validateAll())?.valid) return
  try {
    await ElMessageBox.confirm(`将 ${selectedPerson.value.assigneeName} 负责的模块提交给 ${selectedPerson.value.leaderName} 审批，确认提交吗？`, '提交审核', { confirmButtonText: '确定提交', cancelButtonText: '取消', type: 'warning' })
  } catch { return }
  submitting.value = true
  const keyName = `technical-data-submit-key:${task.value.id}:${selectedAssignee.value}:${task.value.taskVersion}:${product.value.rowVersion}`
  let idempotencyKey = sessionStorage.getItem(keyName)
  if (!idempotencyKey) { idempotencyKey = globalThis.crypto.randomUUID(); sessionStorage.setItem(keyName, idempotencyKey) }
  try {
    const result = await submitTechnicalDataTask(task.value.id, task.value.taskVersion, product.value.rowVersion, idempotencyKey, selectedAssignee.value)
    validation.value = result.validation || validation.value
    if (!result.submissionId) return ElMessage.warning('资料未通过校验，请按问题清单修正')
    sessionStorage.removeItem(keyName)
    ElMessage.success(result.idempotentReplay ? '本次资料已经提交' : result.submitted ? '等待本人部门领导审批' : '资料已冻结，等待 OA 确认受理')
    await load()
    formRevision.value++
    finished.value = false
    emit('changed')
    if (props.embedded) emit('close')
  } catch (error) { showErrorOnce(error, '提交未完成，请查看提示后重试') }
  finally { submitting.value = false }
}
async function backToTasks() {
  if (props.embedded) { emit('close'); return }
  if (route.meta.technicalDataShortSession) { if (await discardChanges()) window.close() }
  else router.push('/collaboration/tasks')
}
function backToQuote() {
  router.push({ name: 'ingest-quote-request-detail', params: { oaNo: task.value.oaNo } })
}
function beforeUnload(event) { if (dirty.value || formBusy.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeRouteLeave(discardChanges)
onBeforeRouteUpdate(discardChanges)
watch(() => props.taskId || route.params.taskId, () => {
  finished.value = false; reviewed.value = []
  task.value = null; workflow.value = null; activeModule.value = ''; selectedAssignee.value = null; validation.value = null; dirty.value = false; formBusy.value = false
  load()
}, { immediate: true })
watch(() => route.query.module, code => { if (TECHNICAL_DATA_MODULES.some(item => item.code === code)) { finished.value = false; activeModule.value = code; if (workflow.value) followModuleAssignee(code) } })
watch([activeModule, finished], () => {
  const widths = { PROFILE: 760, DRAWING_BOM: 1050, MANUFACTURING: 1420, PACKAGE: 1220, AUXILIARY: 1250, SOLDER: 1100, SALARY: 1020, NET_LOSS: 840, PRICE: 1280 }
  emit('width', finished.value ? 760 : widths[activeModule.value] || 960)
}, { immediate: true })
const statusTimer = setInterval(() => {
  if (!loading.value && !dirty.value && !formBusy.value && !submitting.value && !validating.value
    && (['SYNC_PENDING', 'UNKNOWN'].includes(task.value?.externalTaskStatus)
      || workflow.value?.participants.some(person => ['PREPARED', 'RETURN_PENDING', 'SUBMITTED'].includes(person.status)))) load()
}, 3000)
onBeforeUnmount(() => { generation++; clearInterval(statusTimer); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<style scoped>
.technical-data-workbench { display: flex; flex-direction: column; max-width: 1420px; height: calc(100vh - 120px); min-height: 480px; margin: 0 auto; background: #fff; border: 1px solid #dfe5ee; border-radius: 8px; color: #354256; overflow: hidden; }
.technical-data-workbench.embedded { height: auto; max-height: calc(100vh - 48px); min-height: 300px; border: 0; margin: 0; }
.editor-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 15px; border-bottom: 1px solid #e5eaf0; }
.editor-eyebrow { display: flex; gap: 12px; align-items: center; color: #748298; font-size: 12px; }
h2 { margin: 10px 0 8px; font-size: 19px; font-weight: 600; } h2 span { font-weight: 400; } h3 { margin: 12px 0; }
.editor-header p { margin: 0; color: #78859a; font-size: 12px; line-height: 1.7; }
.editor-header > .el-button { font-size: 24px; padding: 6px; }
.guide-progress { display: flex; flex-wrap: wrap; gap: 8px 24px; padding: 12px 24px; background: #f1f7fe; color: #577594; font-size: 12px; border-bottom: 1px solid #e0eafa; }
.guide-progress b { color: #287fc9; }
.editor-body { flex: 1; min-height: 0; overflow: auto; padding: 18px 24px; }
.task-context { margin-bottom: 16px; font-size: 12px; color: #77869b; }
summary { cursor: pointer; padding: 8px 0; } .task-context summary span { margin-left: 14px; color: #54789b; }
.source-info { margin-top: 8px; } .person-scope { display: flex; align-items: center; gap: 12px; margin: 12px 0; } .person-scope .el-select { width: 260px; }
.reason { margin: 0 0 16px; color: #76849a; font-size: 13px; line-height: 1.7; }
.validation-panel { margin: 12px 0 20px; color: #b47824; } .validation-panel .el-table { margin-top: 12px; }
.module-directory { border-top: 1px solid #edf0f5; margin-top: 24px; color: #6a7d94; font-size: 12px; }
.module-nav { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; padding: 8px 0; }
.module-nav button { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 12px; border: 1px solid #e3e8ef; border-radius: 5px; background: #fff; color: #52647b; text-align: left; cursor: pointer; }
.module-nav button.active { background: #f1f7ff; border-color: #409eff; } .module-nav small { width: 100%; color: #8490a1; }
.module-nav button:disabled { cursor: default; background: #fafbfc; color: #8490a1; }
.editor-footer { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 15px 24px; background: #fafbfd; border-top: 1px solid #e3e8ef; }
.save-status { color: #8190a4; font-size: 12px; } .footer-actions { display: flex; align-items: center; gap: 10px; } .footer-actions .el-button { margin: 0; }
.approval-details { margin-top: 12px; } .guide-complete { text-align: center; padding: 30px 10px; } .guide-complete h3 { color: #28945e; font-size: 19px; } .guide-complete p { color: #748197; line-height: 1.8; font-size: 14px; } .complete-mark { color: #28945e; font-size: 30px; }
@media(max-width: 760px) { .editor-header, .editor-body, .editor-footer { padding: 14px; } .editor-footer { flex-wrap: wrap; } .footer-actions { margin-left: auto; } .task-context summary span { display: block; margin: 6px 0 0; } }
</style>
