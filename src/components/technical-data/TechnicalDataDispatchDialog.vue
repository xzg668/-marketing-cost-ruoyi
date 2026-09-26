<template>
  <el-dialog :model-value="modelValue" title="检查资料并分派补录" width="1040px" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="checking">
      <p>先核实已有资料；重新检查后，只分派仍需补录的模块。</p>
      <div class="source-actions">
        <el-button :disabled="busy" @click="refresh">重新检查资料</el-button>
        <el-link href="/base/cms-cost/import" target="_blank" type="primary">CMS 资料导入</el-link>
        <el-link href="/base/cms-cost/effective-sources" target="_blank" type="primary">工资、辅料来源</el-link>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table :data="previews" border row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.check?.modules || []" size="small" class="module-checks">
              <el-table-column label="模块" width="170"><template #default="{ row: module }">{{ moduleName(module.moduleType) }}</template></el-table-column>
              <el-table-column label="来源状态" width="120"><template #default="{ row: module }">{{ availabilityLabel(module.availability) }}</template></el-table-column>
              <el-table-column prop="reason" label="检查说明" />
            </el-table>
          </template>
        </el-table-column>
        <el-table-column label="产品" min-width="190"><template #default="{ row }">{{ row.materialNo || row.sunlModel }}<br>{{ row.productName }}</template></el-table-column>
        <el-table-column label="本次资料情况" min-width="310">
          <template #default="{ row }">
            {{ row.error || missingModules(row).map(module => moduleName(module.moduleType)).join('、') || '没有已确认的补录缺口' }}
            <div v-for="source in row.check?.sharedModules || []" :key="source.moduleType" class="shared-source">
              <p>{{ moduleName(source.moduleType) }}：{{ source.message }}</p>
              <el-link v-if="source.sourceTaskId" :href="sharedTaskUrl(source)" target="_blank" type="primary">查看原资料</el-link>
            </div>
            <p v-if="row.check?.taskUpdateMessage" class="hint">{{ row.check.taskUpdateMessage }}</p>
          </template>
        </el-table-column>
        <el-table-column label="资料核实" width="155"><template #default="{ row }"><el-button link type="primary" @click="openCosting(row)">进入产品核算查看</el-button></template></el-table-column>
      </el-table>
      <el-form v-if="dispatchRows.length" class="assignment-form" label-width="125px">
        <el-form-item label="默认补录人">
          <TechnicalDataPersonSelect v-model="assignee" :selected-person="defaultAssigneePerson" :disabled="busy" :clearable="false" aria-label="默认补录人" />
          <span class="hint">所选产品的待补模块默认交给此人。</span>
        </el-form-item>
        <el-collapse>
          <el-collapse-item title="按模块指定不同人员（选填）" name="module-assignments">
            <el-form-item v-for="module in requiredTypes" :key="module.code" :label="module.label">
              <TechnicalDataPersonSelect v-model="overrides[module.code]" :disabled="busy" :aria-label="`${module.label}补录人`" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
    </div>
    <template #footer>
      <span class="hint">本次分派 {{ dispatchRows.length }} 个产品，每个产品只办理自身缺口。</span>
      <el-button :disabled="busy" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="busy" :disabled="checking || !!error || !assignee || !dispatchRows.length" @click="publish">确认分派</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { checkTechnicalDataSources, publishTechnicalDataTasks } from '../../api/technicalDataTasks'
import { TECHNICAL_DATA_MODULES } from '../../utils/technicalDataWorkbench'
import TechnicalDataPersonSelect from './TechnicalDataPersonSelect.vue'

const props = defineProps({ modelValue: Boolean, rows: { type: Array, default: () => [] }, oaNo: String, defaultAssignee: Number, defaultAssigneePerson: Object })
const emit = defineEmits(['update:modelValue', 'dispatched'])
const previews = ref([]), assignee = ref(null), overrides = ref({})
const selectedRows = ref([])
const checking = ref(false), busy = ref(false), error = ref('')
const user = useUserStore()
let generation = 0
const missingModules = row => row.check?.modules?.filter(module => module.required) || []
const dispatchRows = computed(() => previews.value.filter(row => !row.error && missingModules(row).length && !row.check?.sharedModules?.length))
const requiredTypes = computed(() => TECHNICAL_DATA_MODULES.filter(module => dispatchRows.value.some(row => missingModules(row).some(item => item.moduleType === module.code))))
const moduleName = code => TECHNICAL_DATA_MODULES.find(module => module.code === code)?.label || code
const availabilityLabel = value => ({ AVAILABLE: '已有来源', MISSING: '需补录', UNCONFIRMED: '待核实', ERROR: '查询失败' })[value] || value
const sharedTaskUrl = source => `/collaboration/technical-data/tasks/${encodeURIComponent(source.sourceTaskId)}?module=${encodeURIComponent(source.moduleType)}`

watch(() => props.modelValue, async open => {
  const current = ++generation
  if (!open) { checking.value = false; return }
  selectedRows.value = [...props.rows]
  checking.value = true; error.value = ''; previews.value = []
  assignee.value = props.defaultAssignee ?? null; overrides.value = {}
  try {
    await refresh()
  } catch (cause) {
    if (current !== generation) return
    error.value = cause.message || '资料检查失败'; checking.value = false
  }
})

async function refresh() {
  const current = ++generation
  checking.value = true; error.value = ''
  const rows = await Promise.all(selectedRows.value.map(async row => {
    const month = row.costingWorkspace?.periodMonth
    if (!month) return { ...row, error: '请先发起本产品核算，再检查补录资料' }
    try { return { ...row, check: await checkTechnicalDataSources(row.id, month) } }
    catch (cause) { return { ...row, error: cause.message || '请先发起本产品核算，再检查补录资料' } }
  }))
  if (current !== generation) return
  previews.value = rows; checking.value = false
  if (rows.some(row => row.error)) error.value = '部分产品未完成检查，请按提示处理后重新检查。'
  else if (new Set(rows.map(row => row.oaNo || props.oaNo)).size > 1) error.value = '请选择同一张 OA 单据的产品分派。'
  else if (new Set(rows.map(row => row.check.accountingMonth)).size > 1) error.value = '所选产品核算月份不同，请按月份分别分派。'
}

function openCosting(row) {
  window.open(`/ingest/quote-requests/${encodeURIComponent(row.oaNo || props.oaNo)}/items/${row.id}/costing`, '_blank', 'noopener')
}

async function publish() {
  if (busy.value || checking.value || !dispatchRows.value.length) return
  busy.value = true
  try {
    const rows = dispatchRows.value
    const command = {
      oaFormItemIds: rows.map(row => row.id).sort((a, b) => a - b),
      accountingMonth: rows[0].check.accountingMonth, assigneeUserId: assignee.value,
      moduleAssignees: Object.fromEntries(requiredTypes.value.filter(module => overrides.value[module.code]).map(module => [module.code, overrides.value[module.code]])),
      checkFingerprints: Object.fromEntries(rows.map(row => [row.id, row.check.fingerprint])),
    }
    const key = `technical-dispatch:${user.userId}:${command.accountingMonth}:${command.oaFormItemIds.join(',')}`
    const signature = JSON.stringify(command)
    let pending
    try { pending = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { pending = null }
    if (!pending || pending.signature !== signature) pending = { signature, requestId: globalThis.crypto.randomUUID() }
    sessionStorage.setItem(key, JSON.stringify(pending))
    const result = await publishTechnicalDataTasks({ ...command, requestId: pending.requestId })
    if (result.oaResult?.status === 'SUCCESS') {
      sessionStorage.removeItem(key)
      ElMessage.success('OA 分派已确认，技术员可进入补录工作台办理')
      emit('update:modelValue', false)
    } else {
      if (['REJECTED', 'NOT_SENT'].includes(result.oaResult?.status)) sessionStorage.removeItem(key)
      error.value = result.oaResult?.message || 'OA 分派结果尚未确认，请核实原流程。'
    }
    emit('dispatched')
  } catch (cause) { error.value = cause.message || '分派结果未确认，请核实后重试原请求' }
  finally { busy.value = false }
}

</script>

<style scoped>
.source-actions { display: flex; align-items: center; gap: 18px; margin-bottom: 16px; }
.module-checks { padding: 8px 20px; }
.assignment-form { margin-top: 20px; padding: 18px 16px 4px; border: 1px solid #e4eaf3; border-radius: 10px; background: #fbfcfe; }
.assignment-form :deep(.el-form-item__content) { gap: 8px; }
.assignment-form :deep(.el-collapse) { border: 0; background: transparent; }
.assignment-form :deep(.el-collapse-item__header), .assignment-form :deep(.el-collapse-item__wrap) { background: transparent; }
.assignment-form :deep(.el-collapse-item__header) { color: #607a9c; font-size: 13px; }
.hint { color: #667085; font-size: 13px; margin: 0 12px; }
.shared-source { margin-top: 8px; color: #475467; }
.shared-source p { margin: 0; }
</style>
