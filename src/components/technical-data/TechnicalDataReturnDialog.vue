<template>
  <el-dialog :model-value="modelValue" title="退回补录资料" width="960px" :close-on-click-modal="false"
    :before-close="close" @update:model-value="$emit('update:modelValue', $event)">
    <div v-loading="loading">
      <p>选择需要退回的产品并填写原因，该产品全部补录资料将退回原负责人。</p>
      <el-alert v-if="result" :title="returnMessage(result)" :type="result.status === 'SUCCESS' ? 'success' : 'warning'" :closable="false" show-icon />
      <el-table :data="candidates" border>
        <el-table-column label="产品" width="175">
          <template #default="{ row }"><el-checkbox v-model="row.selected" :disabled="busy || locked || !row.modules.length">{{ row.productNo }}</el-checkbox></template>
        </el-table-column>
        <el-table-column label="全部补录板块 / 原负责人" min-width="290">
          <template #default="{ row }">
            <div class="return-modules">
              <div v-for="module in row.modules" :key="module.moduleType">
                {{ module.label }} · {{ module.assigneeName }}（{{ module.employeeNo }}）
              </div>
            </div>
            <span v-if="!row.modules.length">当前没有可退回的已提交板块</span>
          </template>
        </el-table-column>
        <el-table-column label="退回原因" min-width="260">
          <template #default="{ row }">
            <el-input v-model="row.reason" type="textarea" :rows="2" maxlength="500" placeholder="请说明需要调整的内容"
              :aria-label="`${row.productNo}退回原因`" :disabled="busy || loading || reasonLocked || !row.modules.length" />
          </template>
        </el-table-column>
      </el-table>
      <p>退回成功后，该产品全部补录缺口恢复，已填内容保留；重新提交成功后消除缺口。其他产品不受影响。</p>
    </div>
    <template #footer>
      <el-button :disabled="busy" @click="close">关闭</el-button>
      <el-button v-if="pending || pendingReturn(result)" :loading="busy" @click="refresh">刷新退回结果</el-button>
      <el-button v-if="result?.canRetry" type="danger" :loading="busy" :disabled="loading" @click="retry">继续退回</el-button>
      <el-button v-else-if="canConfirmPeople" type="danger" :loading="busy" :disabled="loading" @click="confirmPeople">核实OA后继续退回</el-button>
      <el-button v-else-if="result?.status !== 'SUCCESS'" type="danger" :loading="busy" :disabled="loading || locked || !candidates.some(row => row.selected)"
        @click="submit">{{ result && ['REJECTED', 'NOT_SENT'].includes(result.status) ? '重新确认退回' : '确认退回' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { createUuid } from '../../utils/uuid.js'
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { previewTechnicalDataReturn, submitTechnicalDataReturn, fetchTechnicalDataReturn, retryTechnicalDataReturn, confirmTechnicalDataReturnPeople } from '../../api/technicalDataTasks'
import { buildReturnRequest, buildReturnReasons, canReviseReturnReason, pendingReturn, returnMessage } from '../../utils/technicalDataReturn'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ modelValue: Boolean, taskIds: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'changed'])
const user = useUserStore()
const candidates = ref([]), result = ref(null), pending = ref(null), busy = ref(false), loading = ref(false)
const storageKey = computed(() => `technical-return:${user.userId}:${user.businessUnitType}:${[...props.taskIds].sort().join(',')}`)
const locked = computed(() => Boolean(pending.value) || pendingReturn(result.value) || result.value?.status === 'SUCCESS')
const reasonLocked = computed(() => locked.value && !canReviseReturnReason(result.value, user.userId))
const canConfirmPeople = computed(() => result.value?.status === 'UNKNOWN' && result.value?.step === 'PEOPLE'
  && Number(result.value?.actorId) === Number(user.userId))
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
    candidates.value = rows.map(row => ({ ...row, selected: row.modules.length > 0, reason: row.returnReason || '' }))
    const unfinished = rows.find(row => pendingReturn(row.lastReturn))?.lastReturn
    if (unfinished) result.value = unfinished
    if (pending.value) {
      for (const row of candidates.value) {
        const saved = pending.value.targets.find(target => Number(target.taskId) === Number(row.taskId))
        row.selected = Boolean(saved)
        if (saved) row.reason = saved.reason
      }
      await refresh()
    }
  } catch (error) { showErrorOnce(error, '退回资料加载失败') }
  finally { if (request === generation) loading.value = false }
}

async function accept(value) {
  result.value = value
  if (['SUCCESS', 'REJECTED', 'NOT_SENT', 'RETURN_FAILED', 'REJECT_READY'].includes(value.status)) storePending(null)
  if (['REJECTED', 'NOT_SENT'].includes(value.status)) {
    const current = generation
    const rows = await previewTechnicalDataReturn(props.taskIds)
    if (current !== generation) return
    candidates.value = rows.map(row => {
      const previous = candidates.value.find(item => item.taskId === row.taskId)
      return { ...row, reason: previous?.reason || '', selected: Boolean(previous?.selected && row.modules.length) }
    })
  }
  emit('changed')
  if (value.status === 'SUCCESS') {
    ElMessage.success('退回成功，已开放对应资料修改')
    emit('update:modelValue', false)
  }
}

async function submit() {
  if (busy.value || locked.value) return
  let payload
  try { payload = buildReturnRequest(candidates.value, createUuid()) }
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
async function retry() {
  if (busy.value || !result.value?.canRetry) return
  let reasons
  try { reasons = buildReturnReasons(candidates.value) }
  catch (error) { return ElMessage.warning(error.message) }
  busy.value = true
  const current = generation
  const batch = result.value
  try {
    const value = await retryTechnicalDataReturn(batch.batchId, batch.attempt, reasons)
    if (current === generation) await accept(value)
  } catch (error) {
    if (current === generation) {
      // 回执丢失时先读取服务端进度，不能再根据旧页面判断仍可重试。
      const validationFailed = Number(error?.resultCode) >= 400 && Number(error?.resultCode) < 500
      if (!validationFailed) result.value = { ...batch, canRetry: false, status: 'UNKNOWN' }
      showErrorOnce(error, validationFailed ? '请检查退回原因后重试' : '退回结果尚未确认，请刷新本次结果')
    }
  } finally { if (current === generation) busy.value = false }
}
function close() { if (!busy.value) { generation++; emit('update:modelValue', false) } }
async function confirmPeople() {
  if (busy.value || !canConfirmPeople.value) return
  const current = generation, batch = result.value
  let note
  try {
    const answer = await ElMessageBox.prompt('请先在OA核实本次指定技术员已更新成功。填写核实依据后，只发送流程退回这一步。未确认成功时请取消。',
      '确认人员更新成功', { confirmButtonText: '已核实，继续退回', cancelButtonText: '取消',
        inputPlaceholder: '填写核实依据', inputValidator: value => Boolean(value?.trim()) && value.trim().length <= 500 || '请填写1—500字核实依据' })
    note = answer.value
  } catch { return }
  if (current !== generation || busy.value || !canConfirmPeople.value) return
  busy.value = true
  try {
    const value = await confirmTechnicalDataReturnPeople(batch.batchId, batch.attempt, note)
    if (current === generation) await accept(value)
  } catch (error) {
    if (current === generation) {
      // 确认后的第二步也可能已发送，先刷新服务端进度，不能保留旧的人工确认入口。
      result.value = { ...batch, status: 'SENDING', canRetry: false }
      showErrorOnce(error, '请刷新本次退回结果')
    }
  } finally { if (current === generation) busy.value = false }
}
watch(() => [props.modelValue, storageKey.value], ([visible]) => { if (visible) load(); else generation++ })
</script>

<style scoped>
p { color: #657187; line-height: 1.7; }
.el-alert { margin-bottom: 14px; }
.return-modules { display: flex; flex-direction: column; gap: 6px; }
.el-checkbox { margin: 0; white-space: normal; height: auto; min-height: 30px; }
</style>
