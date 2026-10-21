<template>
  <el-dialog :model-value="modelValue" title="导入废料价格" width="900px" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @update:model-value="$emit('update:modelValue', $event)">
    <el-form :inline="true">
      <el-form-item label="价格月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" format="YYYY-MM" :clearable="false" :disabled="busy" style="width: 140px" /></el-form-item>
      <el-form-item label="Excel 文件">
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" :disabled="busy" :on-change="chooseFile"><el-button :disabled="busy">选择文件</el-button></el-upload>
        <span class="filename">{{ file?.name || '未选择文件' }}</span>
      </el-form-item>
      <el-form-item><el-button :disabled="!file || !month || busy" :loading="previewing" @click="previewFile">预览</el-button></el-form-item>
    </el-form>
    <p class="hint">可直接上传原始工作簿。同月同料号、同供应商有变化时更新，内容未变则跳过。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="preview">
      <p class="summary">新增 {{ preview.inserted }} 条 · 更新 {{ preview.updated }} 条 · 未变 {{ preview.unchanged }} 条<span v-if="preview.duplicates"> · 合并重复 {{ preview.duplicates }} 条</span> · 错误 {{ preview.errors.length }} 条</p>
      <el-table v-if="preview.errors.length" :data="preview.errors" max-height="180" class="errors">
        <el-table-column prop="row" label="Excel 行" width="90" /><el-table-column prop="materialCode" label="料号" width="140" /><el-table-column prop="message" label="错误原因" />
      </el-table>
      <el-table :data="preview.rows" max-height="400" stripe>
        <el-table-column prop="row" label="Excel 行" width="85" />
        <el-table-column label="处理" width="70"><template #default="{ row }">{{ actionLabel(row.action) }}</template></el-table-column>
        <el-table-column prop="rule.materialCode" label="料号" width="125" /><el-table-column prop="rule.materialName" label="名称" min-width="190" />
        <el-table-column label="供应商" min-width="110"><template #default="{ row }">{{ row.rule.supplierName || row.rule.supplierCode || '—' }}</template></el-table-column>
        <el-table-column label="类型" width="75"><template #default="{ row }">{{ typeLabel(row.rule.priceType) }}</template></el-table-column>
        <el-table-column label="固定金额 / 公式" min-width="170"><template #default="{ row }">{{ row.rule.priceType === 'FIXED' ? displayPrice(row.rule.fixedPrice) : row.rule.expression }}</template></el-table-column>
      </el-table>
    </template>
    <template #footer><el-button :disabled="busy" @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="importing" :disabled="!canConfirm" @click="confirmImport">确认导入</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { previewScrapPrices, importScrapPrices } from '../../api/scrapPrices'
import { actionLabel, displayPrice, typeLabel, importCanConfirm } from '../../pages/scrapPriceUtils.js'

const props = defineProps({ modelValue: Boolean, priceMonth: String })
const emit = defineEmits(['update:modelValue', 'imported'])
const month = ref(''), file = ref(null), preview = ref(null), error = ref(''), previewing = ref(false), importing = ref(false)
const busy = computed(() => previewing.value || importing.value)
const canConfirm = computed(() => importCanConfirm(preview.value, file.value, month.value, busy.value))
watch(() => props.modelValue, (open) => {
  if (open) { month.value = props.priceMonth; file.value = null; preview.value = null; error.value = '' }
})
watch(month, () => { preview.value = null; error.value = '' })
function chooseFile(upload) { file.value = upload.raw; preview.value = null; error.value = '' }
async function previewFile() {
  if (busy.value || !file.value || !month.value) return
  previewing.value = true; preview.value = null; error.value = ''
  try { preview.value = await previewScrapPrices(file.value, month.value) }
  catch (failure) { error.value = failure.message }
  finally { previewing.value = false }
}
async function confirmImport() {
  if (!canConfirm.value) return
  importing.value = true; error.value = ''
  try {
    const result = await importScrapPrices(file.value, month.value, preview.value.previewFingerprint)
    ElMessage.success(`导入完成：新增 ${result.inserted} 条，更新 ${result.updated} 条，未变 ${result.unchanged} 条`)
    emit('imported', result.priceMonth)
    emit('update:modelValue', false)
  } catch (failure) { error.value = failure.message; preview.value = null }
  finally { importing.value = false }
}
</script>

<style scoped>
.filename { margin-left: 10px; max-width: 330px; overflow-wrap: anywhere; }
.hint { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
.summary { font-size: 14px; margin: 16px 0 10px; }
.errors { margin-bottom: 16px; }
</style>
