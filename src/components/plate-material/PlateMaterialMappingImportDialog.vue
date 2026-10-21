<template>
  <el-dialog :model-value="modelValue" title="导入型号—板片材质对照表" width="900px" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @update:model-value="$emit('update:modelValue', $event)">
    <p class="hint">只读取“提供财务”工作表，第 2 行表头为“产品型号”“产品应用材质”。同型号有变化时更新，未变记录及文件外的已有型号保留。</p>
    <div class="file-row">
      <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" :disabled="busy" :on-change="chooseFile"><el-button :disabled="busy">选择文件</el-button></el-upload>
      <span>{{ file?.name || '未选择文件（xlsx，不超过 10 MB）' }}</span>
      <el-button :disabled="!file || busy" :loading="previewing" @click="previewFile">预览</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="preview">
      <p class="summary">新增 {{ preview.inserted }} 条 · 更新 {{ preview.updated }} 条 · 未变 {{ preview.unchanged }} 条 · 合并重复 {{ preview.duplicates.length }} 条 · 错误 {{ preview.errors.length }} 条</p>
      <el-table v-if="preview.errors.length" :data="preview.errors" max-height="180">
        <el-table-column prop="excelRow" label="Excel 原行号" width="120" /><el-table-column prop="message" label="错误原因" />
      </el-table>
      <el-table v-if="preview.duplicates.length" :data="preview.duplicates" max-height="160">
        <el-table-column prop="excelRow" label="重复行号" width="100" /><el-table-column prop="firstExcelRow" label="保留行号" width="100" /><el-table-column prop="model" label="同值合并的型号" />
      </el-table>
      <el-table :data="visibleChanges" max-height="360" stripe>
        <el-table-column prop="excelRow" label="Excel 原行号" width="120" />
        <el-table-column label="处理" width="80"><template #default="{ row }">{{ mappingActionLabel(row.action) }}</template></el-table-column>
        <el-table-column prop="model" label="产品型号" min-width="200" />
        <el-table-column label="原材质" width="145"><template #default="{ row }">{{ row.previousMaterial || '—' }}</template></el-table-column>
        <el-table-column prop="material" label="导入材质" width="145" />
      </el-table>
      <BasePagination :current-page="page" :page-size="size" :total="preview.changes.length" @update:current-page="page = $event" @update:page-size="changeSize" />
    </template>
    <template #footer><el-button :disabled="busy" @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" :disabled="!canConfirm" :loading="importing" @click="confirmImport">确认导入</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../BasePagination.vue'
import { previewPlateMaterialImport, confirmPlateMaterialImport } from '../../api/plateMaterialMappings'
import { canConfirmMappingImport, mappingActionLabel } from '../../pages/plateMaterialMappingUtils.js'
const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'imported'])
const file = ref(null), previewedFile = ref(null), preview = ref(null), error = ref('')
const previewing = ref(false), importing = ref(false), page = ref(1), size = ref(20)
const busy = computed(() => previewing.value || importing.value)
const canConfirm = computed(() => canConfirmMappingImport(preview.value, file.value, previewedFile.value, busy.value))
const visibleChanges = computed(() => preview.value?.changes.slice((page.value - 1) * size.value, page.value * size.value) || [])
watch(() => props.modelValue, (open) => {
  if (open) { file.value = null; previewedFile.value = null; preview.value = null; error.value = ''; page.value = 1 }
})
function chooseFile(upload) {
  preview.value = null; previewedFile.value = null; error.value = ''; file.value = null; page.value = 1
  const selected = upload.raw
  if (!selected || !/\.xlsx$/i.test(selected.name) || !selected.size || selected.size > 10 * 1024 * 1024) {
    error.value = '请上传非空且不超过 10 MB 的 xlsx 文件'
    return
  }
  file.value = selected
}
function changeSize(value) { size.value = value; page.value = 1 }
async function previewFile() {
  if (busy.value || !file.value) return
  previewing.value = true; preview.value = null; previewedFile.value = null; error.value = ''; page.value = 1
  try {
    preview.value = await previewPlateMaterialImport(file.value)
    previewedFile.value = file.value
  } catch (failure) { error.value = failure.message }
  finally { previewing.value = false }
}
async function confirmImport() {
  if (!canConfirm.value) return
  importing.value = true; error.value = ''
  try {
    const result = await confirmPlateMaterialImport(file.value, preview.value.fingerprint)
    ElMessage.success(`导入完成：新增 ${result.inserted} 条，更新 ${result.updated} 条，未变 ${result.unchanged} 条`)
    emit('imported'); emit('update:modelValue', false)
  } catch (failure) {
    error.value = failure.message
    // Never retry a stale/uncertain import silently; obtain another server preview.
    preview.value = null; previewedFile.value = null
  } finally { importing.value = false }
}
</script>

<style scoped>
.hint { color: #6b7280; line-height: 1.7; margin-top: 0; }
.file-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; overflow-wrap: anywhere; }
.summary { margin: 16px 0 10px; }
</style>
