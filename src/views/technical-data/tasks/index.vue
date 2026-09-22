<template>
  <div class="workbench-list">
    <header class="heading">
      <div>
        <h2>{{ canViewSupplementOverview ? '补录工作台' : '技术员补录工作台' }}</h2>
        <p class="viewer">当前查看：{{ user.nickName || user.username }}</p>
        <p>{{ canViewSupplementOverview ? '核算发现的资料缺口在此集中补录和分派，已有资料无需操作。' : '补齐本人负责的资料，提交给本人部门领导审批。' }}</p>
      </div>
      <div class="actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button v-if="canViewSupplementOverview" :disabled="!selected.length" @click="startDispatch(selected)">补录分派</el-button>
        <el-button v-else type="primary" :loading="submitting" :disabled="!selected.length || loading" @click="submitSelected">提交补录审批（{{ selected.length }}）</el-button>
      </div>
    </header>

    <div class="task-overview" aria-label="补录任务统计">
      <div><span>{{ canViewSupplementOverview ? '补录产品' : '本人的补录任务' }}</span><b>{{ summary.total }}</b></div>
      <div><span>待补录 / 待修改</span><b>{{ summary.pending }}</b></div>
      <div><span>直属领导审批中</span><b>{{ summary.approving }}</b></div>
      <div><span>本任务已通过</span><b>{{ summary.approved }}</b></div>
    </div>

    <div class="filters">
      <el-select v-model="filters.taskStatus" clearable placeholder="全部状态" aria-label="处理状态" @change="search">
        <el-option v-for="status in statuses" :key="status" :label="taskStatusLabel(status)" :value="status" />
      </el-select>
      <el-date-picker v-model="filters.accountingMonth" type="month" value-format="YYYY-MM" placeholder="核算月份" @change="search" />
      <el-input v-model="filters.keyword" clearable placeholder="任务号 / 产品 / 报价单" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <div v-if="canViewSupplementOverview" class="batch-assignment-bar">
      <span class="assignment-count">已选 <b>{{ selected.length }}</b> 个产品</span>
      <label>分派给</label>
      <TechnicalDataPersonSelect v-model="defaultAssignee" :selected-person="selectedAssigneePerson" aria-label="批量分派技术员" @change-person="selectedAssigneePerson = $event" />
      <el-button type="primary" :disabled="!selected.length" @click="startDispatch(selected)">提交分派（{{ selected.length }} 个产品）</el-button>
      <small>默认由一名技术员负责全部缺口；需要时可在确认框按模块分工</small>
    </div>
    <el-alert v-if="submissionMessage" :title="submissionMessage" type="warning" :closable="true" @close="submissionMessage = ''" />
    <el-result v-if="accessDenied" icon="warning" title="当前账号无权查看此范围的补录任务" />
    <el-table v-else v-loading="loading" :data="records" :row-key="workbenchRowKey" border class="workbench-table" @selection-change="selected = $event">
      <el-table-column type="selection" width="44" fixed="left" :selectable="selectable" />
      <el-table-column label="产品与本次任务" width="240" fixed="left">
        <template #default="{ row }">
          <div class="product-cell">
            <b>{{ row.product.materialNo || row.product.sourceModel || '尚无料号' }}</b>
            <span>{{ row.product.productName || '来源未提供名称' }}</span>
            <small v-if="row.product.sourceModel">{{ row.product.sourceModel }}</small>
            <small>{{ row.oaNo }} · {{ row.accountingMonth }}</small>
            <el-button v-if="row.taskNo" link type="primary" @click="open(row)">{{ row.taskNo }}</el-button>
            <small class="scope">{{ row.taskId ? scopeLabel(row) : '核算发现资料缺口，确认后补录或分派' }}</small>
            <el-button :type="row.editableModules.length || !row.taskId ? 'primary' : ''" size="small"
              :loading="preparingKey === workbenchRowKey(row)" @click="open(row)">
              {{ preparingKey === workbenchRowKey(row) ? '正在进入…' : productAction(row) }}
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-for="module in TECHNICAL_DATA_MODULES" :key="module.code" :label="module.code === 'MANUFACTURING' ? '电子图库制造件明细' : module.label" :min-width="module.code === 'MANUFACTURING' ? 155 : 122">
        <template #default="{ row }">
          <el-tooltip :content="moduleReason(row, module.code)" placement="top" :show-after="250">
            <button type="button" class="module-button" :disabled="isTechnicalModuleStatusOnly(row.product, module.code)" :class="{ owned: row.assignedModules.includes(module.code), muted: !findModule(row.product, module.code)?.required }" @click="open(row, module.code)">
              <el-tag :type="modulePresentation(row.product, module.code).type" size="small">{{ modulePresentation(row.product, module.code).label }}</el-tag>
              <b v-if="!isTechnicalModuleStatusOnly(row.product, module.code)">{{ technicalModuleSummary(row.product, module.code) }}</b>
              <small v-if="findModule(row.product, module.code)?.assigneeName">{{ findModule(row.product, module.code).assigneeName }}负责</small>
              <span v-if="!isTechnicalModuleStatusOnly(row.product, module.code)" class="module-action">{{ moduleAction(row, module.code) }}</span>
            </button>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link @click="open(row)"><el-tag :type="taskStatusType(row.taskStatus)">{{ taskStatusLabel(row.taskStatus) }}</el-tag></el-button>
          <small v-if="row.sourceCheck?.sharedModules?.length">已有办理资料，需核实复用</small>
          <el-button v-if="canDispatchWorkbenchRow(row)" link type="primary" class="row-dispatch" @click="startDispatch([row])">分派补录</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="当前范围没有补录产品"><p class="empty-hint">核算发现符合补录条件的资料缺口后，产品会显示在这里。</p></el-empty></template>
    </el-table>
    <div class="footer"><span>共 {{ total }} 个产品</span><el-pagination v-model:current-page="filters.current" :page-size="20" :total="total" layout="prev, pager, next" @current-change="load" /></div>

    <el-dialog :model-value="!!route.query.supplement" title="补录资料" :width="`${panelWidth}px`" top="24px" class="technical-entry-dialog"
      :show-close="false" :close-on-click-modal="false" :before-close="closePanel" destroy-on-close>
      <TechnicalDataWorkbenchPage v-if="route.query.supplement" :task-id="String(route.query.supplement)" embedded @close="closePanel" @changed="load" @width="panelWidth = $event" />
    </el-dialog>
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
      <template #footer>
        <el-button :loading="rechecking" @click="recheck(inspectRow)">重新检查资料</el-button>
        <el-button @click="openCosting(inspectRow)">进入产品核算</el-button>
        <el-button v-if="inspectRow?.product?.modules?.some(module => module.required)" type="primary" :loading="preparingKey === workbenchRowKey(inspectRow)" @click="open(inspectRow)">开始补录</el-button>
        <el-button v-if="canDispatchWorkbenchRow(inspectRow)" type="primary" plain @click="startDispatch([inspectRow])">分派补录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../../store/modules/user'
import { fetchTechnicalDataProducts, checkTechnicalDataSources, prepareTechnicalDataTask, fetchTechnicalDataTask, fetchTechnicalDataWorkflow, validateTechnicalDataTask, submitTechnicalDataTask } from '../../../api/technicalDataTasks'
import TechnicalDataWorkbenchPage from '../../../pages/TechnicalDataWorkbenchPage.vue'
import TechnicalDataDispatchDialog from '../../../components/technical-data/TechnicalDataDispatchDialog.vue'
import TechnicalDataPersonSelect from '../../../components/technical-data/TechnicalDataPersonSelect.vue'
import { showErrorOnce } from '../../../utils/errorHandler'
import { TECHNICAL_DATA_MODULES, findModule, firstRequiredTechnicalModule, moduleName, modulePresentation, technicalModuleSummary, isTechnicalModuleStatusOnly, taskStatusLabel, taskStatusType, workbenchRowKey, canDispatchWorkbenchRow, workbenchDispatchRow } from '../../../utils/technicalDataWorkbench'

const router = useRouter(), route = useRoute(), user = useUserStore()
const panelWidth = ref(960)
const storageKey = computed(() => `technical-data-product-workbench-state:${user.userId}:${user.businessUnitType}`)
const filters = reactive({ taskStatus: '', accountingMonth: '', keyword: '', current: 1 })
const statuses = computed(() => [...(canViewSupplementOverview.value ? ['UNASSIGNED'] : []), 'PENDING', 'IN_PROGRESS', 'PREPARED', 'SUBMITTED', 'PARTIALLY_RETURNED', 'APPROVED'])
const records = ref([]), selected = ref([]), total = ref(0), loading = ref(false), accessDenied = ref(false), canViewSupplementOverview = ref(false)
const emptySummary = () => ({ total: 0, pending: 0, approving: 0, approved: 0, unassigned: 0 })
const summary = ref(emptySummary())
const dispatchVisible = ref(false), dispatchRows = ref([]), defaultAssignee = ref(null), selectedAssigneePerson = ref(null)
const inspectRow = ref(null), rechecking = ref(false), submitting = ref(false), submissionMessage = ref('')
const preparingKey = ref('')
let generation = 0

function persistState() { sessionStorage.setItem(storageKey.value, JSON.stringify(filters)) }
async function load() {
  const request = ++generation
  loading.value = true; accessDenied.value = false; persistState()
  try {
    const result = await fetchTechnicalDataProducts({ ...filters, keyword: filters.keyword.trim(), size: 20 })
    if (request !== generation) return
    records.value = result.records; total.value = result.total; summary.value = result.summary
    canViewSupplementOverview.value = Boolean(result.canViewSupplementOverview)
    selected.value = []
  } catch (error) {
    if (request !== generation) return
    records.value = []; total.value = 0; summary.value = emptySummary()
    if ([401, 403].includes(Number(error?.resultCode))) accessDenied.value = true
    else showErrorOnce(error, '补录工作台加载失败')
  } finally { if (request === generation) loading.value = false }
}
function search() { filters.current = 1; load() }
function reset() { Object.assign(filters, { taskStatus: '', accountingMonth: '', keyword: '', current: 1 }); load() }
function selectable(row) { return !submitting.value && (canViewSupplementOverview.value ? canDispatchWorkbenchRow(row) : row.assignedModules.some(code => row.editableModules.includes(code))) }
function scopeLabel(row) {
  const modules = canViewSupplementOverview.value ? row.product.modules.filter(module => module.required).map(module => module.moduleType) : row.assignedModules
  return `${canViewSupplementOverview.value ? '本次' : '我负责'}：${modules.map(moduleName).join('、') || '无需补录'}`
}
function moduleReason(row, code) { return findModule(row.product, code)?.requirementReason || '尚未取得本模块的检查结论' }
function moduleAction(row, code) {
  if (!row.taskId) return findModule(row.product, code)?.required ? '进入补录' : '查看来源'
  if (row.editableModules.includes(code)) return findModule(row.product, code)?.moduleStatus === 'READY' ? '查看 / 修改' : ({ DRAWING_BOM: '登记 / 检查', MANUFACTURING: '填写原材料', PACKAGE: '引用 / 新增', AUXILIARY: '参考 / 上传', SOLDER: '参考 / 新增', SALARY: '参考 / 上传', NET_LOSS: '参考 / 填写', PRICE: '补录价格' })[code] || '填写'
  return '查看'
}
function productAction(row) {
  if (!row.taskId || row.taskStatus === 'UNASSIGNED') return '开始补录'
  if (row.taskStatus === 'PARTIALLY_RETURNED') return '查看并修改'
  if (row.editableModules.length) return '继续补录'
  return '查看资料'
}
async function open(row, module) {
  if (module && isTechnicalModuleStatusOnly(row.product, module)) return
  if (!row.taskId) {
    if (module && !findModule(row.product, module)?.required) { inspectRow.value = row; return }
    await prepareAndOpen(row, module)
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
async function prepareAndOpen(row, module) {
  const key = workbenchRowKey(row)
  if (preparingKey.value) return
  preparingKey.value = key
  try {
    const target = module && findModule(row.product, module)?.required
      ? module : firstRequiredTechnicalModule(row.product)
    if (!target) {
      inspectRow.value = null
      await load()
      ElMessage.info('当前产品已没有需要补录的模块')
      return
    }
    if (!row.sourceCheck?.fingerprint) throw new Error('核算检查记录缺失，请重新发起核算')
    const task = await prepareTechnicalDataTask({
      requestId: globalThis.crypto.randomUUID(),
      oaFormItemId: row.product.oaFormItemId,
      accountingMonth: row.accountingMonth,
      checkFingerprint: row.sourceCheck.fingerprint,
    })
    inspectRow.value = null
    persistState()
    await openPanel(task.id, target)
  } catch (error) {
    showErrorOnce(error, '进入补录页面失败')
    await load()
  } finally { preparingKey.value = '' }
}
function openCosting(row) { router.push(`/ingest/quote-requests/${encodeURIComponent(row.oaNo)}/items/${row.product.oaFormItemId}/costing`) }
function startDispatch(rows) {
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
async function submitSelected() {
  const rows = [...selected.value]
  try { await ElMessageBox.confirm(`提交所选 ${rows.length} 个产品中本人负责的资料，分别交本人部门领导审批？`, '提交补录审批', { confirmButtonText: '确定提交', cancelButtonText: '取消', type: 'warning' }) }
  catch { return }
  submitting.value = true; submissionMessage.value = ''
  const failures = []
  let submitted = 0
  for (const row of rows) {
    try {
      const [task, workflow] = await Promise.all([fetchTechnicalDataTask(row.taskId), fetchTechnicalDataWorkflow(row.taskId)])
      const person = workflow.participants.find(item => item.assigneeUserId === user.userId)
      if (!person?.canSubmit) throw new Error('当前本人资料不能提交，请进入任务查看状态')
      const validation = await validateTechnicalDataTask(row.taskId, person.assigneeUserId)
      if (!validation.valid) throw new Error(validation.issues.map(issue => `${moduleName(issue.moduleType)}：${issue.message}`).join('；'))
      const product = task.products[0]
      const keyName = `technical-data-submit-key:${task.id}:${person.assigneeUserId}:${task.taskVersion}:${product.rowVersion}`
      const key = sessionStorage.getItem(keyName) || globalThis.crypto.randomUUID()
      sessionStorage.setItem(keyName, key)
      const result = await submitTechnicalDataTask(task.id, task.taskVersion, product.rowVersion, key, person.assigneeUserId)
      if (!result.submissionId) throw new Error('资料未通过提交校验，请进入任务处理')
      sessionStorage.removeItem(keyName); submitted++
    } catch (error) { failures.push(`${row.product.materialNo || row.product.sourceModel}：${error.message}`) }
  }
  if (failures.length) submissionMessage.value = `已提交 ${submitted} 个产品；未提交：${failures.join('；')}`
  else ElMessage.success(`已提交 ${submitted} 个产品，等待审批受理`)
  await load(); submitting.value = false
}
onMounted(() => {
  try { const saved = JSON.parse(sessionStorage.getItem(storageKey.value) || '{}'); for (const key of Object.keys(filters)) if (key in saved) filters[key] = saved[key] }
  catch { sessionStorage.removeItem(storageKey.value) }
  load()
})
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
.row-dispatch { display: block; margin: 10px 0 0; }
.empty-hint { font-size: 13px; }
.footer { justify-content: space-between; margin-top: 16px; font-size: 13px; }
@media (max-width: 1000px) { .heading { flex-wrap: wrap; } .task-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
:global(.technical-entry-dialog) { max-width: calc(100vw - 40px); margin-right: 20px; padding: 0; overflow: hidden; border-radius: 8px; }
:global(.technical-entry-dialog > .el-dialog__header) { display: none; }
:global(.technical-entry-dialog > .el-dialog__body) { padding: 0; }
</style>
