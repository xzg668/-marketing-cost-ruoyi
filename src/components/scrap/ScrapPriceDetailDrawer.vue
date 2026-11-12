<template>
  <el-drawer :model-value="modelValue" :title="record.priceType === 'LINKED' ? '废料价格依据与试算' : '废料价格详情'" :size="record.priceType === 'LINKED' ? 'min(980px, 96vw)' : '620px'" @update:model-value="$emit('update:modelValue', $event)">
    <section v-if="record.priceType === 'LINKED'" class="trial-section" aria-label="废料联动价格试算">
      <p class="trial-identity">{{ record.materialCode }} · {{ record.materialName }} · 不含税元 / 公斤</p>
      <p class="trial-formula">计算公式：{{ record.expression }}</p>
      <p class="trial-note">基价方案 {{ trial?.schemeCode || record.schemeCode || '—' }} · 财务来源 {{ trial?.financeMonth || record.financeMonth || '—' }}</p>
      <el-alert v-if="trialError" :title="trialError" type="error" :closable="false" class="section" />
      <el-table v-if="trial?.factors.length" :data="trial.factors" border>
        <el-table-column prop="variable" label="变量" width="85" />
        <el-table-column prop="name" label="公式影响因素" min-width="135" />
        <el-table-column label="当前基价值（含税元/公斤）" min-width="190" align="right"><template #default="{ row }">{{ displayPrice(row.financeInput) }}</template></el-table-column>
        <el-table-column label="试算值（含税元/公斤）" min-width="215"><template #default="{ row }">
          <el-input v-model="trialInputs[row.variable]" :aria-label="`${row.name}（${row.variable}）试算值`" :disabled="trialLoading" inputmode="decimal" @input="dirty = true" @keyup.enter="calculate" />
        </template></el-table-column>
        <el-table-column prop="source" label="财务来源格" min-width="150" show-overflow-tooltip />
      </el-table>
      <div class="trial-form"><span>修改公式对应的影响因素值后试算，单位为含税元/公斤。</span><el-button :loading="trialLoading" :disabled="!trial" @click="calculate">试算</el-button></div>
      <el-table v-if="trial" :data="[trial]" border class="trial-result">
        <el-table-column label="财务未税单价（P0）" align="right"><template #default="{ row }">{{ displayPrice(row.financePrice) }}</template></el-table-column>
        <el-table-column label="试算未税单价（P1）" align="right"><template #default="{ row }">{{ dirty ? '—' : displayPrice(row.trialPrice) }}</template></el-table-column>
        <el-table-column label="差额（元/公斤）" align="right"><template #default="{ row }">{{ dirty ? '—' : displayPrice(row.difference) }}</template></el-table-column>
      </el-table>
      <p class="trial-note">试算不保存价格。</p>
    </section>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="价格月份">{{ record.priceMonth }}</el-descriptions-item>
      <el-descriptions-item label="料号">{{ record.materialCode }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ record.materialName }}</el-descriptions-item>
      <el-descriptions-item label="规格">{{ record.specification || '—' }}</el-descriptions-item>
      <el-descriptions-item label="供应商代码">{{ record.supplierCode || '—' }}</el-descriptions-item>
      <el-descriptions-item label="供应商名称">{{ record.supplierName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="价格类型">{{ typeLabel(record.priceType) }}</el-descriptions-item>
      <el-descriptions-item label="不含税单价"><span v-if="record.calcStatus === 'READY'">{{ displayPrice(record.unitPrice) }} 元 / 公斤</span><span v-else>{{ calcStatusLabel(record.calcStatus) }}</span></el-descriptions-item>
      <el-descriptions-item label="规则来源月份">{{ record.ruleSourceMonth }}</el-descriptions-item>
      <el-descriptions-item v-if="record.priceType === 'FIXED'" label="固定金额">{{ displayPrice(record.fixedPrice) }} 元 / 公斤</el-descriptions-item>
      <template v-else>
        <el-descriptions-item label="计算公式">{{ record.expression }}</el-descriptions-item>
        <el-descriptions-item label="基价来源">商用财务基价</el-descriptions-item>
        <el-descriptions-item label="基价月份">{{ record.financeMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="基价方案">{{ record.schemeCode || '—' }}</el-descriptions-item>
      </template>
    </el-descriptions>
    <el-alert v-if="record.calcStatus !== 'READY'" :title="record.calcMessage || calcStatusLabel(record.calcStatus)" :type="record.calcStatus === 'WAITING_BASE' ? 'warning' : 'error'" :closable="false" class="section" />
    <template v-if="factors.length && !trial">
      <h3>计算依据</h3>
      <el-table :data="factors" border><el-table-column prop="variable" label="变量" width="95" /><el-table-column prop="name" label="商用基价" /><el-table-column label="含税元 / 公斤" min-width="160"><template #default="{ row }">{{ displayPrice(row.price) }}</template></el-table-column></el-table>
    </template>
    <h3>来源记录</h3>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="维护方式">{{ originLabel }}</el-descriptions-item>
      <el-descriptions-item label="导入文件">{{ record.sourceFileName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="原文件位置">{{ record.sourceSheet || '—' }}<span v-if="record.sourceRow"> · 第 {{ record.sourceRow }} 行</span></el-descriptions-item>
      <el-descriptions-item v-if="record.sourceFormula" label="来源公式">{{ record.sourceFormula }}</el-descriptions-item>
      <el-descriptions-item v-if="source.source" label="来源">{{ source.source }}</el-descriptions-item>
      <el-descriptions-item v-if="source.approvalType" label="批单类型">{{ source.approvalType }}</el-descriptions-item>
      <el-descriptions-item v-if="source.approvalNo" label="批单编号">{{ source.approvalNo }}</el-descriptions-item>
      <el-descriptions-item label="导入时间">{{ record.importedAt || '—' }}</el-descriptions-item>
      <el-descriptions-item label="最后维护">{{ record.updatedBy || '—' }} · {{ record.updatedAt || '—' }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { trialScrapPrice } from '../../api/scrapPrices'
import { calcStatusLabel, displayPrice, scrapFactorDetails, typeLabel, scrapTrialPayload } from '../../pages/scrapPriceUtils.js'
const props = defineProps({ modelValue: Boolean, record: { type: Object, required: true } })
defineEmits(['update:modelValue'])
const factors = computed(() => scrapFactorDetails(props.record))
const source = computed(() => JSON.parse(props.record.sourceJson || '{}'))
const originLabel = computed(() => ({ IMPORT: 'Excel 导入', MANUAL: '手工修改', CARRY_FORWARD: '沿用已有规则' }[props.record.originType] || '—'))
const trial = ref(null), trialInputs = ref({}), dirty = ref(false), trialLoading = ref(false), trialError = ref('')
let generation = 0
async function runTrial(inputs = {}) {
  const current = ++generation
  trialLoading.value = true; trialError.value = ''
  try {
    const result = await trialScrapPrice(props.record.id, { expectedVersion: props.record.rowVersion, inputs })
    if (current !== generation) return
    trial.value = result
    trialInputs.value = Object.fromEntries(result.factors.map(factor => [factor.variable, String(factor.trialInput)]))
    dirty.value = false
  } catch (error) {
    if (current === generation) { trialError.value = error.message || '废料试算失败'; dirty.value = true }
  } finally { if (current === generation) trialLoading.value = false }
}
function calculate() {
  if (trialLoading.value || !trial.value) return
  try { runTrial(scrapTrialPayload(props.record, trialInputs.value).inputs) }
  catch (error) { trialError.value = error.message; dirty.value = true }
}
watch(() => [props.modelValue, props.record.id, props.record.rowVersion], () => {
  generation += 1; trial.value = null; trialError.value = ''; trialLoading.value = false; trialInputs.value = {}; dirty.value = false
  if (props.modelValue && props.record.priceType === 'LINKED' && props.record.calcStatus === 'READY') runTrial()
}, { immediate: true })
onBeforeUnmount(() => { generation += 1 })

</script>

<style scoped>
h3 { font-size: 14px; font-weight: 600; margin: 24px 0 12px; }
.section { margin-top: 16px; }
.trial-section { margin-bottom: 24px; }
.trial-identity { font-weight: 600; }
.trial-form { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:20px 0; }
.trial-form > span { margin-right:auto; }
.trial-form .el-input { width:235px; }
.trial-note { color:#606266; line-height:1.7; }
.trial-formula { overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
:deep(.el-descriptions__content) { overflow-wrap: anywhere; }
</style>
