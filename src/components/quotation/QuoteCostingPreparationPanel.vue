<template>
  <section class="costing-preparation" aria-label="资料情况" :aria-busy="!state && !error">
    <div class="costing-preparation__row">
      <strong>资料情况</strong>
      <span class="costing-preparation__message" :class="messageType" role="status">{{ error || state?.message || '正在读取资料状态…' }}</span>
      <div class="costing-preparation__actions">
        <el-button v-if="state?.hasSupplement" link type="primary" @click="viewSupplement">查看补录工作台</el-button>
        <el-button link @click="$emit('refresh')">刷新资料状态</el-button>
      </div>
    </div>
    <p v-if="state?.hasSupplement" class="costing-preparation__hint">需补录的产品可在补录工作台分派。技术员提交后，点击核算检查并采用当前资料。</p>
    <ul v-if="blocked.length" class="costing-preparation__gaps">
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
const messageType = computed(() => props.error || ['WAITING_INPUT', 'WAITING'].includes(props.state?.status) ? 'warning' : 'info')
function viewSupplement() { router.push({ path: '/collaboration/tasks', query: { oaNo: props.oaNo } }) }
</script>
<style scoped>
.costing-preparation { margin: 16px 0; padding: 12px 16px; border: 1px solid #dfe6ee; border-radius: 6px; background: #fff; font-size: 14px; }
.costing-preparation__row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.costing-preparation__row strong { white-space: nowrap; }
.costing-preparation__message { flex: 1; min-width: 180px; color: #606c80; line-height: 1.6; }
.costing-preparation__message.warning { color: #b45309; }
.costing-preparation__message.success { color: #268445; }
.costing-preparation__actions { display: flex; gap: 12px; margin-left: auto; }
.costing-preparation__actions .el-button { margin: 0; }
.costing-preparation__hint { margin: 8px 0 0; color: #909399; font-size: 13px; line-height: 1.6; }
.costing-preparation__gaps { margin: 8px 0 0; padding-left: 20px; color: #606c80; line-height: 1.6; }
</style>
