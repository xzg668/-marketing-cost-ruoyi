<template>
  <section class="order-cost-results" aria-label="本单当前核算结果">
    <h3>本单当前核算结果</h3>
    <el-select v-if="items.length > 1" v-model="selectedId" aria-label="选择查看核算结果的产品" style="width: 420px; max-width: 100%">
      <el-option v-for="item in items" :key="item.id" :value="String(item.id)"
        :label="`${item.materialNo || '新品'} · ${item.productName || ''} · ${item.workflow?.currentStatusLabel || '待核算'}`" />
    </el-select>
    <p v-if="current">{{ current.materialNo || '新品' }} · {{ current.productName || current.sunlModel || '' }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="error" @click="load">重新读取结果</el-button>
    <div v-loading="loading">
      <template v-if="sheet">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="不含税成本1（元/只）">{{ sheet.totals.totalCost }}</el-descriptions-item>
          <el-descriptions-item label="不含税成本2（元/只）">{{ sheet.totals.finalQuoteAmount }}</el-descriptions-item>
        </el-descriptions>
        <JjbSheet :sheet="sheet" @trace="openTrace" />
      </template>
      <p v-else-if="!loading && !error" class="result-empty-message" role="status">{{ current?.workflow?.currentStatusLabel
        ? `当前产品${current.workflow.currentStatusLabel}，核算成功后在此显示结果` : '核算成功后在此显示结果' }}</p>
    </div>
    <CostRunTraceDrawer v-model="traceVisible" :cost-run-no="sheet?.identity.costRunNo || ''"
      :version-no="sheet?.identity.versionNo || ''" :saved-sheet="sheet" :initial-trace="trace" />
  </section>
</template>

<script setup>
import { computed, onScopeDispose, ref, watch } from 'vue'
import { fetchQuoteCostRun } from '../../api/quoteRequests'
import { hasQuoteItemCostingGap } from '../../utils/quoteItemWorkflow'
import JjbSheet from '../JjbSheet.vue'
import CostRunTraceDrawer from '../CostRunTraceDrawer.vue'
const props = defineProps({ oaNo: { type: String, required: true }, items: { type: Array, default: () => [] }, active: Boolean })
const selectedId = ref(''), sheet = ref(null), loading = ref(false), error = ref(''), traceVisible = ref(false), trace = ref(null)
const current = computed(() => props.items.find(item => String(item.id) === selectedId.value))
let generation = 0
function currentVersion(item) {
  const workspace = item?.costingWorkspace
  return workspace?.workspaceStatus === 'SUCCESS' && !workspace.inputChanged && !hasQuoteItemCostingGap(item)
    ? workspace.currentCostVersionId : null
}
watch(() => [props.oaNo, props.items], (_, previous) => {
  if (props.oaNo !== previous?.[0] || !props.items.some(item => String(item.id) === selectedId.value)) {
    selectedId.value = String((props.items.find(item => currentVersion(item)) || props.items[0])?.id || '')
  }
}, { immediate: true, flush: 'sync' })
async function load() {
  const request = ++generation, oaNo = props.oaNo, item = current.value, versionId = currentVersion(item)
  sheet.value = null; error.value = ''; loading.value = false; traceVisible.value = false
  if (!props.active || !oaNo || !item || !versionId) return
  loading.value = true
  try {
    const result = await fetchQuoteCostRun(oaNo, item.id, { versionId })
    if (request !== generation || oaNo !== props.oaNo) return
    if (!result.sheet || String(result.sheet.identity.versionId) !== String(versionId)) throw Error('当前版本结果未读到，请刷新后重试')
    sheet.value = result.sheet
  } catch (failure) { if (request === generation) error.value = failure?.message || '核算结果读取失败' }
  finally { if (request === generation) loading.value = false }
}
function openTrace(row) {
  trace.value = { rowKey: row.key, partItemId: row.partItemIds?.[0], costItemId: row.costItemIds?.[0], costCode: row.code }
  traceVisible.value = true
}
watch(() => [props.oaNo, props.active, current.value?.id, currentVersion(current.value)], load, { immediate: true, flush: 'sync' })
onScopeDispose(() => { generation++ })
</script>

<style scoped>
.order-cost-results { margin-top: 20px; border-top: 1px solid #e4e9f1; padding-top: 16px; color: #344054; font-size: 14px; line-height: 1.5; }
h3 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
p { margin: 8px 0 12px; color: #697386; font-size: 13px; line-height: 1.6; }
.result-empty-message { margin: 0; padding: 16px 0; font-size: 14px; }
</style>
