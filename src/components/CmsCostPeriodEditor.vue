<template>
  <section v-if="source || loading || loadError" class="labor-period" :aria-label="title">
    <p v-if="loadError" role="alert">{{ loadError }} <button type="button" @click="loadSource">重试</button></p>
    <p v-else-if="!source" role="status">正在读取生效期间…</p>
    <template v-else>
      <div class="period-controls">
        <span>{{ source.materialCode }} · 当前生效期间 <strong>{{ source.currentPeriod || '待指定' }}</strong></span>
        <label>拟采用期间 <select v-model="period" :disabled="saving" @change="loadPreview">
          <option value="" disabled>请选择期间</option>
          <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
        </select></label>
        <button type="button" :disabled="!canSave" @click="save">{{ saving ? '正在保存…' : '保存采用期间' }}</button>
      </div>
      <p v-if="loading" role="status">正在核对计划成本并试算…</p>
      <p v-if="error" class="period-error" role="alert">{{ error }}</p>
      <p v-if="status" role="status">{{ status }}</p>
      <p v-if="preview?.costPreviewNotice" role="status">{{ preview.costPreviewNotice }}</p>
      <table v-if="preview" aria-label="联动成本试算">
        <thead><tr><th scope="col">费用（元）</th><th scope="col">保存金额</th><th scope="col">{{ preview.period }} 试算</th></tr></thead>
        <tbody><tr v-for="row in preview.costs" :key="row.code"><th scope="row">{{ row.label }}</th><td>{{ row.saved }}</td><td>{{ row.proposed }}</td></tr></tbody>
      </table>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchCmsCostPeriod, saveCmsCostPeriod } from '../api/costRunDetail'
import { cmsSourcePeriods } from '../utils/cmsCostSourceDisplay'

const props = defineProps({
  costRunNo: { type: String, required: true },
  costCode: { type: String, required: true },
  costName: { type: String, default: 'CMS 费用' },
})
const emit = defineEmits(['preview', 'cost-saved'])
const source = ref(null)
const period = ref('')
const preview = ref(null)
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const error = ref('')
const status = ref('')
let requestId = 0

const title = computed(() => `${props.costCode === 'DIRECT_LABOR' ? '直接人工' : (source.value?.expenseName || props.costName)}采用期间`)
const months = computed(() => source.value
  ? cmsSourcePeriods(source.value.costYear, source.value.latestMonth ?? 12)
  : [])
const canSave = computed(() => Boolean(period.value && !loading.value && !saving.value && !error.value &&
  (period.value === source.value?.currentPeriod || preview.value?.period === period.value)))

function setPreview(result) {
  preview.value = result
  emit('preview', result)
}

async function loadSource() {
  const id = ++requestId
  source.value = null
  period.value = ''
  setPreview(null)
  loadError.value = ''
  error.value = ''
  loading.value = true
  try {
    const result = await fetchCmsCostPeriod(props.costRunNo, props.costCode)
    if (id !== requestId) return
    source.value = result?.source || null
    const currentPeriod = source.value?.currentPeriod
    period.value = months.value.includes(currentPeriod) ? currentPeriod : ''
  } catch (failure) {
    if (id === requestId) loadError.value = failure.message || '无法读取 CMS 生效期间'
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function loadPreview() {
  const id = ++requestId
  setPreview(null)
  error.value = ''
  status.value = ''
  if (!period.value || period.value === source.value?.currentPeriod) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await fetchCmsCostPeriod(props.costRunNo, props.costCode, period.value)
    if (id !== requestId) return
    if (!result) throw new Error('成本版本已更新，请打开最新成本后重试')
    if (source.value.currentPeriod !== result.source.currentPeriod) {
      status.value = `当前生效期间已变为 ${result.source.currentPeriod || '待指定'}，请按最新期间确认。`
    }
    source.value = result.source
    setPreview(result.preview)
  } catch (failure) {
    if (id === requestId) error.value = failure.message || '无法试算所选期间'
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function save() {
  if (!canSave.value) return
  const id = ++requestId
  const expectedPeriod = source.value.currentPeriod
  const selected = period.value
  const token = preview.value?.token
  const name = source.value.expenseName || props.costName
  saving.value = true
  try {
    if (selected !== expectedPeriod) {
      await ElMessageBox.confirm(
        `${name}生效期间将从 ${expectedPeriod || '待指定'} 切换至 ${selected}。后续报价核算和补录参考将使用新期间。`,
        `确认切换${name}期间`, { confirmButtonText: '确认保存', cancelButtonText: '取消', type: 'warning' },
      )
    }
    if (id !== requestId) return
    status.value = selected !== expectedPeriod ? '正在保存采用期间并重新核算…' : ''
    const result = await saveCmsCostPeriod(props.costRunNo, props.costCode, { period: selected, expectedPeriod, previewToken: token })
    if (id !== requestId) return
    source.value = result.source
    if (!result.changed) {
      status.value = '当前已采用该期间，无需更新。'
      return
    }
    const costing = result.costing
    status.value = `${name}已切换至 ${selected}。`
    if (costing?.pipelineStatus === 'SUCCESS' && costing.costVersionId) {
      status.value += `本单已生成成本版本 ${costing.versionNo}。`
      ElMessage.success(status.value)
      emit('cost-saved', costing)
    } else if (result.costingMessage) {
      status.value += `本单核算提示：${result.costingMessage}`
    }
  } catch (failure) {
    if (id !== requestId || failure === 'cancel' || failure === 'close') return
    const message = failure.message || 'CMS 期间保存失败'
    await loadSource()
    status.value = message
  } finally {
    saving.value = false
  }
}

watch(() => [props.costRunNo, props.costCode], loadSource, { immediate: true })
onBeforeUnmount(() => { requestId++ })
</script>

<style scoped>
.labor-period { margin: 12px 0 18px; padding: 12px; background: white; border: 1px solid #cbd9e6; border-radius: 4px; }
.period-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; font-size: 13px; }
select, button { padding: 6px 9px; border: 1px solid #a9bacc; border-radius: 4px; background: white; }
button:enabled { color: #2465a2; cursor: pointer; }
p { font-size: 13px; }
.period-error { color: #a12828; }
table { width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
th, td { padding: 5px 8px; border-bottom: 1px solid #dce6ef; text-align: right; }
th:first-child { text-align: left; }
</style>
