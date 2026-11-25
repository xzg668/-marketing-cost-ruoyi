<template>
  <el-dialog :model-value="true" title="供货比率整组失效" width="680px"
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" @close="$emit('close')">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form-item label="物料组">
      <el-select v-model="code" :disabled="saving" filterable placeholder="请选择料号">
        <el-option v-for="group in groups" :key="group.materialCode" :value="group.materialCode"
          :label="[group.materialCode, group.materialName, group.specModel].filter(Boolean).join(' / ')" />
      </el-select>
    </el-form-item>
    <p v-if="!loading && !groups.length && !error">没有匹配的当前物料组</p>
    <template v-if="code">
      <p>确认后，该料号下列 {{ rows.length }} 条当前供应商比例将停止参与后续取价。</p>
      <el-table v-loading="loading" :data="rows" max-height="420" border>
        <el-table-column prop="supplierCode" label="供应商代码" width="130" />
        <el-table-column prop="supplierName" label="供应商" />
        <el-table-column label="供货比例" width="125">
          <template #default="{ row }">{{ formatPercent(row.supplyRatio) }}</template>
        </el-table-column>
      </el-table>
    </template>
    <template #footer>
      <el-button :disabled="saving" @click="$emit('close')">取消</el-button>
      <el-button type="danger" :loading="saving" :disabled="loading || !rows.length"
        @click="withdraw">确认整组失效</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchRatioGroups, fetchRatioGroup, voidRatioGroup } from '../api/supplierSupplyRatios.js'
import { formatPercent } from '../utils/supplierSupplyRatio.js'

const props = defineProps({ filters: { type: Object, required: true } })
const emit = defineEmits(['close', 'withdrawn'])
const groups = ref([]), rows = ref([]), code = ref(''), error = ref('')
const loading = ref(true), saving = ref(false)
let sequence = 0, alive = true

onMounted(async () => {
  try {
    groups.value = await fetchRatioGroups(props.filters)
    if (groups.value.length === 1) code.value = groups.value[0].materialCode
  } catch (failure) { error.value = failure.message || '无法查询物料组' }
  finally { loading.value = false }
})

watch(code, async value => {
  const ticket = ++sequence
  rows.value = []
  error.value = ''
  if (!value) return
  loading.value = true
  try {
    const found = await fetchRatioGroup(value)
    if (alive && ticket === sequence) rows.value = found
  } catch (failure) {
    if (alive && ticket === sequence) error.value = failure.message || '无法读取该组供应商'
  } finally {
    if (alive && ticket === sequence) loading.value = false
  }
})

async function withdraw() {
  if (loading.value || saving.value || !rows.value.length) return
  saving.value = true
  try {
    const updated = await voidRatioGroup(code.value, rows.value.map(row => row.id))
    ElMessage.success(`已失效 ${updated.voidedRows} 条当前比例`)
    emit('withdrawn')
  } catch (failure) {
    error.value = failure.message || '整组失效失败，请重新查询'
    rows.value = []
  } finally { saving.value = false }
}

onBeforeUnmount(() => { alive = false })
</script>
