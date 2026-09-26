<template>
  <section class="document-submit" :aria-label="`${document.oaNo} 提交审批`">
    <div class="submission-row">
      <div>
        <el-button link type="primary" :disabled="busy" @click="$emit('open-document', document.formId)">{{ document.oaNo }}</el-button>
        <span>本人产品已补齐 {{ document.completedProducts }} / {{ document.tasks.length }}</span>
      </div>
      <div>
        <el-button v-if="pendingRequest && !document.canSubmit" :loading="busy" :disabled="disabled" @click="submit(true)">查询本次提交结果</el-button>
        <el-button type="primary" :loading="busy" :disabled="disabled || !document.canSubmit" @click="submit(false)">确认提交</el-button>
      </div>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { submitTechnicalDataDocument } from '../../api/technicalDataTasks'
import { personalPendingProductCount, technicalSubmissionMessage } from '../../utils/technicalDataDocument'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ document: { type: Object, required: true }, refresh: { type: Function, required: true }, disabled: Boolean })
const emit = defineEmits(['busy', 'open-document'])
const user = useUserStore(), busy = ref(false), pendingRequest = ref(null)
const keyName = computed(() => `technical-document-submit:${user.userId}:${props.document.formId}`)
const message = computed(() => technicalSubmissionMessage(props.document, user.userId))
const terminal = status => ['SUCCESS', 'REJECTED', 'NOT_SENT'].includes(status)

function clearPending() { sessionStorage.removeItem(keyName.value); pendingRequest.value = null }
watch(() => props.document, document => {
  try { pendingRequest.value = JSON.parse(sessionStorage.getItem(keyName.value) || 'null') }
  catch { clearPending() }
  if (pendingRequest.value?.idempotencyKey === document.lastSubmission?.requestKey && terminal(document.lastSubmission?.status)) clearPending()
}, { immediate: true })

async function submit(replay) {
  if (busy.value || props.disabled || props.document.readOnly || (!replay && !props.document.canSubmit)) return
  // 从确认框开始互斥，双击也只生成一次提交请求。
  busy.value = true; emit('busy', true)
  try {
    if (!replay) {
      try {
        await ElMessageBox.confirm(`将 ${props.document.oaNo} 中本人负责的 ${personalPendingProductCount(props.document, user.userId)} 个待提交产品统一提交审批？`, '确认提交', { confirmButtonText: '确认提交', cancelButtonText: '继续检查', closeOnClickModal: false })
      } catch { return }
      if (!pendingRequest.value) pendingRequest.value = { idempotencyKey: globalThis.crypto.randomUUID(), fingerprint: props.document.fingerprint }
      sessionStorage.setItem(keyName.value, JSON.stringify(pendingRequest.value))
    }
    if (!pendingRequest.value) return
    const result = await submitTechnicalDataDocument(props.document.formId, pendingRequest.value)
    if (result.status === 'SUCCESS') ElMessage.success('本人资料已提交审批')
    else ElMessage.warning(result.oaResult?.message || 'OA 结果尚未确认，请查看提交状态')
    if (terminal(result.status)) clearPending()
    await props.refresh()
  } catch (cause) {
    showErrorOnce(cause, '提交尚未完成，请查询本次提交结果')
    await props.refresh()
    const code = Number(cause.resultCode || cause.response?.status)
    if ([400, 409].includes(code) && pendingRequest.value
      && props.document.lastSubmission?.requestKey !== pendingRequest.value.idempotencyKey) clearPending()
  } finally { busy.value = false; emit('busy', false) }
}
function mayLeave() { if (busy.value) ElMessage.warning('正在确认提交，请稍候'); return !busy.value }
function beforeUnload(event) { if (busy.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(mayLeave)
onBeforeRouteUpdate(mayLeave)
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.document-submit { padding: 14px 18px; margin-top: 16px; border: 1px solid #e0e8f3; border-radius: 5px; background: #fff; }
.submission-row, .submission-row > div { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.submission-row { justify-content: space-between; }
span, p { color: #637a98; font-size: 13px; }
p { margin: 10px 0 0; }
</style>
