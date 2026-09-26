<template>
  <section class="approval-panel">
    <div class="approval-heading">
      <b>补录办理情况</b>
      <span>各自补齐后提交本人部门领导，全部通过后由报价员检查资料。</span>
    </div>
    <el-table :data="workflow.participants || []" size="small" border>
      <el-table-column prop="assigneeName" label="补录人" width="100" />
      <el-table-column label="负责模块" min-width="200">
        <template #default="{ row }">{{ row.moduleTypes.map(moduleName).join('、') }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" label="部门" width="130" />
      <el-table-column prop="leaderName" label="审批领导" width="100" />
      <el-table-column label="办理状态" width="130">
        <template #default="{ row }">{{ statusName(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="returnReason" label="退回说明" min-width="180" />
    </el-table>
    <el-alert v-for="issue in workflow.dependencyIssues || []" :key="`${issue.moduleType}:${issue.sourceModuleType}`"
      :title="issue.message" type="warning" :closable="false" show-icon />
    <div v-if="workflow.canFinanceReview && !route.meta.technicalDataEntry" class="finance-actions">
      <span>检查已提交资料后，返回报价单确认整单资料并核算。</span>
      <el-button type="primary" @click="returnToQuote">返回报价单</el-button>
    </div>
  </section>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { TECHNICAL_DATA_MODULES } from '../../utils/technicalDataWorkbench'

const props = defineProps({ task: { type: Object, required: true }, workflow: { type: Object, required: true } })
const router = useRouter()
const route = useRoute()
const moduleName = (type) => TECHNICAL_DATA_MODULES.find((module) => module.code === type)?.label || type
const statusName = (status) => ({ OPEN: '待处理', PREPARED: '提交待 OA 确认', SUBMITTED: '部门领导审批中', DONE: '领导已通过', RETURN_PENDING: '退回待 OA 确认' })[status] || status

function returnToQuote() {
  router.push({ name: 'ingest-quote-request-detail', params: { oaNo: props.task.oaNo } })
}
</script>

<style scoped>
.approval-panel { margin-bottom: 16px; background: #fff; }
.approval-heading, .finance-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
.approval-heading span, .finance-actions span { font-size: 13px; color: #657187; }
</style>
