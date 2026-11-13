<template>
  <el-select v-if="visible" :model-value="node.effectiveMaterialShape" size="small"
    class="material-shape-selector" :disabled="disabled" :aria-label="`${node.materialCode} 本次报价形态`"
    @click.stop @change="value => emit('change', node, value === 'DEFAULT' ? null : value)">
    <el-option v-for="shape in options" :key="shape" :value="shape" :label="labels[shape]" />
    <el-option value="DEFAULT" label="恢复BOM默认形态" />
  </el-select>
</template>
<script setup>
import { computed } from 'vue'
import { canAdjustMaterialShape, isOriginalManufactured } from '../utils/quotationMaterialShapes'
const props = defineProps({ node: { type: Object, required: true }, disabled: Boolean })
const emit = defineEmits(['change'])
const labels = { MANUFACTURE: '自制件', PURCHASE: '采购件', OUTSOURCE: '委外加工件' }
const options = computed(() => isOriginalManufactured(props.node)
  ? ['MANUFACTURE', 'PURCHASE', 'OUTSOURCE'] : ['PURCHASE', 'OUTSOURCE'])
const visible = computed(() => canAdjustMaterialShape(props.node))
</script>
<style scoped>
.material-shape-selector { width: 160px; margin-left: 8px; }
</style>
