<template>
  <el-dialog :model-value="modelValue" title="编辑废料价格" width="650px" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="$emit('update:modelValue', $event)">
    <el-form v-if="form" label-width="110px" :disabled="saving" @submit.prevent="save">
      <el-form-item label="价格月份">{{ record.priceMonth }}</el-form-item>
      <el-form-item label="料号">{{ record.materialCode }}</el-form-item>
      <el-form-item label="名称" required><el-input v-model="form.materialName" maxlength="255" /></el-form-item>
      <el-form-item label="规格"><el-input v-model="form.specification" maxlength="512" /></el-form-item>
      <el-form-item label="供应商代码"><el-input v-model="form.supplierCode" placeholder="选填" maxlength="64" /></el-form-item>
      <el-form-item label="供应商名称"><el-input v-model="form.supplierName" placeholder="选填" maxlength="255" /></el-form-item>
      <el-form-item label="价格类型" required><el-radio-group v-model="form.priceType"><el-radio value="FIXED">固定价</el-radio><el-radio value="LINKED">联动价</el-radio></el-radio-group></el-form-item>
      <el-form-item v-if="form.priceType === 'FIXED'" label="不含税金额" required><el-input v-model="form.fixedPrice" inputmode="decimal"><template #append>元 / 公斤</template></el-input></el-form-item>
      <template v-else>
        <el-form-item label="计算公式" required><el-input v-model="form.expression" type="textarea" :rows="2" placeholder="例如：[Cu]*0.982/1.13" /></el-form-item>
        <el-form-item label="商用基价" required>
          <div class="bindings">
            <div v-for="(binding, index) in form.bindings" :key="index" class="binding-row">
              <el-input v-model="binding.variable" :aria-label="`变量名称 ${index + 1}`" placeholder="变量名，如 Cu" style="width: 145px" />
              <el-select v-model="binding.factor" :aria-label="`对应基价 ${index + 1}`" placeholder="选择基价" style="flex: 1"><el-option v-for="factor in scrapFactors" :key="factor.value" :value="factor.value" :label="factor.label" /></el-select>
              <el-button link type="danger" :aria-label="`删除变量 ${index + 1}`" @click="form.bindings.splice(index, 1)">删除</el-button>
            </div>
            <el-button link type="primary" @click="form.bindings.push({ variable: '', factor: '' })">添加变量</el-button>
            <p class="hint">公式用 [变量名] 引用商用含税基价，计算结果为不含税元/公斤。</p>
          </div>
        </el-form-item>
      </template>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template #footer><el-button :disabled="saving" @click="$emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { editScrapPrice } from '../../api/scrapPrices'
import { scrapEditForm, scrapEditPayload, scrapFactors } from '../../pages/scrapPriceUtils.js'
const props = defineProps({ modelValue: Boolean, record: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue', 'saved'])
const form = ref(null), saving = ref(false), error = ref('')
watch(() => props.modelValue, (open) => {
  if (!open) return
  error.value = ''
  try { form.value = scrapEditForm(props.record) }
  catch { form.value = null; error.value = '价格资料无法读取，请刷新后重试' }
}, { immediate: true })
async function save() {
  if (saving.value || !form.value) return
  saving.value = true; error.value = ''
  try {
    await editScrapPrice(props.record.id, scrapEditPayload(props.record, form.value))
    ElMessage.success('废料价格已保存')
    emit('saved'); emit('update:modelValue', false)
  } catch (failure) { error.value = failure.message }
  finally { saving.value = false }
}
</script>

<style scoped>
.bindings { width: 100%; }
.binding-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.hint { color: #6b7280; font-size: 12px; line-height: 1.6; margin: 8px 0 0; }
</style>
