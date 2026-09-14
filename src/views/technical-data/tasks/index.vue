<template>
  <div class="technical-data-workbench-list">
    <div class="page-heading">
      <div>
        <h2>技术员补录工作台</h2>
        <p>一行对应一个待报价产品；补齐产品信息，并从包装、辅料、工资列进入参照或录入页面。</p>
      </div>
      <div class="heading-actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="selectedIds.length === 0"
          @click="saveSelectedProfiles"
        >
          保存选中产品
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <div class="band">产品信息</div>
      <div class="filters">
        <el-select v-model="filters.taskStatus" clearable placeholder="全部状态" @change="reload">
          <el-option label="待补录" value="PENDING" />
          <el-option label="补录中" value="IN_PROGRESS" />
        </el-select>
        <el-date-picker
          v-model="filters.accountingMonth"
          type="month"
          value-format="YYYY-MM"
          placeholder="核算月份"
          @change="reload"
        />
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索产品料号 / 名称 / 型号 / 报价单"
          @keyup.enter="reload"
          @clear="reload"
        />
        <el-button type="primary" @click="reload">查询</el-button>
      </div>

      <el-result
        v-if="accessDenied && !loading"
        icon="warning"
        title="当前账号没有技术资料补录权限"
        sub-title="技术员只能查看本人负责的产品；管理员可以查看并直接补录全部产品。"
      />

      <div v-else ref="tableScroll" v-loading="loading" class="table-scroll" @scroll="rememberScroll">
        <table class="workbench-table">
          <thead>
            <tr>
              <th
                v-for="column in TECHNICAL_DATA_COLUMNS"
                :key="column"
                :class="{ required: editableColumns.has(column) }"
              >
                {{ column }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in records" :key="row.id" :data-product-id="row.id">
              <td class="center">
                <input
                  v-model="selectedIds"
                  type="checkbox"
                  :value="row.id"
                  :disabled="!profileEditable(row)"
                  aria-label="选择产品"
                />
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
                  @input="markDirty(row)"
                />
                <small class="required">必填</small>
              </td>
              <td>{{ row.sourceSpec || '-' }}<small>OA带入</small></td>
              <td>
                <el-select
                  v-model="row.profile.productProperty"
                  :disabled="!profileEditable(row)"
                  @change="markDirty(row)"
                >
                  <el-option
                    v-for="option in PRODUCT_PROPERTY_OPTIONS"
                    :key="option"
                    :label="option"
                    :value="option"
                  />
                </el-select>
                <small>单选</small>
              </td>
              <td>
                <div class="quote-no">{{ row.quoteNo || row.oaNo || '-' }}</div>
                <small>自动关联 · {{ row.accountingMonth }}</small>
              </td>
              <td>
                <el-select
                  v-model="row.profile.newProduct"
                  :disabled="!profileEditable(row)"
                  @change="markDirty(row)"
                >
                  <el-option
                    v-for="option in NEW_PRODUCT_OPTIONS"
                    :key="option.label"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </td>
              <td :id="`product-${row.id}-package`">
                <module-entry :row="row" module-type="PACKAGE" :editable="moduleEditable(row, 'PACKAGE')" />
              </td>
              <td :id="`product-${row.id}-auxiliary`">
                <module-entry :row="row" module-type="AUXILIARY" :editable="moduleEditable(row, 'AUXILIARY')" />
              </td>
              <td :id="`product-${row.id}-salary`">
                <module-entry :row="row" module-type="SALARY" :editable="moduleEditable(row, 'SALARY')" />
              </td>
            </tr>
            <tr v-if="!loading && records.length === 0">
              <td colspan="12" class="empty">当前没有待补录产品</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <span>共 {{ page.total }} 条产品记录，已选择 {{ selectedIds.length }} 条</span>
        <el-pagination
          v-model:current-page="page.current"
          :page-size="page.size"
          :total="page.total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </el-card>

    <div class="note">
      包装组件、辅料信息、工资信息统一提供“参照 / 录入”；当前明细页不提供附件。
    </div>
  </div>
</template>

<script setup>
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElButton, ElMessage, ElTag } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  fetchMyTechnicalDataProducts,
  saveTechnicalDataProfile,
} from '../../../api/technicalDataTasks'
import { isDomainError, showErrorOnce } from '../../../utils/errorHandler'
import {
  NEW_PRODUCT_OPTIONS,
  PRODUCT_PROPERTY_OPTIONS,
  TECHNICAL_DATA_COLUMNS,
  findModule,
  modulePresentation,
  validateTechnicalDataProfile,
} from '../../../utils/technicalDataWorkbench'

const STORAGE_KEY = 'technical-data-product-workbench-state'

const ModuleEntry = defineComponent({
  name: 'ModuleEntry',
  props: {
    row: { type: Object, required: true },
    moduleType: { type: String, required: true },
    editable: { type: Boolean, default: false },
  },
  setup(props) {
    const entryRouter = useRouter()
    return () => {
      const state = modulePresentation(props.row, props.moduleType)
      const module = findModule(props.row, props.moduleType)
      const enabled = props.editable && module?.moduleStatus !== 'NOT_REQUIRED'
      const routePrefix = ({
        PACKAGE: 'technical-data-package',
        AUXILIARY: 'technical-data-auxiliary',
        SALARY: 'technical-data-salary',
      })[props.moduleType]
      const open = (mode) => entryRouter.push({
        name: `${routePrefix}-${mode}`,
        params: { taskId: props.row.taskId, productId: props.row.id },
        query: { returnTo: 'product-workbench' },
      })
      return h('div', { class: 'module-entry' }, [
        h(ElTag, { type: state.type, effect: 'light', size: 'small' }, () => state.label),
        h('div', { class: 'module-actions' }, [
          h(ElButton, {
            link: true, type: 'primary', disabled: !enabled,
            onClick: () => open('reference'),
          }, () => '参照'),
          h(ElButton, {
            link: true, type: 'primary', disabled: !enabled,
            onClick: () => open('entry'),
          }, () => '录入'),
        ]),
      ])
    }
  },
})

const loading = ref(false)
const saving = ref(false)
const accessDenied = ref(false)
const records = ref([])
const selectedIds = ref([])
const dirtyIds = ref(new Set())
const tableScroll = ref(null)
const filters = reactive({ taskStatus: '', accountingMonth: '', keyword: '' })
const page = reactive({ current: 1, size: 20, total: 0 })
const editableColumns = new Set(['产品型号', '产品属性', '新品'])

function taskEditable(row) {
  return ['PENDING', 'IN_PROGRESS', 'PARTIALLY_RETURNED'].includes(row.taskStatus)
}

function moduleEditable(row, moduleType) {
  if (!taskEditable(row)) return false
  const module = findModule(row, moduleType)
  if (!module || module.moduleStatus === 'NOT_REQUIRED') return false
  if (row.taskStatus !== 'PARTIALLY_RETURNED') return true
  return ['RETURNED', 'EDITING'].includes(module.moduleStatus)
}

function profileEditable(row) {
  return moduleEditable(row, 'PROFILE')
}

function normalizeRow(record) {
  return {
    ...record.product,
    taskId: record.taskId,
    taskNo: record.taskNo,
    oaNo: record.oaNo,
    accountingMonth: record.accountingMonth,
    assigneeName: record.assigneeName,
    taskStatus: record.taskStatus,
    taskVersion: record.taskVersion,
    reviewRound: record.reviewRound,
    dueAt: record.dueAt,
    profile: { ...record.product.profile },
  }
}

async function load() {
  loading.value = true
  accessDenied.value = false
  try {
    const result = await fetchMyTechnicalDataProducts({
      current: page.current,
      size: page.size,
      taskStatus: filters.taskStatus,
      accountingMonth: filters.accountingMonth,
      keyword: filters.keyword.trim(),
    })
    records.value = (result?.records || []).map(normalizeRow)
    page.total = Number(result?.total || 0)
    selectedIds.value = selectedIds.value.filter((id) => records.value.some((row) => row.id === id))
    dirtyIds.value = new Set([...dirtyIds.value].filter((id) => records.value.some((row) => row.id === id)))
    await nextTick()
    restoreScroll()
  } catch (error) {
    records.value = []
    page.total = 0
    if ([401, 403].includes(Number(error?.resultCode)) || isDomainError(error, 'FORBIDDEN')) {
      accessDenied.value = true
    } else {
      showErrorOnce(error, '技术员补录工作台加载失败')
    }
  } finally {
    loading.value = false
  }
}

function reload() {
  page.current = 1
  load()
}

function markDirty(row) {
  dirtyIds.value = new Set([...dirtyIds.value, row.id])
  if (!selectedIds.value.includes(row.id)) selectedIds.value.push(row.id)
  persistState()
}

async function saveSelectedProfiles() {
  const targets = records.value.filter((row) => selectedIds.value.includes(row.id) && profileEditable(row))
  if (!targets.length) return ElMessage.warning('请选择可编辑的产品')
  for (const row of targets) {
    const message = validateTechnicalDataProfile(row.profile)
    if (message) return ElMessage.warning(`${row.materialNo || row.productName}：${message}`)
  }
  saving.value = true
  try {
    for (const row of targets) {
      await saveTechnicalDataProfile(row.id, row.profile)
    }
    ElMessage.success(`已保存 ${targets.length} 条产品信息`)
    selectedIds.value = []
    dirtyIds.value = new Set()
    await load()
  } catch (error) {
    if (isDomainError(error, 'VERSION_CONFLICT') || Number(error?.resultCode) === 409) {
      ElMessage.error('数据已被其他会话修改，页面将刷新为最新数据')
      await load()
    } else {
      showErrorOnce(error, '产品信息保存失败')
    }
  } finally {
    saving.value = false
  }
}

function rememberScroll() {
  persistState()
}

function restoreState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
    filters.taskStatus = saved.taskStatus || ''
    filters.accountingMonth = saved.accountingMonth || ''
    filters.keyword = saved.keyword || ''
    page.current = Number(saved.current || 1)
    selectedIds.value = saved.selectedIds || []
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}

function restoreScroll() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
    if (tableScroll.value) tableScroll.value.scrollLeft = Number(saved.scrollLeft || 0)
  } catch {
    // 损坏的会话状态已由 restoreState 清理。
  }
}

function persistState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    taskStatus: filters.taskStatus,
    accountingMonth: filters.accountingMonth,
    keyword: filters.keyword,
    current: page.current,
    selectedIds: selectedIds.value,
    scrollLeft: tableScroll.value?.scrollLeft || 0,
  }))
}

watch([() => filters.taskStatus, () => filters.accountingMonth, () => page.current], persistState)
onMounted(() => {
  restoreState()
  load()
})
onBeforeUnmount(persistState)
</script>

<style scoped>
.technical-data-workbench-list { min-width: 980px; color: #303846; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.page-heading h2 { margin: 0 0 6px; font-size: 24px; }
.page-heading p { margin: 0; color: #7d8999; }
.heading-actions { display: flex; gap: 8px; }
.band { margin: -1px -1px 0; padding: 8px; background: #dceddf; color: #244d32; text-align: center; font-size: 16px; font-weight: 700; }
.filters { display: flex; gap: 12px; padding: 14px; border-bottom: 1px solid #e5eaf0; }
.filters :deep(.el-select) { width: 150px; }
.filters :deep(.el-date-editor) { width: 160px; }
.filters :deep(.el-input) { width: 300px; }
.table-scroll { overflow-x: auto; min-height: 180px; }
.workbench-table { width: 100%; min-width: 1580px; border-collapse: collapse; }
th, td { padding: 11px 12px; border-right: 1px solid #e2e7ee; border-bottom: 1px solid #e2e7ee; text-align: left; vertical-align: middle; white-space: nowrap; }
th { background: #f6f8fb; color: #3f4c60; font-weight: 700; }
th.required, small.required { color: #e64a42; }
small { display: block; margin-top: 4px; color: #8a95a4; font-size: 12px; }
.center { text-align: center; }
.quote-no { max-width: 230px; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.module-entry { min-width: 125px; }
.module-actions { margin-top: 5px; }
.module-actions :deep(.el-button + .el-button) { margin-left: 5px; }
.workbench-table :deep(.el-input) { min-width: 155px; }
.workbench-table :deep(.el-select) { width: 112px; }
.empty { padding: 34px; color: #909399; text-align: center; }
.footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; color: #8994a3; }
.note { margin-top: 14px; padding: 12px 15px; border-left: 4px solid #e9aa36; background: #fff8e8; color: #65502a; }
</style>
