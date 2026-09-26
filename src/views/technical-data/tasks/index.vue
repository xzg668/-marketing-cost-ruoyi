<template>
  <div class="workbench-list">
    <header class="heading">
      <div>
        <h2>补录工作台</h2>
        <p class="viewer">当前查看：{{ user.nickName || user.username }}</p>
        <p>{{ canViewSupplementOverview ? (isEntry ? '查看本单技术员已提交的资料。' : '分派资料缺口，查看技术员已提交的内容和任务进度，需要调整时退回原负责人。') : '补齐本人负责的资料，提交给本人部门领导审批。' }}</p>
      </div>
      <div class="actions">
        <el-button :loading="loading" :disabled="submissionBusy" @click="load">刷新</el-button>
        <el-button v-if="canManage" type="danger" plain :disabled="!returnSelection.length" @click="startReturn(returnSelection)">退回选中资料</el-button>
      </div>
    </header>

    <div class="task-overview" aria-label="补录任务统计">
      <div><span>{{ canViewSupplementOverview ? '补录产品' : '本人的补录任务' }}</span><b>{{ summary.total }}</b></div>
      <div><span>待补录 / 待修改</span><b>{{ summary.pending }}</b></div>
      <div><span>直属领导审批中</span><b>{{ summary.approving }}</b></div>
      <div><span>本任务已通过</span><b>{{ summary.approved }}</b></div>
    </div>

    <el-alert v-if="scopedOaNo" :title="`当前仅查看报价单：${scopedOaNo}`" type="info" :closable="false">
      <el-button v-if="canManage" link type="primary" @click="router.push({ name: 'ingest-quote-request-detail', params: { oaNo: scopedOaNo } })">返回本单核算</el-button>
    </el-alert>
    <el-alert v-if="fixedSubmission" title="本次已提交资料，只读查看。" type="info" :closable="false" />
    <div v-if="!fixedSubmission && !shortSession" class="filters">
      <el-select v-model="filters.taskStatus" :disabled="submissionBusy" clearable placeholder="全部状态" aria-label="处理状态" @change="search">
        <el-option v-for="status in statuses" :key="status" :label="taskStatusLabel(status)" :value="status" />
      </el-select>
      <el-date-picker v-model="filters.accountingMonth" :disabled="submissionBusy" type="month" value-format="YYYY-MM" placeholder="核算月份" @change="search" />
      <el-input v-model="filters.keyword" :disabled="submissionBusy" clearable placeholder="任务号 / 产品 / 报价单" @keyup.enter="search" @clear="search" />
      <el-button type="primary" :disabled="submissionBusy" @click="search">查询</el-button>
      <el-button :disabled="submissionBusy" @click="reset">重置</el-button>
    </div>

    <div v-if="canManage" class="batch-assignment-bar">
      <span class="assignment-count">已选 <b>{{ selected.length }}</b> 个产品</span>
      <label>分派给</label>
      <TechnicalDataPersonSelect v-model="defaultAssignee" :selected-person="selectedAssigneePerson" aria-label="批量分派技术员" @change-person="selectedAssigneePerson = $event" />
      <el-button type="primary" :disabled="!dispatchSelection.length" @click="startDispatch(dispatchSelection)">检查并分派（{{ dispatchSelection.length }} 个产品）</el-button>
      <small>默认由一名技术员负责全部缺口；需要时可在确认框按模块分工</small>
    </div>
    <el-result v-if="accessDenied" icon="warning" title="当前账号无权查看此范围的补录任务" />
    <el-table v-else v-loading="loading" :data="records" :row-key="workbenchRowKey" border class="workbench-table" @selection-change="selected = $event">
      <el-table-column v-if="canManage" type="selection" width="44" fixed="left" :selectable="selectable" />
      <el-table-column label="产品与本次任务" width="240" fixed="left">
        <template #default="{ row }">
          <div class="product-cell">
            <b>{{ row.product.materialNo || row.product.sourceModel || '尚无料号' }}</b>
            <span>{{ row.product.productName || '来源未提供名称' }}</span>
            <small v-if="row.product.sourceModel">{{ row.product.sourceModel }}</small>
            <small>{{ row.oaNo }} · {{ row.accountingMonth }}</small>
            <el-button v-if="row.taskNo && !isUnassigned(row)" link type="primary" @click="open(row)">{{ row.taskNo }}</el-button>
            <small v-else-if="row.taskNo">{{ row.taskNo }}</small>
            <small class="scope">{{ isUnassigned(row) ? (canManage ? '勾选产品后，在上方统一分派' : '等待分派') : scopeLabel(row) }}</small>
            <el-button v-if="!isUnassigned(row)" :type="row.editableModules.length ? 'primary' : ''" size="small"
              @click="open(row)">
              {{ productAction(row) }}
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-for="module in TECHNICAL_DATA_MODULES" :key="module.code" :label="module.code === 'MANUFACTURING' ? '电子图库制造件明细' : module.label" :min-width="module.code === 'MANUFACTURING' ? 155 : 122">
        <template #default="{ row }">
          <span v-if="!canViewSupplementOverview && !row.assignedModules.includes(module.code)" class="not-assigned">—</span>
          <el-tooltip v-else :content="moduleReason(row, module.code)" placement="top" :show-after="250">
            <button type="button" class="module-button" :disabled="!moduleAction(row, module.code)" :class="{ owned: row.assignedModules.includes(module.code), muted: !findModule(row.product, module.code)?.required }" @click="open(row, module.code)">
              <el-tag :type="modulePresentation(row.product, module.code).type" size="small">{{ modulePresentation(row.product, module.code).label }}</el-tag>
              <b v-if="!isTechnicalModuleStatusOnly(row.product, module.code)">{{ technicalModuleSummary(row.product, module.code) }}</b>
              <small v-if="findModule(row.product, module.code)?.assigneeName">{{ findModule(row.product, module.code).assigneeName }}负责</small>
              <span v-if="moduleAction(row, module.code)" class="module-action">{{ moduleAction(row, module.code) }}</span>
            </button>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="140" fixed="right">
        <template #default="{ row }">
          <el-tag v-if="isUnassigned(row)" :type="taskStatusType(row.taskStatus)">{{ taskStatusLabel(row.taskStatus) }}</el-tag>
          <el-button v-else link @click="open(row)"><el-tag :type="taskStatusType(row.taskStatus)">{{ taskStatusLabel(row.taskStatus) }}</el-tag></el-button>
          <small v-if="row.sourceCheck?.sharedModules?.length">已有办理资料，需核实复用</small>
          <el-button v-if="canManage && canReturnRow(row)" link type="danger" @click="startReturn([row])">退回资料</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="当前范围没有补录产品"><p class="empty-hint">核算发现符合补录条件的资料缺口后，产品会显示在这里。</p></el-empty></template>
    </el-table>
    <div v-if="!fixedSubmission && !shortSession" class="footer"><span>共 {{ total }} 个产品</span><el-pagination v-model:current-page="filters.current" :disabled="submissionBusy" :page-size="20" :total="total" layout="prev, pager, next" @current-change="load" /></div>

    <el-alert v-if="documentError" :title="documentError" type="warning" :closable="false" />
    <template v-if="!canViewSupplementOverview && !fixedSubmission && !shortSession">
      <TechnicalDataDocumentSubmit v-for="document in personalDocuments" :key="document.formId" :document="document"
        :refresh="load" :disabled="loading || submissionBusy || !!editorTaskId" @busy="submissionBusy = $event" @open-document="openDocument" />
    </template>

    <el-dialog :model-value="!!editorTaskId" title="补录资料" width="1200px" top="24px" class="technical-entry-dialog"
      :show-close="false" :close-on-click-modal="false" :before-close="closePanel" destroy-on-close>
      <TechnicalDataProductEditor v-if="editorTaskId" :task-id="editorTaskId" :submission-id="fixedSubmission || undefined" @close="closePanel" @changed="load" />
    </el-dialog>
    <TechnicalDataReturnDialog v-model="returnVisible" :task-ids="returnTaskIds" @changed="load" />
    <TechnicalDataDispatchDialog v-model="dispatchVisible" :rows="dispatchRows" :default-assignee="defaultAssignee" :default-assignee-person="selectedAssigneePerson" @dispatched="load" />
    <el-dialog :model-value="!!inspectRow" title="本产品资料检查" width="900px" @close="inspectRow = null">
      <template v-if="inspectRow">
        <p>{{ inspectRow.product.materialNo || inspectRow.product.sourceModel }} · {{ inspectRow.product.productName }} · {{ inspectRow.accountingMonth }}</p>
        <el-table :data="inspectRow.product.modules" border>
          <el-table-column label="模块" width="175"><template #default="{ row }">{{ moduleName(row.moduleType) }}</template></el-table-column>
          <el-table-column label="状态" width="110"><template #default="{ row }">{{ modulePresentation(inspectRow.product, row.moduleType).label }}</template></el-table-column>
          <el-table-column prop="requirementReason" label="检查说明" />
        </el-table>
        <p v-for="source in inspectRow.sourceCheck?.sharedModules || []" :key="source.moduleType">{{ moduleName(source.moduleType) }}：{{ source.message }} <el-link v-if="source.sourceTaskId" :href="`/collaboration/technical-data/tasks/${source.sourceTaskId}?module=${source.moduleType}`" target="_blank" type="primary">查看原资料</el-link></p>
      </template>
      <template v-if="canManage" #footer>
        <el-button :loading="rechecking" @click="recheck(inspectRow)">重新检查资料</el-button>
        <el-button @click="openCosting(inspectRow)">进入产品核算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../../store/modules/user'
import { fetchTechnicalDataProducts, checkTechnicalDataSources, fetchTechnicalDataTask, fetchTechnicalDataWorkflow, fetchTechnicalDataDocument } from '../../../api/technicalDataTasks'
import TechnicalDataProductEditor from '../../../components/technical-data/TechnicalDataProductEditor.vue'
import TechnicalDataDocumentSubmit from '../../../components/technical-data/TechnicalDataDocumentSubmit.vue'
import { submittedDocumentRows } from '../../../utils/technicalDataDocument'
import TechnicalDataDispatchDialog from '../../../components/technical-data/TechnicalDataDispatchDialog.vue'
import TechnicalDataReturnDialog from '../../../components/technical-data/TechnicalDataReturnDialog.vue'
import TechnicalDataPersonSelect from '../../../components/technical-data/TechnicalDataPersonSelect.vue'
import { showErrorOnce } from '../../../utils/errorHandler'
import { TECHNICAL_DATA_MODULES, findModule, moduleName, modulePresentation, technicalModuleSummary, isTechnicalModuleStatusOnly, taskStatusLabel, taskStatusType, workbenchRowKey, canDispatchWorkbenchRow, workbenchDispatchRow } from '../../../utils/technicalDataWorkbench'

const router = useRouter(), route = useRoute(), user = useUserStore()
const resolvedOaNo = ref('')
const scopedOaNo = computed(() => resolvedOaNo.value || String(route.query.oaNo || ''))
const fixedSubmission = computed(() => String(route.query.submission || ''))
const editorTaskId = computed(() => String(route.query.supplement || (route.query.module && route.params.taskId) || ''))
const isEntry = computed(() => Boolean(route.meta.technicalDataEntry))
const canManage = computed(() => canViewSupplementOverview.value && !fixedSubmission.value && !isEntry.value)
const shortSession = computed(() => Boolean(route.meta.technicalDataShortSession))
const personalDocuments = ref([]), documentError = ref(''), submissionBusy = ref(false)
const storageKey = computed(() => `technical-data-product-workbench-state:${user.userId}:${user.businessUnitType}`)
const filters = reactive({ taskStatus: '', accountingMonth: '', keyword: '', current: 1 })
const statuses = computed(() => [...(canViewSupplementOverview.value ? ['UNASSIGNED'] : []), 'PENDING', 'IN_PROGRESS', 'PREPARED', 'SUBMITTED', 'RETURN_PENDING', 'PARTIALLY_RETURNED', 'APPROVED'])
const records = ref([]), selected = ref([]), total = ref(0), loading = ref(false), accessDenied = ref(false), canViewSupplementOverview = ref(false)
const emptySummary = () => ({ total: 0, pending: 0, approving: 0, approved: 0, unassigned: 0 })
const summary = ref(emptySummary())
const dispatchVisible = ref(false), dispatchRows = ref([]), defaultAssignee = ref(null), selectedAssigneePerson = ref(null)
const inspectRow = ref(null), rechecking = ref(false)
const returnVisible = ref(false), returnTaskIds = ref([])
const dispatchSelection = computed(() => selected.value.filter(canDispatchWorkbenchRow))
const returnSelection = computed(() => selected.value.filter(canReturnRow))
let generation = 0

function persistState() { sessionStorage.setItem(storageKey.value, JSON.stringify(filters)) }
async function load() {
  const request = ++generation
  loading.value = true; accessDenied.value = false; documentError.value = ''; persistState()
  try {
    let document = null
    if (shortSession.value) {
      const [task, workflow] = await Promise.all([fetchTechnicalDataTask(route.params.taskId), fetchTechnicalDataWorkflow(route.params.taskId)])
      if (request !== generation) return
      records.value = [{ ...task, taskId: task.id, product: task.products[0], assignedModules: workflow.assignedModules, editableModules: workflow.editableModules }]
      resolvedOaNo.value = task.oaNo; total.value = 1
      canViewSupplementOverview.value = workflow.canViewSupplementOverview
      summary.value = { ...emptySummary(), total: 1 }
      return
    }
    if (route.params.formId || route.params.taskId) {
      const formId = route.params.formId || (await fetchTechnicalDataTask(route.params.taskId)).oaFormId
      document = await fetchTechnicalDataDocument(formId, fixedSubmission.value || undefined)
      if (request !== generation) return
      resolvedOaNo.value = document.oaNo
    }
    if (fixedSubmission.value && document) {
      records.value = submittedDocumentRows(document); total.value = records.value.length
      summary.value = { ...emptySummary(), total: total.value, approving: total.value }
      canViewSupplementOverview.value = true; personalDocuments.value = []; selected.value = []
      return
    }
    const result = await fetchTechnicalDataProducts({ ...filters, oaNo: scopedOaNo.value || undefined, keyword: filters.keyword.trim(), size: 20 })
    if (request !== generation) return
    records.value = result.records; total.value = result.total; summary.value = result.summary
    canViewSupplementOverview.value = Boolean(result.canViewSupplementOverview)
    selected.value = []
    if (result.canViewSupplementOverview) { personalDocuments.value = []; return }
    // 列表可以跨单分页，提交始终读取该 OA 单据中本人的完整任务，不随列表筛选缩小。
    const representatives = [...new Map(result.records.filter(row => row.taskId).map(row => [row.oaNo, row])).values()]
    const documents = document ? [{ status: 'fulfilled', value: document }] : await Promise.allSettled(representatives.map(async row => {
      const task = await fetchTechnicalDataTask(row.taskId)
      return fetchTechnicalDataDocument(task.oaFormId)
    }))
    if (request !== generation) return
    personalDocuments.value = documents.filter(item => item.status === 'fulfilled').map(item => item.value)
    if (documents.some(item => item.status === 'rejected')) documentError.value = '部分单据的提交状态加载失败，请刷新后重试。'
  } catch (error) {
    if (request !== generation) return
    records.value = []; total.value = 0; summary.value = emptySummary(); personalDocuments.value = []
    if ([401, 403].includes(Number(error?.resultCode))) accessDenied.value = true
    else showErrorOnce(error, '补录工作台加载失败')
  } finally { if (request === generation) loading.value = false }
}
function openDocument(formId) {
  if (!submissionBusy.value) router.push({ name: 'technical-data-document-workbench', params: { formId } })
}

function search() { if (submissionBusy.value) return; filters.current = 1; load() }
function reset() { if (submissionBusy.value) return; Object.assign(filters, { taskStatus: '', accountingMonth: '', keyword: '', current: 1 }); load() }
function canReturnRow(row) {
  return Boolean(row.taskId && (['RETURN_PENDING', 'PARTIALLY_RETURNED'].includes(row.taskStatus)
    || row.product.modules.some(module => module.required && module.moduleStatus === 'APPROVED')))
}
function selectable(row) { return canManage.value && (canDispatchWorkbenchRow(row) || canReturnRow(row)) }
function startReturn(rows) {
  if (new Set(rows.map(row => row.oaNo)).size !== 1) return ElMessage.warning('请勾选同一张 OA 单据的产品进行退回')
  returnTaskIds.value = rows.map(row => row.taskId)
  returnVisible.value = true
}
function scopeLabel(row) {
  const modules = canViewSupplementOverview.value ? row.product.modules.filter(module => module.required).map(module => module.moduleType) : row.assignedModules
  return `${canViewSupplementOverview.value ? '本次' : '我负责'}：${modules.map(moduleName).join('、') || '无需补录'}`
}
function isUnassigned(row) { return !row.taskId || row.taskStatus === 'UNASSIGNED' }
function moduleReason(row, code) { return findModule(row.product, code)?.requirementReason || '尚未取得本模块的检查结论' }
function moduleAction(row, code) {
  if (!canViewSupplementOverview.value && !row.assignedModules.includes(code)) return ''
  if (isTechnicalModuleStatusOnly(row.product, code)) return ''
  if (isUnassigned(row)) return findModule(row.product, code)?.required ? '' : '查看来源'
  if (row.editableModules.includes(code)) return findModule(row.product, code)?.moduleStatus === 'READY' ? '查看 / 修改' : ({ DRAWING_BOM: '登记 / 检查', MANUFACTURING: '填写原材料', PACKAGE: '引用 / 新增', AUXILIARY: '参考 / 上传', SOLDER: '参考 / 新增', SALARY: '参考 / 上传', NET_LOSS: '参考 / 填写', PRICE: '补录价格' })[code] || '填写'
  return '查看'
}
function productAction(row) {
  if (row.taskStatus === 'PARTIALLY_RETURNED') return '查看并修改'
  if (row.editableModules.length) return '继续补录'
  return '查看资料'
}
async function open(row, module) {
  if (submissionBusy.value) return
  if (module && !moduleAction(row, module)) return
  if (isUnassigned(row)) {
    inspectRow.value = row
    return
  }
  persistState()
  openPanel(row.taskId, module)
}
function openPanel(taskId, module) {
  return router.push({ query: { ...route.query, supplement: String(taskId), module } })
}
function closePanel() {
  const { supplement, module, ...query } = route.query
  return router.replace({ query })
}
function openCosting(row) { router.push(`/ingest/quote-requests/${encodeURIComponent(row.oaNo)}/items/${row.product.oaFormItemId}/costing`) }
function startDispatch(rows) {
  if (new Set(rows.map(row => row.oaNo)).size > 1) return ElMessage.warning('请勾选同一张 OA 单据的产品进行分派')
  if (new Set(rows.map(row => row.accountingMonth)).size > 1) return ElMessage.warning('请勾选同一核算月份的产品进行分派')
  dispatchRows.value = rows.map(workbenchDispatchRow)
  inspectRow.value = null; dispatchVisible.value = true
}
async function recheck(row) {
  rechecking.value = true
  try {
    await checkTechnicalDataSources(row.product.oaFormItemId, row.accountingMonth)
    inspectRow.value = null
    await load()
    ElMessage.success('已重新检查资料，工作台已更新')
  } catch (error) { showErrorOnce(error, '资料检查失败') }
  finally { rechecking.value = false }
}
onMounted(() => {
  try { const saved = JSON.parse(sessionStorage.getItem(storageKey.value) || '{}'); for (const key of Object.keys(filters)) if (key in saved) filters[key] = saved[key] }
  catch { sessionStorage.removeItem(storageKey.value) }
  if (scopedOaNo.value || route.params.formId || route.params.taskId) Object.assign(filters, { taskStatus: '', accountingMonth: '', keyword: '', current: 1 })
  load()
})
watch(() => [route.query.oaNo, route.params.formId, route.params.taskId, fixedSubmission.value], () => { resolvedOaNo.value = ''; personalDocuments.value = []; reset() })
onBeforeUnmount(() => { generation++; persistState() })
</script>

<style scoped>
.workbench-list { padding: 4px; }
.heading, .actions, .filters, .footer, .batch-assignment-bar { display: flex; align-items: center; gap: 12px; }
.heading { justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
h2 { margin: 0 0 10px; font-size: 24px; }
p, small, .footer { color: #7d8999; }
.heading p { margin: 7px 0; font-size: 13px; }
.heading .viewer, .scope { color: #6485a9; }
.actions { flex-shrink: 0; }
.actions .el-button { margin: 0; }
.task-overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.task-overview > div { display: flex; justify-content: space-between; align-items: center; min-height: 28px; padding: 16px; background: white; border: 1px solid #e3e9f1; border-radius: 5px; }
.task-overview span { color: #7d8999; font-size: 13px; }
.task-overview b { font-size: 24px; color: #38516f; }
.filters { background: white; border: 1px solid #e3e9f1; border-radius: 5px; padding: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.filters .el-select { width: 155px; }
.filters :deep(.el-date-editor) { width: 160px; flex-grow: 0; }
.filters .el-input { width: 300px; }
.batch-assignment-bar { padding: 14px 16px; margin-bottom: 16px; border: 1px solid #e0e8f3; background: #f7faff; border-radius: 10px; color: #637a98; font-size: 13px; flex-wrap: wrap; gap: 14px; }
.assignment-count { padding-right: 16px; border-right: 1px solid #dfe7f2; color: #76869b; white-space: nowrap; }
.assignment-count b { color: #3a6aa6; margin: 0 3px; font-variant-numeric: tabular-nums; }
.batch-assignment-bar > label { color: #536780; }
.batch-assignment-bar > small { font-size: 12px; color: #8a98ab; }
.batch-assignment-bar > .el-button { height: 40px; border-radius: 8px; margin-left: 0; }
.workbench-table { width: 100%; }
.workbench-table :deep(th.el-table__cell) { background: #f6f8fb; font-size: 12px; color: #64748b; }
.workbench-table :deep(td.el-table__cell) { padding: 14px 0; vertical-align: middle; }
.product-cell { display: flex; align-items: flex-start; flex-direction: column; gap: 4px; font-size: 12px; }
.product-cell > b { color: #44536a; font-size: 13px; }
.product-cell small { line-height: 1.6; }
.product-cell .el-button { margin: 4px 0 0; }
.module-button { display: flex; align-items: flex-start; flex-direction: column; gap: 7px; width: 100%; padding: 8px 3px; border: 0; background: transparent; text-align: left; color: #526174; cursor: pointer; line-height: 1.5; }
.module-button.muted b { font-weight: 400; color: #8c98a8; }
.module-button.muted .module-action { color: #8095ad; }
.module-button:not(:disabled):hover { background: #f2f7ff; border-radius: 4px; }
.module-button:disabled { cursor: default; }
.module-button b { font-size: 12px; font-weight: 500; }
.module-button .module-action { color: #409eff; font-size: 12px; }
.module-button small { font-size: 11px; }
.module-button.owned b { color: #306eae; }
.not-assigned { color: #a1aab8; }
.empty-hint { font-size: 13px; }
.footer { justify-content: space-between; margin-top: 16px; font-size: 13px; }
@media (max-width: 1000px) { .heading { flex-wrap: wrap; } .task-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
:global(.technical-entry-dialog) { max-width: calc(100vw - 40px); margin-right: 20px; padding: 0; overflow: hidden; border-radius: 8px; }
:global(.technical-entry-dialog > .el-dialog__header) { display: none; }
:global(.technical-entry-dialog > .el-dialog__body) { padding: 0; }
</style>
