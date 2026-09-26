<template>
  <section class="material-confirmation" aria-label="资料情况" :aria-busy="!state && !error">
    <div class="material-confirmation__row">
      <strong>资料情况</strong>
      <span class="material-confirmation__message" :class="messageType" role="status">{{ error || state?.message || '正在读取资料状态…' }}</span>
      <div class="material-confirmation__actions">
        <el-button v-if="state?.hasSupplement" link type="primary" @click="viewSupplement">查看补录资料</el-button>
        <el-button link @click="$emit('refresh')">刷新资料状态</el-button>
      </div>
    </div>
    <ul v-if="blocked.length" class="material-confirmation__gaps">
      <li v-for="row in blocked" :key="row.oaFormItemId">{{ row.productCode }}：{{ row.message }}</li>
    </ul>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
const props = defineProps({ oaNo: String, state: Object, checks: { type: Array, default: () => [] }, error: String })
defineEmits(['refresh'])
const router = useRouter()
const blocked = computed(() => props.checks.filter(row => row.pipelineStatus !== 'READY'))
const messageType = computed(() => props.error || ['WAITING_INPUT', 'UNKNOWN', 'REJECTED', 'NOT_SENT'].includes(props.state?.status) ? 'warning' : props.state?.status === 'SUCCESS' ? 'success' : 'info')
function viewSupplement() { router.push({ path: '/collaboration/tasks', query: { oaNo: props.oaNo } }) }
</script>
<style scoped>
.material-confirmation { margin: 16px 0; padding: 12px 16px; border: 1px solid #dfe6ee; border-radius: 6px; background: #fff; font-size: 14px; }
.material-confirmation__row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.material-confirmation__row strong { white-space: nowrap; }
.material-confirmation__message { flex: 1; min-width: 180px; color: #606c80; line-height: 1.6; }
.material-confirmation__message.warning { color: #b45309; }
.material-confirmation__message.success { color: #268445; }
.material-confirmation__actions { display: flex; gap: 12px; margin-left: auto; }
.material-confirmation__actions .el-button { margin: 0; }
.material-confirmation__gaps { margin: 8px 0 0; padding-left: 20px; color: #606c80; line-height: 1.6; }
</style>
