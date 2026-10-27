<template>
  <el-dialog :model-value="true" title="价格填写页（只读）" width="1100px" top="5vh" @close="$emit('close')">
    <p>{{ row.product.materialNo || row.product.sourceModel }} · {{ row.product.productName }} · {{ row.accountingMonth }}</p>
    <p>{{ row.oaNo }}</p>
    <el-alert title="可以切换查看各类填写方式和字段；填写、保存仍由负责技术员办理。" type="info" :closable="false" />
    <div v-loading="loading" class="preview-content">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <TechnicalDataPriceForm v-else-if="preview" :preview-data="preview" />
    </div>
    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button v-if="error" :loading="loading" @click="load">重试</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { checkQuotePriceSources, fetchQuoteCostingWorkbench } from '../../api/quoteRequests'
import { priceEntryPreview } from '../../utils/technicalDataPrice'
import TechnicalDataPriceForm from './TechnicalDataPriceForm.vue'

const props = defineProps({ row: { type: Object, required: true } })
defineEmits(['close'])
const preview = ref(null), error = ref(''), loading = ref(false)
let generation = 0
async function load() {
  const current = ++generation, row = props.row
  preview.value = null; error.value = ''; loading.value = true
  try {
    const [check, workbench] = await Promise.all([
      checkQuotePriceSources(row.oaNo, row.product.oaFormItemId, { periodMonth: row.accountingMonth, refreshCandidates: true }),
      fetchQuoteCostingWorkbench(row.oaNo, row.product.oaFormItemId),
    ])
    if (current !== generation) return
    if (check?.readiness?.status === 'FAILED') throw new Error(check.readiness.message || '价格检查失败，请重试')
    preview.value = priceEntryPreview(check, workbench)
  } catch (cause) {
    if (current === generation) error.value = cause.message || '价格填写页加载失败，请重试'
  } finally { if (current === generation) loading.value = false }
}
watch(() => props.row, load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
p { color: #637085; }
.preview-content { min-height: 100px; margin-top: 16px; }
</style>
