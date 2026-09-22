<template>
  <section class="final-submission" v-loading="loading">
    <div class="submission-heading">
      <strong>报价最终确认</strong>
      <span>{{ statusText }}</span>
      <el-button :loading="sending" :disabled="!state.canConfirm || sending" type="primary" @click="review">
        {{ state.status === 'FAILED' ? '核对并继续提交' : '确认报价结果' }}
      </el-button>
      <el-button v-if="state.status === 'UNKNOWN'" :loading="sending" @click="reconcile">核实提交结果</el-button>
      <el-button @click="load">刷新提交状态</el-button>
    </div>
    <p v-if="state.returnReason" class="return-reason">领导退回：{{ state.returnReason }}。请调整依据并重新核算；技术资料有误时，在原补录任务中定向退回。</p>
    <el-alert v-if="error || state.error" :title="error || state.error" type="warning" :closable="false" show-icon />
    <el-dialog v-model="reviewing" title="确认本次报价核算结果" width="700px">
      <p>核对以下产品及金额后提交。系统会核实 OA 当前节点，依次完成所需提交；已成功的步骤会保留。</p>
      <el-table :data="state.costs" border>
        <el-table-column prop="productCode" label="产品料号" min-width="150" />
        <el-table-column prop="versionNo" label="本次核算版本" min-width="190" />
        <el-table-column prop="totalCost" label="总成本（元/只）" min-width="130" />
      </el-table>
      <template #footer>
        <el-button @click="reviewing = false">返回核对</el-button>
        <el-button type="primary" :loading="sending" @click="confirm">确认并提交 OA</el-button>
      </template>
    </el-dialog>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchQuoteFinalSubmission, confirmQuoteFinalSubmission } from '../../api/quoteRequests'

const props = defineProps({ oaNo: { type: String, required: true }, refreshKey: Object })
const state = ref({ status: 'NOT_READY', costs: [], canConfirm: false })
const loading = ref(false)
const sending = ref(false)
const reviewing = ref(false)
const error = ref('')
let generation = 0
let timer
const steps = { QUOTE_STATUS: '正在核实 OA 当前节点', QUOTE_DATA_SUBMIT: '正在提交资料节点', QUOTE_RESULT_SAVE: '正在保存核算结果', QUOTE_COST_SUBMIT: '正在提交核算节点' }
const statusText = computed(() => ({ READY: '核算已齐全，待报价员确认', NOT_READY: '请先完成全部产品核算',
  UNKNOWN: 'OA 提交结果待核实', SUBMITTED: '已提交，等待后续审批', FAILED: '提交未完成', RETURNED: state.value.canConfirm ? '重算已完成，待重新确认' : '已退回，须重新核算',
  PENDING: steps[state.value.step] || '正在提交' })[state.value.status] || '正在读取')
async function load() {
  clearTimeout(timer)
  const current = ++generation
  const oaNo = props.oaNo
  if (!oaNo) return
  loading.value = true
  try {
    const result = await fetchQuoteFinalSubmission(oaNo)
    if (current !== generation) return
    state.value = result
    error.value = ''
    if (['PENDING', 'UNKNOWN'].includes(result.status)) timer = setTimeout(load, 2000)
  } catch (failure) {
    if (current === generation) error.value = failure?.message || '读取提交状态失败，请刷新重试'
  } finally { if (current === generation) loading.value = false }
}
async function review() {
  await load()
  if (state.value.canConfirm && !error.value) reviewing.value = true
}
async function confirm() {
  clearTimeout(timer)
  const current = ++generation
  const oaNo = props.oaNo
  sending.value = true
  try {
    const result = await confirmQuoteFinalSubmission(oaNo, state.value.fingerprint)
    if (current !== generation || oaNo !== props.oaNo) return
    state.value = result
    reviewing.value = false
    await load()
  } catch (failure) {
    if (current === generation) ElMessage.error(failure?.message || '确认未完成，请核实后重试')
  } finally { sending.value = false }
}
async function reconcile() { await confirm() }
watch(() => [props.oaNo, props.refreshKey], () => { reviewing.value = false; load() }, { immediate: true })
onBeforeUnmount(() => { generation++; clearTimeout(timer) })
</script>
<style scoped>
.final-submission { padding: 16px; margin: 16px 0; border: 1px solid #dcdfe6; border-radius: 6px; background: #fff; }
.submission-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.submission-heading span { margin-right: auto; color: #606266; }
.return-reason { color: #b45309; line-height: 1.7; }
.el-alert { margin-top: 12px; }
</style>
