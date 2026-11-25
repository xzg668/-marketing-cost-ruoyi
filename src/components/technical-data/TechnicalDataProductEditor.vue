<template>
  <section class="product-workbench" aria-label="产品补录资料">
    <header class="workbench-header">
      <div><h2>补录资料</h2><p v-if="task">{{ task.oaNo }} · {{ task.accountingMonth }}</p></div>
      <el-button :disabled="busy" @click="close">返回列表</el-button>
    </header>
    <el-skeleton v-if="loading && !task" :rows="8" animated />
    <el-result v-else-if="!task" icon="warning" title="暂时无法查看补录任务"><template #extra><el-button @click="load">重新加载</el-button></template></el-result>
    <template v-else>
      <el-alert v-if="readOnly" title="已提交资料只读查看；待补录板块可预览填写页，未提交草稿仍由负责技术员查看。" type="info" :closable="false" />
      <el-alert v-else-if="directEntry" title="保存后仍可修改；点击“确认保存”后资料直接生效，可用于报价核算，无需 OA 审批。" type="info" :closable="false" />
        <main class="product-editor" v-loading="loading">
          <template v-if="product">
            <div class="product-heading"><h3>当前产品：{{ product.materialNo || product.sourceModel }}</h3><el-button v-if="!readOnly && editableScope.some(code => ['DRAWING_BOM','MANUFACTURING','PACKAGE','SOLDER','PRICE'].includes(code))" link type="primary" :disabled="busy || dirty" :loading="loading" @click="checkPrices">检查价格</el-button><el-button link type="primary" :disabled="busy" @click="refresh">刷新资料</el-button></div>
            <el-alert v-for="person in workflow?.participants?.filter(person => person.returnReason && ['OPEN', 'RETURN_PENDING'].includes(person.status)) || []"
              :key="person.recipientId" :title="`${person.status === 'RETURN_PENDING' ? '退回待确认' : '修改要求'}：${person.returnReason}`" type="warning" :closable="false" show-icon />
            <p class="scope">{{ readOnly ? '查看板块' : '本次补录' }}：{{ (readOnly ? visibleScope : visibleEditableScope).map(moduleName).join('、') || '暂无待补内容' }} · {{ task.accountingMonth }}</p>
            <div class="module-heading">
              <h3>{{ moduleName(activeModule) }} · {{ moduleStatus(activeModule) }}</h3>
              <span v-if="editable">第 {{ activeStep + 1 }} / {{ visibleEditableScope.length }} 项</span>
              <el-select v-else-if="visibleScope.length > 1" :model-value="activeModule" aria-label="切换查看板块" @change="selectModule">
                <el-option v-for="code in visibleScope" :key="code" :value="code" :label="`${moduleName(code)} · ${moduleStatus(code)}`" />
              </el-select>
            </div>
            <el-table v-if="validation && !validation.valid" :data="validation.issues" size="small" border>
              <el-table-column label="板块" width="130"><template #default="{ row }">{{ moduleName(row.moduleType) }}</template></el-table-column>
              <el-table-column prop="lineNo" label="明细行" width="80" /><el-table-column prop="message" label="问题" />
              <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click="selectModule(row.moduleType)">去处理</el-button></template></el-table-column>
            </el-table>
            <el-alert v-if="coveredState" title="已有（来自BOM）" description="本模块材料及用量已随完整BOM提供，无需重复填写。已有待办仍按原流程提交。" type="success" :closable="false" show-icon />
            <component v-else-if="showForm" :is="formComponent" ref="formRef" :key="formKey" v-bind="formProps" @dirty="dirty = $event" @busy="busy = $event" @saved="afterSave" @open-price="selectModule('PRICE')" />
            <TechnicalDataEntryPreview v-else-if="readOnly && !submissionId && previewModules.includes(activeModule)" :row="previewRow" :module-type="activeModule" />
            <el-empty v-else :description="readOnly ? '本板块尚未提交，当前为待处理。' : '请选择本人需要补录的板块。'" />
            <details v-if="workflow && !submissionId" class="progress-details"><summary>查看办理进度</summary><TechnicalDataApprovalPanel :task="task" :workflow="workflow" @changed="load" /></details>
            <div v-if="editable" class="product-actions">
              <span>{{ dirty ? '当前修改尚未保存' : directEntry ? '已保存的资料在确认前仍可修改' : '草稿已保存' }}</span>
              <el-button v-if="activeStep > 0" :disabled="busy" @click="selectModule(visibleEditableScope[activeStep - 1])">上一步</el-button>
              <el-button v-if="!coveredState" :loading="busy" :disabled="!formRef?.canSave" @click="save(false)">保存草稿</el-button>
              <el-button :type="directEntry && confirmationReady ? 'default' : 'primary'" :loading="busy" :disabled="!coveredState && !formRef?.canSave" @click="save(true)">{{ coveredState ? (nextModule ? '下一步' : '检查资料') : nextModule ? '保存并下一步' : directEntry ? '保存并检查资料' : '保存并返回列表' }}</el-button>
              <el-button v-if="directEntry" type="primary" :loading="confirming" :disabled="busy || dirty || !confirmationReady" @click="confirmSave">确认保存</el-button>
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
import { fetchTechnicalDataTask, fetchTechnicalDataWorkflow, fetchTechnicalDataDocument, validateTechnicalDataTask, saveAdminTechnicalDataForQuote, checkTechnicalDataBomPrices } from '../../api/technicalDataTasks'
import { TECHNICAL_DATA_MODULES, moduleName as originalModuleName, findModule, canEditTechnicalModule, nextTechnicalModule, needsBomPriceCheck, isCompleteBomCovered } from '../../utils/technicalDataWorkbench'
import { showErrorOnce } from '../../utils/errorHandler'
import TechnicalDataApprovalPanel from './TechnicalDataApprovalPanel.vue'
import TechnicalDataEntryPreview from './TechnicalDataEntryPreview.vue'
import TechnicalDataProfileForm from './TechnicalDataProfileForm.vue'
import TechnicalDataBomForm from './TechnicalDataBomForm.vue'
import { BOM_MODULE_CODES, isBomModule, bomGroup, hasCompleteBom } from '../../utils/technicalBomWorkbench.js'
import TechnicalDataPackageForm from './TechnicalDataPackageForm.vue'
import TechnicalDataAuxiliaryForm from './TechnicalDataAuxiliaryForm.vue'
import TechnicalDataSolderForm from './TechnicalDataSolderForm.vue'
import TechnicalDataSalaryForm from './TechnicalDataSalaryForm.vue'
import TechnicalDataNetLossForm from './TechnicalDataNetLossForm.vue'
import TechnicalDataPriceForm from './TechnicalDataPriceForm.vue'


const props = defineProps({ taskId: { type: [String, Number], required: true }, submissionId: String, adminDirect: Boolean })
const emit = defineEmits(['close', 'changed'])
const route = useRoute()
const task = ref(null), workflow = ref(null), loading = ref(false), busy = ref(false), dirty = ref(false)
const activeModule = ref(''), revision = ref(0), formRef = ref(null), validation = ref(null)
const confirmationReady = ref(false), confirming = ref(false)
let generation = 0
const directEntry = computed(() => props.adminDirect && task.value?.taskStatus === 'UNASSIGNED')
const adminSalaryEntry = computed(() => activeModule.value === 'SALARY' && workflow.value?.canAdminister && workflow.value?.editableModules?.includes('SALARY'))
const readOnly = computed(() => Boolean(props.submissionId || workflow.value?.canViewSupplementOverview
  && !(directEntry.value && workflow.value?.editableModules?.length) && !adminSalaryEntry.value))
const product = computed(() => task.value?.products[0])
const previewModules = ['PROFILE', 'MANUFACTURING', 'PACKAGE', 'AUXILIARY', 'SOLDER', 'SALARY', 'NET_LOSS', 'PRICE']
const previewRow = computed(() => ({ oaNo: task.value.oaNo, accountingMonth: task.value.accountingMonth, product: product.value }))
const scope = computed(() => TECHNICAL_DATA_MODULES.map(module => module.code).filter(code =>
  findModule(product.value, code)?.required && (readOnly.value || workflow.value?.assignedModules.includes(code))))
const editableScope = computed(() => readOnly.value ? [] : scope.value.filter(code =>
  canEditTechnicalModule(workflow.value, code, findModule(product.value, code)?.moduleStatus)))
const visibleScope = computed(() => bomGroup(scope.value))
const visibleEditableScope = computed(() => bomGroup(editableScope.value))
const activeStep = computed(() => visibleEditableScope.value.indexOf(activeModule.value))
const nextModule = computed(() => visibleEditableScope.value[activeStep.value + 1])
const activeState = computed(() => findModule(product.value, activeModule.value))
const coveredState = computed(() => isCompleteBomCovered(activeState.value) || activeModule.value === 'BOM'
  && scope.value.filter(isBomModule).length > 0 && scope.value.filter(isBomModule).every(code => isCompleteBomCovered(findModule(product.value, code))))
const editable = computed(() => !readOnly.value && (activeModule.value === 'BOM' ? BOM_MODULE_CODES.some(code => editableScope.value.includes(code)) : canEditTechnicalModule(workflow.value, activeModule.value, activeState.value?.moduleStatus)))
const showForm = computed(() => !!formComponent.value && (activeModule.value === 'BOM' || !!activeState.value && (!readOnly.value || activeState.value.currentVersionId != null)))
const forms = { PROFILE: TechnicalDataProfileForm, BOM: TechnicalDataBomForm, PACKAGE: TechnicalDataPackageForm, AUXILIARY: TechnicalDataAuxiliaryForm, SOLDER: TechnicalDataSolderForm, SALARY: TechnicalDataSalaryForm, NET_LOSS: TechnicalDataNetLossForm, PRICE: TechnicalDataPriceForm }
const formComponent = computed(() => forms[activeModule.value])
const formProps = computed(() => activeModule.value === 'PROFILE' ? { product: product.value, taskId: props.taskId, editable: editable.value }
  : activeModule.value === 'BOM' ? { productId: product.value.id, oaNo: task.value.oaNo,
    drawingEditable: editableScope.value.includes('DRAWING_BOM'), manufacturingEditable: editableScope.value.includes('MANUFACTURING'),
    drawingVersionId: readOnly.value ? findModule(product.value, 'DRAWING_BOM')?.currentVersionId : undefined,
    manufacturingVersionId: readOnly.value ? findModule(product.value, 'MANUFACTURING')?.currentVersionId : undefined,
    historical: Boolean(props.submissionId), priceEditable: editableScope.value.includes('PRICE'),
    previewContext: props.adminDirect && readOnly.value && !props.submissionId
      ? { itemId: product.value.oaFormItemId, accountingMonth: task.value.accountingMonth } : undefined }
  : { productId: product.value.id, editable: editable.value, oaNo: task.value.oaNo,
    ...(activeModule.value === 'MANUFACTURING' ? { priceEditable: editableScope.value.includes('PRICE') } : {}),
    versionId: readOnly.value ? activeState.value?.currentVersionId : undefined })
const formKey = computed(() => `${props.taskId}:${activeModule.value}:${props.submissionId || ''}:${revision.value}`)

function moduleName(code) { return isBomModule(code) ? 'BOM补录' : originalModuleName(code) }
function moduleStatus(code) { if (code === 'BOM') return BOM_MODULE_CODES.filter(type => scope.value.includes(type) && (type !== 'MANUFACTURING' || !hasCompleteBom(product.value))).map(type => `${type === 'DRAWING_BOM' ? '明细' : '图库制造件'}：${moduleStatus(type)}`).join(' · '); return ({ PENDING: '待处理', EDITING: '填写中', READY: '已补齐', FROZEN: '待确认', SUBMITTED: '已提交', APPROVED: '已提交', RETURNED: '待修改' })[findModule(product.value, code)?.moduleStatus] || '待处理' }
async function load(autoCheck = true) {
  const current = ++generation
  loading.value = true
  try {
    const [detail, state] = await Promise.all([fetchTechnicalDataTask(props.taskId), fetchTechnicalDataWorkflow(props.taskId)])
    if (autoCheck !== false && !props.submissionId && needsBomPriceCheck(detail.products[0], state.editableModules)) {
      await checkTechnicalDataBomPrices(detail.products[0].id)
      return load(false)
    }
    let visibleTask = detail
    if (props.submissionId) {
      const snapshot = await fetchTechnicalDataDocument(detail.oaFormId, props.submissionId)
      visibleTask = snapshot.tasks.find(item => String(item.id) === String(props.taskId))
      if (!visibleTask) throw new Error('本次提交中没有该产品')
    }
    if (current !== generation) return
    task.value = visibleTask; workflow.value = state
    confirmationReady.value = directEntry.value && editableScope.value.length > 0
      && editableScope.value.every(code => ['READY', 'RETURNED'].includes(findModule(product.value, code)?.moduleStatus))
    if (!visibleScope.value.includes(activeModule.value)) {
      const requested = isBomModule(route.query.module) ? 'BOM' : route.query.module
      const first = nextTechnicalModule(product.value, state, null, editableScope.value) || editableScope.value[0] || scope.value[0]
      activeModule.value = visibleScope.value.includes(requested) ? requested : isBomModule(first) ? 'BOM' : first
    }
  } catch (cause) {
    if (current === generation) { task.value = null; workflow.value = null; showErrorOnce(cause, '任务加载失败') }
  } finally { if (current === generation) loading.value = false }
}
async function checkPrices() {
  if (busy.value || dirty.value || !product.value) return
  loading.value = true
  try {
    const result = await checkTechnicalDataBomPrices(product.value.id)
    await load(false); revision.value++; emit('changed')
    if (result.issues?.length) ElMessage.warning(result.issues.join('；'))
    else if (result.missing) { ElMessage.info('检查完成，请查看价格板块中尚未补齐的项目'); activeModule.value = 'PRICE' }
    else ElMessage.success('检查完成，已有价格无需重复填写')
  } catch (cause) { showErrorOnce(cause, '价格检查失败，已填资料保留') }
  finally { loading.value = false }
}
async function mayLeave() {
  if (busy.value) { ElMessage.warning('正在保存，请稍候'); return false }
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前修改尚未保存，是否放弃这些修改？', '未保存的资料', { confirmButtonText: '放弃修改', cancelButtonText: '继续填写', type: 'warning' })
    dirty.value = false; return true
  } catch { return false }
}
async function selectModule(code) { code = isBomModule(code) ? 'BOM' : code; if (code !== activeModule.value && await mayLeave()) { activeModule.value = code; validation.value = null } }
async function refresh() { if (await mayLeave()) { await load(); revision.value++ } }
async function save(next) { if (!editable.value || busy.value) return; if (coveredState.value) await afterSave({ next }); else await formRef.value?.save(next) }
async function afterSave({ next = false } = {}) {
  dirty.value = false
  await load(); emit('changed')
  if (!next || !task.value) return
  if (activeModule.value === 'BOM' && editableScope.value.some(code => isBomModule(code)
      && !['READY', 'SUBMITTED', 'APPROVED', 'FROZEN'].includes(findModule(product.value, code)?.moduleStatus))) {
    ElMessage.info('BOM资料已保存，请继续处理本模块中尚未补齐的节点')
    return
  }
  if (nextModule.value) { activeModule.value = nextModule.value; return }
  try {
    if (directEntry.value) {
      validation.value = await validateTechnicalDataTask(task.value.id)
      confirmationReady.value = validation.value.valid
      if (confirmationReady.value) ElMessage.success('资料已保存，请核对后点击“确认保存”')
      return
    }
    if (adminSalaryEntry.value) {
      ElMessage.success('工资资料已保存，仍由原任务提交审批')
      emit('close')
      return
    }
    validation.value = await validateTechnicalDataTask(task.value.id)
    if (!validation.value.valid) return
    ElMessage.success('本产品已补齐，请在列表确认提交本单资料')
    emit('close')
  } catch (cause) { showErrorOnce(cause, '资料已保存，完整性检查失败，请重试') }
}
async function confirmSave() {
  if (!directEntry.value || !confirmationReady.value || dirty.value || busy.value || confirming.value || !task.value) return
  confirming.value = true; busy.value = true
  try {
    const result = await saveAdminTechnicalDataForQuote(task.value.id, product.value.rowVersion)
    validation.value = result.validation
    if (!result.effectiveVersionId) { confirmationReady.value = false; return }
    ElMessage.success('资料已确认生效，可用于报价核算')
    emit('changed'); emit('close')
  } catch (cause) { showErrorOnce(cause, '确认保存失败，已保存的资料仍保留') }
  finally { confirming.value = false; busy.value = false }
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
.module-heading { display:flex; align-items:center; gap:16px; margin:20px 0; }
.module-heading > span { color:#748196; font-size:13px; } .module-heading .el-select { width:230px; margin-left:auto; }
.product-actions { justify-content:flex-end; padding:20px 0 0; } .product-actions span { margin-right:auto; color:#7c899c; font-size:12px; }
</style>
