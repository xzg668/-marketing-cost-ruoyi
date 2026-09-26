<template>
  <el-dialog :model-value="modelValue" title="退回补录资料" width="960px" :close-on-click-modal="false"
    :before-close="close" @update:model-value="$emit('update:modelValue', $event)">
    <div v-loading="loading">
      <p>选择需要修改的板块，系统自动退回原负责人。请简要说明修改要求。</p>
      <el-alert v-if="result" :title="returnMessage(result)" :type="result.status === 'SUCCESS' ? 'success' : 'warning'" :closable="false" show-icon />
      <el-table :data="candidates" border>
        <el-table-column prop="productNo" label="产品" width="175" />
        <el-table-column label="需修改板块 / 原负责人" min-width="290">
          <template #default="{ row }">
            <el-checkbox-group v-model="row.selectedModules" :disabled="busy || locked">
              <el-checkbox v-for="module in row.modules" :key="module.moduleType" :value="module.moduleType">
                {{ module.label }} · {{ module.assigneeName }}（{{ module.employeeNo }}）
              </el-checkbox>
            </el-checkbox-group>
            <span v-if="!row.modules.length">当前没有可退回的已批准板块</span>
          </template>
        </el-table-column>
        <el-table-column label="退回原因" min-width="260">
          <template #default="{ row }">
            <el-input v-model="row.reason" type="textarea" :rows="2" maxlength="500" placeholder="请说明需要调整的内容"
              :aria-label="`${row.productNo}退回原因`" :disabled="busy || locked || !row.modules.length" />
          </template>
        </el-table-column>
      </el-table>
      <p>只开放本次选中的内容修改。技术员修改后重新提交领导审批。</p>
    </div>
    <template #footer>
      <el-button :disabled="busy" @click="close">关闭</el-button>
      <el-button v-if="pending || pendingReturn(result)" :loading="busy" @click="refresh">刷新退回结果</el-button>
      <el-button v-if="result?.status !== 'SUCCESS'" type="danger" :loading="busy" :disabled="loading || locked || !candidates.some(row => row.selectedModules.length)"
        @click="submit">{{ result && ['REJECTED', 'NOT_SENT'].includes(result.status) ? '重新确认退回' : '确认退回' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { previewTechnicalDataReturn, submitTechnicalDataReturn, fetchTechnicalDataReturn } from '../../api/technicalDataTasks'
import { buildReturnRequest, pendingReturn, returnMessage } from '../../utils/technicalDataReturn'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ modelValue: Boolean, taskIds: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'changed'])
const user = useUserStore()
const candidates = ref([]), result = ref(null), pending = ref(null), busy = ref(false), loading = ref(false)
const storageKey = computed(() => `technical-return:${user.userId}:${user.businessUnitType}:${[...props.taskIds].sort().join(',')}`)
const locked = computed(() => Boolean(pending.value) || pendingReturn(result.value) || result.value?.status === 'SUCCESS')
let generation = 0

function storePending(value) {
  pending.value = value
  if (value) sessionStorage.setItem(storageKey.value, JSON.stringify(value))
  else sessionStorage.removeItem(storageKey.value)
}

async function load() {
  const request = ++generation
  busy.value = false; loading.value = true; result.value = null; candidates.value = []; pending.value = null
  try {
    try { pending.value = JSON.parse(sessionStorage.getItem(storageKey.value) || 'null') } catch { sessionStorage.removeItem(storageKey.value) }
    const rows = await previewTechnicalDataReturn(props.taskIds)
    if (request !== generation) return
    candidates.value = rows.map(row => ({ ...row, selectedModules: row.modules.map(module => module.moduleType), reason: '' }))
    const unfinished = rows.find(row => pendingReturn(row.lastReturn))?.lastReturn
    if (unfinished) result.value = unfinished
    if (pending.value) {
      for (const row of candidates.value) {
        const saved = pending.value.targets.find(target => Number(target.taskId) === Number(row.taskId))
        if (saved) { row.selectedModules = saved.modules; row.reason = saved.reason }
      }
      await refresh()
    }
  } catch (error) { showErrorOnce(error, '退回资料加载失败') }
  finally { if (request === generation) loading.value = false }
}

async function accept(value) {
  result.value = value
  if (['SUCCESS', 'REJECTED', 'NOT_SENT'].includes(value.status)) storePending(null)
  if (['REJECTED', 'NOT_SENT'].includes(value.status)) {
    const current = generation
    const rows = await previewTechnicalDataReturn(props.taskIds)
    if (current !== generation) return
    candidates.value = rows.map(row => {
      const previous = candidates.value.find(item => item.taskId === row.taskId)
      return { ...row, reason: previous?.reason || '', selectedModules: (previous?.selectedModules || [])
        .filter(type => row.modules.some(module => module.moduleType === type)) }
    })
  }
  emit('changed')
  if (value.status === 'SUCCESS') ElMessage.success('退回成功，已开放对应资料修改')
}

async function submit() {
  if (busy.value || locked.value) return
  let payload
  try { payload = buildReturnRequest(candidates.value, globalThis.crypto.randomUUID()) }
  catch (error) { return ElMessage.warning(error.message) }
  storePending(payload); busy.value = true
  const current = generation
  try {
    const value = await submitTechnicalDataReturn(payload)
    if (current === generation) await accept(value)
  }
  catch (error) {
    if (current !== generation) return
    // 明确本地校验失败未发送；网络失败保留原编号，查询时只重放原操作。
    if (Number(error?.resultCode) >= 400 && Number(error?.resultCode) < 500) storePending(null)
    showErrorOnce(error, '退回结果尚未确认，请刷新本次结果')
  } finally { if (current === generation) busy.value = false }
}

async function refresh() {
  if (busy.value) return
  busy.value = true
  const current = generation
  try {
    const value = result.value?.batchId ? await fetchTechnicalDataReturn(result.value.batchId)
      : pending.value ? await submitTechnicalDataReturn(pending.value) : null
    if (value && current === generation) await accept(value)
  } catch (error) { if (current === generation) showErrorOnce(error, '退回结果查询失败') }
  finally { if (current === generation) busy.value = false }
}
function close() { if (!busy.value) { generation++; emit('update:modelValue', false) } }
watch(() => [props.modelValue, storageKey.value], ([visible]) => { if (visible) load(); else generation++ })
</script>

<style scoped>
p { color: #657187; line-height: 1.7; }
.el-alert { margin-bottom: 14px; }
.el-checkbox-group { display: flex; flex-direction: column; }
.el-checkbox { margin: 0; white-space: normal; height: auto; min-height: 30px; }
</style>
