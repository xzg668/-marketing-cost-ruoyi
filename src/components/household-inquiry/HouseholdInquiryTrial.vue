<template>
  <el-drawer v-model="visible" title="家用询价试算" size="min(1000px, 96vw)" destroy-on-close>
    <p v-if="entry">{{ entry.materialCode || entry.specification }} · {{ entry.materialName }} · {{ entry.specification }}</p>
    <el-form label-position="top" inline @submit.prevent="calculate">
      <el-form-item label="适用月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="resetMonth" /></el-form-item>
      <el-form-item label="客户 Cu（含税元/吨）"><el-input v-model="copper" placeholder="留空沿用商用基价" inputmode="decimal" aria-label="客户Cu试算值" @input="changed" @keyup.enter="calculate" /></el-form-item>
      <el-form-item label="客户 Zn（含税元/吨）"><el-input v-model="zinc" placeholder="留空沿用商用基价" inputmode="decimal" aria-label="客户Zn试算值" @input="changed" @keyup.enter="calculate" /></el-form-item>
      <el-form-item label=" "><el-button type="primary" :loading="loading" @click="calculate">试算</el-button></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="dirty && result" title="条件已修改，请重新试算。" type="warning" :closable="false" />
    <section v-if="result && !dirty" aria-label="家用询价试算结果">
      <p>询价来源 {{ result.source.sourceMonth }} · V{{ result.source.revisionNo }}；商用基价来源 {{ result.financeMonth || '无需铜锌基价' }}<span v-if="result.schemeCode"> · {{ result.schemeCode }}</span></p>
      <el-table :data="result.factors" border>
        <el-table-column prop="name" label="因素" width="100" />
        <el-table-column prop="weightGrams" label="原询价重量（克）" min-width="160" />
        <el-table-column label="商用基价（含税元/吨）" min-width="180"><template #default="{ row }">{{ row.basePerTon ?? '—' }}</template></el-table-column>
        <el-table-column label="本次价格（含税元/吨）" min-width="180"><template #default="{ row }">{{ row.customerPerTon ?? '—' }}<span v-if="row.customerPerTon"> · {{ row.fromCustomer ? '客户输入' : '沿用基价' }}</span></template></el-table-column>
      </el-table>
      <el-descriptions :column="1" border class="result-summary">
        <el-descriptions-item label="原报价成本 P（不含税元/件）">{{ result.originalPrice }}</el-descriptions-item>
        <el-descriptions-item label="铜锌调整后询价 W（不含税元/件）"><strong>{{ result.adjustedPrice }}</strong></el-descriptions-item>
        <el-descriptions-item label="铜锌调整差额（不含税元/件）">{{ result.difference }}</el-descriptions-item>
        <el-descriptions-item label="原两项费用率 H">{{ inquiryPercent(result.source.householdRate) }}</el-descriptions-item>
      </el-descriptions>
      <p class="formula">{{ result.formula }}（公式内金属单价为元/公斤，重量为克）</p>
      <p>这里只试算铜锌调整后的询价。报价成本还会按报价单费用率、BOM用量及产品属性计算；本次试算不会保存或修改价格。</p>
    </section>
  </el-drawer>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { trialHouseholdInquiry } from '../../api/householdInquiries'
import { inquiryPercent, inquiryMessage } from '../../pages/householdInquiryUtils'
const visible = defineModel({ type: Boolean })
const props = defineProps({ entry: Object, scope: String, sourceMonth: String })
const month = ref(''), copper = ref(''), zinc = ref(''), loading = ref(false), error = ref(''), result = ref(null), dirty = ref(false)
let generation = 0, alive = true
function customerValue(value, label) {
  const text = value.trim()
  if (!text) return null
  if (!/^\d+(\.\d+)?$/.test(text) || !/[1-9]/.test(text)) throw new Error(`${label}须大于0，未指定请留空`)
  return text
}
async function calculate() {
  if (!visible.value || !props.scope || !props.entry) return
  const current = ++generation, scope = props.scope, id = props.entry.id
  loading.value = true; error.value = ''; dirty.value = true
  const isCurrent = () => alive && current === generation && visible.value && scope === props.scope && id === props.entry?.id
  try {
    const response = await trialHouseholdInquiry(id, { pricingMonth: month.value,
      customerCopperPerTon: customerValue(copper.value, '客户Cu'), customerZincPerTon: customerValue(zinc.value, '客户Zn') })
    if (isCurrent()) { result.value = response; dirty.value = false }
  } catch (failure) { if (isCurrent()) { error.value = inquiryMessage(failure); result.value = null } }
  finally { if (isCurrent()) loading.value = false }
}
function resetMonth() { generation++; result.value = null; calculate() }
function changed() { generation++; dirty.value = true; loading.value = false; error.value = '' }
watch([visible, () => props.entry?.id, () => props.scope, () => props.sourceMonth], ([open]) => {
  generation++; result.value = null; error.value = ''; loading.value = false; dirty.value = false
  copper.value = ''; zinc.value = ''; month.value = props.sourceMonth || props.entry?.sourceMonth || ''
  if (open && props.scope && props.entry) calculate()
}, { immediate: true })
onBeforeUnmount(() => { alive = false; generation++ })
</script>
<style scoped>
.el-alert, .result-summary { margin: 16px 0; } p { color: #606266; line-height: 1.7; }.formula { overflow-wrap: anywhere; }
</style>
