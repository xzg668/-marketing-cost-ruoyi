<template>
  <div class="technical-data-workbench">
    <button class="back-link" type="button" @click="backToTasks">← 返回我的协作任务</button>

    <div class="page-heading">
      <div>
        <h2>技术员录入工作台</h2>
        <p>OA 信息自动带入；补齐全部必填资料，整任务校验通过后提交审核。</p>
      </div>
      <div>
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :loading="saving" :disabled="!editable" @click="saveSelectedProfiles">
          保存产品基本信息
        </el-button>
        <el-button :loading="validating" :disabled="!editable" @click="validateAll">校验全部资料</el-button>
        <el-button type="success" :loading="submitting" :disabled="!editable" @click="submitAll">
          提交审核
        </el-button>
      </div>
    </div>

    <el-skeleton v-if="loading && !task" :rows="8" animated />
    <el-result
      v-else-if="accessDenied"
      icon="warning"
      title="当前账号不能查看此技术资料任务"
      sub-title="技术员只能查看本人负责的活动任务。"
    />
    <template v-else-if="task">
      <div class="summary">
        <div><span>协作任务</span><b>{{ task.taskNo }}</b></div>
        <div><span>产品数量</span><b>{{ products.length }}</b></div>
        <div><span>核算月份</span><b>{{ task.accountingMonth }}</b></div>
        <div><span>任务状态</span><b>{{ taskStatusLabel }}</b></div>
        <div><span>审核人</span><b>{{ task.reviewerName || '-' }}</b></div>
      </div>

      <div v-if="!editable" class="readonly-note">
        <b>{{ task.taskStatus === 'SUBMITTED' ? '已提交审核' : taskStatusLabel }}</b>
        <span>V{{ task.reviewRound || 1 }} 提交内容已冻结，产品基本信息和三类明细均为只读。</span>
      </div>

      <section v-if="validation" class="validation-panel" :class="{ passed: validation.valid }">
        <div class="validation-title">
          <b>{{ validation.valid ? '整任务校验通过' : `整任务校验发现 ${validation.issues.length} 个问题` }}</b>
          <span>校验产品 {{ validation.productCount }} 行；问题已定位到产品、模块、字段和明细行</span>
        </div>
        <el-table v-if="!validation.valid" :data="validation.issues" border size="small">
          <el-table-column prop="materialNo" label="产品料号" width="155" />
          <el-table-column label="模块" width="110">
            <template #default="{ row }">{{ moduleLabel(row.moduleType) }}</template>
          </el-table-column>
          <el-table-column prop="field" label="字段" width="150" />
          <el-table-column label="明细行" width="80">
            <template #default="{ row }">{{ row.lineNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="message" label="问题" min-width="300" />
          <el-table-column label="定位" width="80">
            <template #default="{ row }">
              <el-button link type="primary" @click="locateIssue(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="panel">
        <div class="band">产品信息</div>
        <div class="tools">
          <span>OA 信息只读；红色字段为技术员维护字段</span>
          <el-input v-model="keyword" clearable placeholder="搜索产品料号 / 名称" style="width: 280px" />
        </div>

        <div ref="tableScroll" class="table-scroll" @scroll="rememberScroll">
          <table class="workbench-table">
            <thead>
              <tr>
                <th v-for="column in TECHNICAL_DATA_COLUMNS" :key="column" :class="{ required: editableColumns.has(column) }">
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visibleProducts" :key="row.id" :data-product-id="row.id">
                <td class="center">
                  <input v-model="selectedIds" type="checkbox" :value="row.id" :disabled="!profileEditable(row)" aria-label="选择产品" />
                </td>
                <td class="center">{{ row.levelNo }}</td>
                <td><b>{{ row.materialNo || '-' }}</b><small>OA带出</small></td>
                <td>{{ row.productName || '-' }}<small>OA带入</small></td>
                <td :id="`product-${row.id}-profile`">
                  <el-input
                    v-model="row.profile.productModel"
                    :disabled="!profileEditable(row)"
                    maxlength="255"
                    placeholder="请输入产品型号"
                    @input="markDirty(row.id)"
                  />
                  <small class="required">必填</small>
                </td>
                <td>{{ row.sourceSpec || '-' }}<small>OA带入</small></td>
                <td>
                  <el-select v-model="row.profile.productProperty" :disabled="!profileEditable(row)" @change="markDirty(row.id)">
                    <el-option v-for="option in PRODUCT_PROPERTY_OPTIONS" :key="option" :label="option" :value="option" />
                  </el-select>
                  <small>单选</small>
                </td>
                <td><div class="quote-no">{{ row.quoteNo }}</div><small>自动关联</small></td>
                <td>
                  <el-select v-model="row.profile.newProduct" :disabled="!profileEditable(row)" @change="markDirty(row.id)">
                    <el-option v-for="option in NEW_PRODUCT_OPTIONS" :key="option.label" :label="option.label" :value="option.value" />
                  </el-select>
                </td>
                <td :id="`product-${row.id}-package`"><module-entry :product="row" module-type="PACKAGE" :editable="moduleEditable(row, 'PACKAGE')" /></td>
                <td :id="`product-${row.id}-auxiliary`"><module-entry :product="row" module-type="AUXILIARY" :editable="moduleEditable(row, 'AUXILIARY')" /></td>
                <td :id="`product-${row.id}-salary`"><module-entry :product="row" module-type="SALARY" :editable="moduleEditable(row, 'SALARY')" /></td>
              </tr>
              <tr v-if="visibleProducts.length === 0">
                <td colspan="12" class="empty">没有匹配的产品</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="foot">
          <span>共 {{ products.length }} 条产品记录，已选择 {{ selectedIds.length }} 条</span>
          <span>横向滚动可查看全部补录项</span>
        </div>
      </section>

      <div class="note">
        <b>工作台口径：</b>一行对应一个待报价产品；包装组件、辅料和工资均支持“参照/录入”，当前明细页均不提供附件。
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchTechnicalDataTask,
  saveTechnicalDataProfile,
  submitTechnicalDataTask,
  validateTechnicalDataTask,
} from '../api/technicalDataTasks'
import { isDomainError, showErrorOnce } from '../utils/errorHandler'
import {
  NEW_PRODUCT_OPTIONS,
  PRODUCT_PROPERTY_OPTIONS,
  TECHNICAL_DATA_COLUMNS,
  findModule,
  modulePresentation,
  validateTechnicalDataProfile,
} from '../utils/technicalDataWorkbench'

const ModuleEntry = defineComponent({
  name: 'ModuleEntry',
  props: {
    product: { type: Object, required: true },
    moduleType: { type: String, required: true },
    editable: { type: Boolean, default: false },
  },
  setup(props) {
    const entryRouter = useRouter()
    const entryRoute = useRoute()
    return () => {
      const state = modulePresentation(props.product, props.moduleType)
      const module = findModule(props.product, props.moduleType)
      const moduleEnabled = ['PACKAGE', 'AUXILIARY', 'SALARY'].includes(props.moduleType)
        && props.editable
        && module?.moduleStatus !== 'NOT_REQUIRED'
      const routePrefix = ({
        PACKAGE: 'technical-data-package',
        AUXILIARY: 'technical-data-auxiliary',
        SALARY: 'technical-data-salary',
      })[props.moduleType]
      const routeName = (mode) => entryRoute.meta?.technicalDataShortSession
        ? `technical-data-access-${routePrefix.replace('technical-data-', '')}-${mode}`
        : `${routePrefix}-${mode}`
      const open = (mode) => entryRouter.push({
        name: routeName(mode),
        params: { taskId: entryRoute.params.taskId, productId: props.product.id },
      })
      return h('div', { class: 'module-entry' }, [
        h(ElTag, { type: state.type, effect: 'light', size: 'small' }, () => state.label),
        h('div', { class: 'module-actions', title: moduleEnabled ? '进入补录明细' : '对应明细页尚未开放或无需补充' }, [
          h(ElButton, {
            link: true, type: 'primary', disabled: !moduleEnabled,
            onClick: () => open('reference'),
          }, () => '参照'),
          h(ElButton, {
            link: true, type: 'primary', disabled: !moduleEnabled,
            onClick: () => open('entry'),
          }, () => '录入'),
        ]),
      ])
    }
  },
})

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const validating = ref(false)
const submitting = ref(false)
const accessDenied = ref(false)
const task = ref(null)
const validation = ref(null)
const products = ref([])
const keyword = ref('')
const selectedIds = ref([])
const dirtyIds = ref(new Set())
const tableScroll = ref(null)
const editableColumns = new Set(['产品型号', '产品属性', '新品'])
const storageKey = computed(() => `technical-data-workbench-state:${route.params.taskId}`)
const editableStatus = computed(() =>
  ['PENDING', 'IN_PROGRESS', 'PARTIALLY_RETURNED'].includes(task.value?.taskStatus))
const editable = computed(() => editableStatus.value)
const taskStatusLabel = computed(() => ({
  PENDING: '待补录', IN_PROGRESS: '补录中', SUBMITTED: '审核中',
  PARTIALLY_RETURNED: '部分退回', APPROVED: '已通过', CANCELLED: '已取消',
})[task.value?.taskStatus] || task.value?.taskStatus || '-')
const submittingVersionLabel = computed(() =>
  `V${Number(task.value?.reviewRound || 0) + 1}`)
const visibleProducts = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return products.value
  return products.value.filter((row) =>
    [row.materialNo, row.productName].some((field) => String(field || '').toLowerCase().includes(value)))
})

function moduleEditable(product, moduleType) {
  if (!editable.value) return false
  const module = findModule(product, moduleType)
  if (!module || module.moduleStatus === 'NOT_REQUIRED') return false
  if (task.value?.taskStatus !== 'PARTIALLY_RETURNED') return true
  return ['RETURNED', 'EDITING'].includes(module.moduleStatus)
}

function profileEditable(product) {
  return moduleEditable(product, 'PROFILE')
}

async function load() {
  loading.value = true
  accessDenied.value = false
  try {
    const result = await fetchTechnicalDataTask(route.params.taskId)
    task.value = result
    products.value = (result?.products || []).map((product) => ({
      ...product,
      profile: { ...product.profile },
    }))
    restoreState()
    await nextTick()
    restoreScroll()
  } catch (error) {
    task.value = null
    products.value = []
    if ([401, 403].includes(Number(error?.resultCode)) || isDomainError(error, 'FORBIDDEN')) {
      accessDenied.value = true
    } else {
      showErrorOnce(error, '技术员录入工作台加载失败')
    }
  } finally {
    loading.value = false
  }
}

function markDirty(productId) {
  dirtyIds.value = new Set([...dirtyIds.value, productId])
  if (!selectedIds.value.includes(productId)) selectedIds.value.push(productId)
  persistState()
}

async function saveSelectedProfiles() {
  const targetIds = selectedIds.value.length
    ? selectedIds.value
    : [...dirtyIds.value]
  if (!targetIds.length) return ElMessage.warning('请先选择或修改需要保存的产品')
  const targets = products.value.filter((row) => targetIds.includes(row.id) && profileEditable(row))
  if (!targets.length) return ElMessage.warning('本轮没有可编辑的产品基本信息')
  for (const row of targets) {
    const message = validateTechnicalDataProfile(row.profile)
    if (message) return ElMessage.warning(`${row.materialNo || row.productName}：${message}`)
  }

  saving.value = true
  try {
    for (const row of targets) {
      const saved = await saveTechnicalDataProfile(row.id, row.profile)
      row.profile = { ...saved }
      row.rowVersion = saved.expectedVersion
      dirtyIds.value.delete(row.id)
    }
    dirtyIds.value = new Set(dirtyIds.value)
    ElMessage.success(`已保存 ${targets.length} 条产品基本信息`)
    persistState()
    // 首次保存会把任务从 PENDING 推进到 IN_PROGRESS，并递增任务乐观锁版本。
    // 立即回读任务，避免随后“校验 → 提交”继续携带保存前的旧 taskVersion。
    await load()
  } catch (error) {
    if (isDomainError(error, 'VERSION_CONFLICT') || Number(error?.resultCode) === 409) {
      ElMessage.error('数据已被其他会话修改，页面将刷新为最新数据')
      await load()
    } else {
      showErrorOnce(error, '产品基本信息保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function validateAll(notify = true) {
  if (dirtyIds.value.size) return ElMessage.warning('存在未保存的产品基本信息，请先保存再校验')
  validating.value = true
  try {
    validation.value = await validateTechnicalDataTask(task.value.id)
    if (notify) {
      if (validation.value.valid) ElMessage.success('全部产品和必填模块校验通过，可以提交审核')
      else ElMessage.warning(`还有 ${validation.value.issues.length} 个问题需要处理`)
    }
    return validation.value
  } catch (error) {
    showErrorOnce(error, '整任务校验失败')
    return null
  } finally {
    validating.value = false
  }
}

async function submitAll() {
  if (dirtyIds.value.size) return ElMessage.warning('存在未保存的产品基本信息，请先保存再提交')
  const checked = await validateAll(false)
  if (!checked?.valid) return
  try {
    await ElMessageBox.confirm(
      `提交后${submittingVersionLabel.value}产品信息、包装、辅料和工资将全部冻结并进入审核，确定继续吗？`,
      '提交审核确认',
      { type: 'warning', confirmButtonText: '确定提交', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  submitting.value = true
  const keyName = `technical-data-submit-key:${task.value.id}:${task.value.taskVersion}`
  let idempotencyKey = sessionStorage.getItem(keyName)
  if (!idempotencyKey) {
    idempotencyKey = globalThis.crypto?.randomUUID?.()
      || `submit-${task.value.id}-${task.value.taskVersion}-${Date.now()}`
    sessionStorage.setItem(keyName, idempotencyKey)
  }
  try {
    const result = await submitTechnicalDataTask(
      task.value.id, task.value.taskVersion, idempotencyKey,
    )
    validation.value = result.validation || validation.value
    if (!result.submitted) return ElMessage.warning('资料未通过服务端校验，请按问题清单修正')
    sessionStorage.removeItem(keyName)
    ElMessage.success(result.idempotentReplay
      ? '任务已提交，请勿重复操作'
      : `已提交审核，${submittingVersionLabel.value}内容已冻结`)
    await load()
  } catch (error) {
    if (isDomainError(error, 'VERSION_CONFLICT') || Number(error?.resultCode) === 409) {
      ElMessage.error('任务已被其他会话修改，页面将刷新为最新状态')
      await load()
    } else {
      showErrorOnce(error, '提交审核失败')
    }
  } finally {
    submitting.value = false
  }
}

function moduleLabel(value) {
  return ({ TASK: '任务', PROFILE: '产品信息', PACKAGE: '包装', AUXILIARY: '辅料', SALARY: '工资' })[value] || value
}

function locateIssue(issue) {
  const target = issue.anchor ? document.getElementById(issue.anchor) : null
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  else ElMessage.info('该问题位于任务级信息，请查看页面顶部')
}

function backToTasks() {
  persistState()
  if (route.meta?.technicalDataShortSession) {
    window.close()
    return
  }
  router.push('/collaboration/tasks')
}

function rememberScroll() {
  persistState()
}

function restoreState() {
  try {
    const state = JSON.parse(sessionStorage.getItem(storageKey.value) || '{}')
    keyword.value = state.keyword || ''
    selectedIds.value = (state.selectedIds || []).filter((id) => products.value.some((row) => row.id === id))
  } catch {
    sessionStorage.removeItem(storageKey.value)
  }
}

function restoreScroll() {
  try {
    const state = JSON.parse(sessionStorage.getItem(storageKey.value) || '{}')
    if (tableScroll.value) tableScroll.value.scrollLeft = Number(state.scrollLeft || 0)
  } catch {
    // 已在 restoreState 清理损坏状态
  }
}

function persistState() {
  sessionStorage.setItem(storageKey.value, JSON.stringify({
    keyword: keyword.value,
    selectedIds: selectedIds.value,
    scrollLeft: tableScroll.value?.scrollLeft || 0,
  }))
}

onMounted(load)
onBeforeUnmount(persistState)
</script>

<style scoped>
.technical-data-workbench { min-width: 940px; color: #303846; }
.back-link { margin-bottom: 14px; padding: 0; border: 0; background: transparent; color: #318de5; cursor: pointer; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.page-heading h2 { margin: 0 0 6px; font-size: 24px; }
.page-heading p { margin: 0; color: #7d8999; }
.summary { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; margin-bottom: 16px; border: 1px solid #e1e6ee; background: #fff; }
.summary > div { padding: 13px 18px; border-right: 1px solid #edf0f4; }
.summary > div:last-child { border-right: 0; }
.summary span, small { display: block; color: #8a95a4; font-size: 12px; }
.summary b { display: block; margin-top: 4px; }
.panel { border: 1px solid #dde3eb; background: #fff; }
.band { padding: 8px; background: #dceddf; color: #244d32; text-align: center; font-size: 16px; font-weight: 700; }
.tools { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e5eaf0; color: #7c8796; }
.table-scroll { overflow-x: auto; }
.workbench-table { width: 100%; min-width: 1540px; border-collapse: collapse; }
th, td { padding: 11px 12px; border-right: 1px solid #e2e7ee; border-bottom: 1px solid #e2e7ee; text-align: left; vertical-align: middle; white-space: nowrap; }
th { background: #f6f8fb; color: #3f4c60; font-weight: 700; }
th.required, small.required { color: #e64a42; }
.center { text-align: center; }
.quote-no { max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
.module-entry { min-width: 120px; }
.module-actions { margin-top: 5px; }
.module-actions :deep(.el-button + .el-button) { margin-left: 5px; }
.foot { display: flex; justify-content: space-between; padding: 10px 14px; color: #8994a3; }
.note { margin-top: 14px; padding: 12px 15px; border-left: 4px solid #e9aa36; background: #fff8e8; color: #65502a; }
.readonly-note { display: flex; gap: 14px; margin-bottom: 14px; padding: 13px 16px; border-left: 4px solid #47a56a; background: #eef9f2; color: #386549; }
.validation-panel { margin-bottom: 14px; border: 1px solid #f0c6c3; background: #fff; }
.validation-panel.passed { border-color: #b8ddc5; }
.validation-title { display: flex; justify-content: space-between; padding: 12px 15px; background: #fff5f4; color: #80413c; }
.validation-panel.passed .validation-title { background: #eef9f2; color: #386549; }
.validation-title span { color: #7c8796; }
.empty { padding: 28px; color: #909399; text-align: center; }
.workbench-table :deep(.el-input) { min-width: 155px; }
.workbench-table :deep(.el-select) { width: 112px; }
</style>
