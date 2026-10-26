<template>
  <div class="cost-run-detail">
    <div class="tool-row">
      <el-button @click="goBack">返回</el-button>
      <el-button :disabled="!effectiveCostRunNo" @click="openTraceDrawer()">核算底稿</el-button>
      <el-button type="primary" :disabled="!sheet" :loading="exporting" @click="exportSheet">导出</el-button>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <div v-loading="loading">
      <JjbSheet v-if="sheet" :sheet="sheet" @trace="openSheetTrace" />
    </div>

    <CostRunTraceDrawer
      v-model="traceDrawerVisible"
      :cost-run-no="effectiveCostRunNo"
      :version-no="displayCostRunNo"
      :initial-trace="selectedTrace"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchCostRunDetail } from '../api/costRunDetail'
import { exportQuoteCostRunVersion } from '../api/quoteRequests'
import JjbSheet from '../components/JjbSheet.vue'
import CostRunTraceDrawer from '../components/CostRunTraceDrawer.vue'

const route = useRoute()
const router = useRouter()
const sheet = ref(null)
const loadError = ref('')
const loading = ref(false)
const exporting = ref(false)
const traceDrawerVisible = ref(false)
const selectedTrace = ref(null)
const effectiveCostRunNo = computed(() => sheet.value?.identity.costRunNo || '')
const displayCostRunNo = computed(() => sheet.value?.identity.versionNo || effectiveCostRunNo.value)
let detailRequest = 0

async function loadDetail() {
  const request = ++detailRequest
  sheet.value = null
  traceDrawerVisible.value = false
  loading.value = true
  loadError.value = ''
  try {
    const oaNo = String(route.params.oaNo || '')
    const productCode = String(route.query.productCode || route.query.materialCode || '')
    if (!oaNo || !productCode) throw new Error('缺少 OA 单号或物料编码')
    const data = await fetchCostRunDetail(oaNo, productCode, {
      costRunNo: route.query.costRunNo || undefined,
      versionId: route.query.versionId || undefined,
      oaFormItemId: route.params.itemId || route.query.oaFormItemId || undefined,
    })
    if (request !== detailRequest) return
    if (!data?.sheet) throw new Error('成本版本读取模型缺失')
    sheet.value = data.sheet
  } catch (error) {
    if (request !== detailRequest) return
    loadError.value = error?.message || '成本版本加载失败'
    ElMessage.error(loadError.value)
  } finally {
    if (request === detailRequest) loading.value = false
  }
}

function openSheetTrace(row) {
  openTraceDrawer({ rowKey: row.key, partItemId: row.partItemIds?.[0], costItemId: row.costItemIds?.[0], costCode: row.code })
}
function openTraceDrawer(trace = null) {
  if (!effectiveCostRunNo.value) return
  selectedTrace.value = trace
  traceDrawerVisible.value = true
}
function goBack() { router.back() }
async function exportSheet() {
  const identity = sheet.value?.identity
  if (!identity || exporting.value) return
  exporting.value = true
  try {
    await exportQuoteCostRunVersion(identity.oaNo, identity.oaFormItemId, identity.versionId, { isCurrent: () => sheet.value?.identity === identity })
  } catch (error) {
    ElMessage.error(error?.message || '导出成本版本失败')
  } finally { exporting.value = false }
}
onBeforeUnmount(() => { detailRequest++; sheet.value = null })
watch(() => route.fullPath, loadDetail, { immediate: true })
</script>

<style scoped>
.cost-run-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

</style>
