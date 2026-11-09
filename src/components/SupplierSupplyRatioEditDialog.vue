<template>
  <el-dialog v-model="visible" title="编辑供货比例" width="560px"
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
    <el-form label-width="100px" @submit.prevent="save">
      <el-form-item label="物料">{{ row?.materialCode }} · {{ row?.materialName }}</el-form-item>
      <el-form-item label="供应商">{{ row?.supplierName }} {{ row?.supplierCode || '' }}</el-form-item>
      <el-form-item label="供货比例">
        <el-input v-model="form.percent" :disabled="saving" placeholder="留空表示未填写" aria-label="供货比例百分数">
          <template #append>%</template>
        </el-input>
      </el-form-item>
      <el-form-item label="取价规则">
        <el-input v-model="form.selectionRule" :disabled="saving" maxlength="255"
          placeholder="例如：无供货比例取最高价" aria-label="取价规则" />
      </el-form-item>
      <el-alert title="0%表示退出供货；留空表示未填写。保存后保留变更记录，已采用的月价和历史成本保持不变。"
        type="info" :closable="false" show-icon />
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateSupplierSupplyRatio } from '../api/supplierSupplyRatios'
import { supplierRatioFromPercent, supplierRatioPercentInput } from '../utils/supplierSupplyRatio'

const props = defineProps({ modelValue: Boolean, row: Object })
const emit = defineEmits(['update:modelValue', 'saved'])
const visible = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })
const form = reactive({ percent: '', selectionRule: '' })
const saving = ref(false)
watch(() => props.modelValue, (open) => {
  if (open) Object.assign(form, {
    percent: supplierRatioPercentInput(props.row?.supplyRatio),
    selectionRule: props.row?.selectionRule || '',
  })
})
async function save() {
  if (saving.value || !props.row?.id) return
  try {
    const supplyRatio = supplierRatioFromPercent(form.percent)
    saving.value = true
    await updateSupplierSupplyRatio(props.row.id, {
      supplyRatio, selectionRule: form.selectionRule.trim() || null,
    })
    ElMessage.success('供货比例已保存')
    visible.value = false
    emit('saved')
  } catch (error) {
    ElMessage.error(error.message || '供货比例保存失败')
  } finally { saving.value = false }
}
</script>
