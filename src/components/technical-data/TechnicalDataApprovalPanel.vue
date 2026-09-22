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
      <el-table-column label="操作" width="115">
        <template #default="{ row }">
          <el-button v-if="row.canRetry" link type="primary" :disabled="busy" @click="retryPerson(row)">{{ row.status === 'RETURN_PENDING' ? '核实退回' : '核实提交' }}</el-button>
          <el-button v-else-if="workflow.canFinanceReview && row.status === 'DONE'" link type="danger" :disabled="busy" @click="returnPerson(row)">退回此人</el-button>
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>
    <el-alert v-for="issue in workflow.dependencyIssues || []" :key="`${issue.moduleType}:${issue.sourceModuleType}`"
      :title="issue.message" type="warning" :closable="false" show-icon />
    <div v-if="workflow.canFinanceReview" class="finance-actions">
      <span>{{ workflow.financeReady ? (workflow.financeConfirmed ? '当前资料已确认，可继续核算。' : '已到财务核算节点，请检查各人补录资料。') : '等待各部门审批及 OA 财务节点确认。' }}</span>
      <el-button type="primary" :loading="busy" :disabled="!workflow.financeReady" @click="confirmAndCost">确认资料并核算</el-button>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { confirmTechnicalDataFinance, returnTechnicalDataPerson, retryTechnicalDataWorkflow } from '../../api/technicalDataTasks'
import { submitQuoteProductCostRun } from '../../api/quoteRequests'
import { TECHNICAL_DATA_MODULES } from '../../utils/technicalDataWorkbench'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ task: { type: Object, required: true }, workflow: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const router = useRouter()
const busy = ref(false)
const moduleName = (type) => TECHNICAL_DATA_MODULES.find((module) => module.code === type)?.label || type
const statusName = (status) => ({ OPEN: '待补录／提交', PREPARED: '提交待 OA 确认', SUBMITTED: '部门领导审批中', DONE: '领导已通过', RETURN_PENDING: '退回待 OA 确认' })[status] || status

async function retryPerson(person) {
  busy.value = true
  try {
    await retryTechnicalDataWorkflow(props.task.id, person.recipientId)
    ElMessage.success('正在核实原请求，请稍后查看结果')
    emit('changed')
  } catch (error) { showErrorOnce(error, '核实请求未成功，请刷新查看处理状态') }
  finally { busy.value = false }
}

async function returnPerson(person) {
  let reason
  try {
    const answer = await ElMessageBox.prompt(`退回 ${person.assigneeName} 负责的模块，请填写需要修改的内容。`, '退回补录', {
      inputValidator: (value) => Boolean(value?.trim()) && value.trim().length <= 500 || '请填写 1 至 500 字退回说明',
      confirmButtonText: '提交退回', cancelButtonText: '取消',
    })
    reason = answer.value.trim()
  } catch { return }
  busy.value = true
  try {
    await returnTechnicalDataPerson(props.task.id, {
      assigneeUserId: person.assigneeUserId, expectedTaskVersion: props.task.taskVersion,
      requestId: globalThis.crypto.randomUUID(), reason,
    })
    ElMessage.success('退回请求已发送，OA 确认后开放该人员修改')
    emit('changed')
  } catch (error) { showErrorOnce(error, '退回请求未成功，请刷新查看处理状态') }
  finally { busy.value = false }
}

async function confirmAndCost() {
  busy.value = true
  try {
    await confirmTechnicalDataFinance(props.task.id, props.workflow.approvalFingerprint)
    const product = props.task.products?.[0]
    if (!product) throw new Error('未找到报价产品')
    const result = await submitQuoteProductCostRun(props.task.oaNo, product.oaFormItemId, {
      periodMonth: props.task.accountingMonth, reason: 'INPUT_CHANGED',
    })
    if (result?.pipelineStatus === 'SUCCESS') ElMessage.success('资料已确认，本产品核算完成')
    else ElMessage.warning(result?.message || '资料已确认，请在核算页面查看处理进度或剩余缺口')
    await router.push({ name: 'ingest-quote-product-costing', params: { oaNo: props.task.oaNo, itemId: product.oaFormItemId } })
  } catch (error) { showErrorOnce(error, '确认或核算未完成，请查看当前状态') }
  finally { busy.value = false; emit('changed') }
}
</script>

<style scoped>
.approval-panel { margin-bottom: 16px; background: #fff; }
.approval-heading, .finance-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
.approval-heading span, .finance-actions span { font-size: 13px; color: #657187; }
</style>
