<template>
  <el-dialog :model-value="true" :title="`${moduleName(moduleType)}填写页（只读）`" width="1100px" top="5vh" destroy-on-close @close="$emit('close')">
    <p>{{ row.product.materialNo || row.product.sourceModel }} · {{ row.product.productName }} · {{ row.accountingMonth }}</p>
    <p>{{ row.oaNo }}</p>
    <TechnicalDataEntryPreview :row="row" :module-type="moduleType" />
    <template #footer><el-button @click="$emit('close')">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { moduleName } from '../../utils/technicalDataWorkbench'
import TechnicalDataEntryPreview from './TechnicalDataEntryPreview.vue'
defineProps({ row: { type: Object, required: true }, moduleType: { type: String, required: true } })
defineEmits(['close'])
</script>

<style scoped>
p { color: #637085; }
</style>
