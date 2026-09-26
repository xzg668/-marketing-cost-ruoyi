<template>
  <section class="final-submission" aria-label="整单成本提交" :aria-busy="loading || sending">
    <div class="submission-summary">
      <strong>已核算 {{ state?.readyProducts ?? '—' }} / {{ totalProducts }}</strong>
      <span v-if="message" class="submission-message" :class="{ 'is-warning': error || state?.error || state?.status === 'UNKNOWN' }" role="status">{{ message }}</span>
    </div>
    <el-button type="primary" :loading="sending" :disabled="!canSubmit" @click="$emit('submit')">
      {{ buttonLabel }}
    </el-button>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ state: Object, totalProducts: Number, loading: Boolean, sending: Boolean, error: String, canSubmit: Boolean })
defineEmits(['submit'])
const buttonLabel = computed(() => props.sending ? '正在提交…' : props.state?.status === 'SUBMITTED' ? '已提交 OA' : props.state?.status === 'COMPLETED' ? '流程已完成' : '确认成本并提交 OA')
const message = computed(() => {
  if (props.error) return props.error
  if (props.loading) return ''
  const state = props.state
  if (!state) return ''
  if (state.status === 'SUBMITTED' || state.status === 'COMPLETED') return ''
  if (state.status === 'PENDING') return '提交处理中；若长时间未返回，请核实 OA 结果'
  if (state.status === 'UNKNOWN') return state.error || 'OA 提交结果待确认，请核实原流程'
  if (state.status === 'REJECTED' || state.status === 'NOT_SENT') return state.error || '上次提交未成功，核对后可重新提交'
  if (state.returnReason) return `领导退回：${state.returnReason}。${state.canConfirm ? '重算已完成，可以重新提交' : (state.error || '请重新核算')}`
  // 未核算的产品由进度和明细状态说明；全部核算后仍不能提交时保留具体原因。
  return state.readyProducts === props.totalProducts ? state.error || '' : ''
})
</script>
<style scoped>
.final-submission { position: sticky; bottom: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; margin-top: 12px; border: 1px solid #dfe6ee; border-radius: 6px; background: #fff; }
.submission-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; min-width: 0; font-size: 13px; color: #606266; }
.submission-summary strong { color: #303133; font-size: 14px; white-space: nowrap; }
.submission-message.is-warning { color: #b45309; }
.final-submission > .el-button { flex-shrink: 0; }
@media (max-width: 640px) { .final-submission { flex-wrap: wrap; gap: 12px; } }
</style>
