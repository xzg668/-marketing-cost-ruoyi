<template>
  <el-dialog :model-value="modelValue" :title="record ? '编辑型号材质' : '新增型号材质'" width="560px" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="$emit('update:modelValue', $event)">
    <el-form label-width="100px" :disabled="saving" @submit.prevent="save">
      <el-form-item label="产品型号" required><el-input v-model="form.model" aria-label="维护产品型号" placeholder="完整型号" /></el-form-item>
      <el-form-item label="板片材质" required>
        <el-select v-model="form.plateMaterial" aria-label="维护板片材质" placeholder="请选择板片材质" style="width: 100%">
          <el-option v-for="option in options" :key="option" :label="option" :value="option" />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <p v-if="conflict" class="hint">本次输入已保留。请关闭后查询最新配置，再重新编辑确认。</p>
    <template #footer><el-button :disabled="saving" @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="conflict" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPlateMaterialMapping, updatePlateMaterialMapping } from '../../api/plateMaterialMappings'
import { mappingPayload } from '../../pages/plateMaterialMappingUtils.js'
const props = defineProps({ modelValue: Boolean, record: Object, options: { type: Array, required: true } })
const emit = defineEmits(['update:modelValue', 'saved'])
const form = reactive({ model: '', plateMaterial: '' }), saving = ref(false), error = ref(''), conflict = ref(false)
watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(form, { model: props.record?.normalizedModel || '', plateMaterial: props.record?.plateMaterial || '' })
  error.value = ''; conflict.value = false
})
async function save() {
  if (saving.value || conflict.value) return
  saving.value = true; error.value = ''
  try {
    const body = mappingPayload(form, props.record, props.options)
    if (props.record) await updatePlateMaterialMapping(props.record.id, body)
    else await createPlateMaterialMapping(body)
    ElMessage.success('型号材质已保存')
    emit('saved'); emit('update:modelValue', false)
  } catch (failure) {
    error.value = failure.message
    // A duplicate new model can be corrected in place; a stale edit needs a fresh record.
    conflict.value = Boolean(props.record && failure.resultCode === 409)
  } finally { saving.value = false }
}
</script>

<style scoped>
.hint { color: #6b7280; line-height: 1.6; }
</style>
