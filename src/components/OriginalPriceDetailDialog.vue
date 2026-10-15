<template>
  <el-dialog :model-value="ruleId != null" title="价格依据" width="1040px" destroy-on-close
    @update:model-value="open => { if (!open) $emit('close') }">
    <div v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="rule">
        <p class="identity">{{ rule.identity.materialCode }} · {{ rule.identity.supplierName }}（{{ rule.identity.supplierCode || '代码未提供' }}） · {{ rule.identity.specification }} · {{ rule.identity.unit }}</p>
        <p class="source">{{ result?.sourceFile || sourceDetail.sourceFile }} · 原稿月份 {{ result?.summary.ruleMonth || sourceDetail.pricingMonth }} · 财务来源 {{ result?.summary.financialSourceMonth || '未取得' }}</p>
        <div class="trial-form">
          <span>财务Cu {{ priceText(result?.summary.financeCopperPerTon) }} 元/吨</span>
          <label for="original-customer-cu">客户Cu</label>
          <el-input id="original-customer-cu" v-model="customerCopper" :disabled="loading" inputmode="decimal" @input="dirty = true">
            <template #append>元/吨</template>
          </el-input>
          <el-button :loading="loading" :disabled="!result" @click="calculate">试算</el-button>
        </div>
        <el-table v-if="result" :data="[result.summary]" class="trial-result" border>
          <el-table-column label="财务未税单价（P0）" align="right"><template #default="{ row }">{{ priceText(row.financePrice) }}</template></el-table-column>
          <el-table-column label="客户未税单价（P1）" align="right"><template #default="{ row }">{{ dirty ? '—' : priceText(row.customerPrice) }}</template></el-table-column>
          <el-table-column :label="`差额（元/${rule.identity.unit}）`" align="right"><template #default="{ row }">{{ dirty ? '—' : priceText(row.difference) }}</template></el-table-column>
        </el-table>
        <p v-if="kind === 'range' && result" class="source">财务档位 {{ rangeText(result.finance.selectedBounds) }} · 客户档位 {{ dirty ? '—' : rangeText(result.customer.selectedBounds) }}</p>
        <template v-if="kind === 'linked'">
          <p class="formula"><span>原稿中文公式</span><span class="formula-text">{{ originalFormulaText(rule.sourceFormulaText) }}</span></p>
          <p class="formula"><span>Excel 计算公式 · {{ rule.sheet }}!{{ rule.cell }}</span><code>{{ rule.sourceFormula }}</code></p>
          <el-table :data="linkedFactors" max-height="300">
            <el-table-column prop="name" label="因素" min-width="140" />
            <el-table-column prop="source" label="原稿来源格" min-width="160" />
            <el-table-column prop="unit" label="单位" width="100" />
            <el-table-column label="原稿值" align="right"><template #default="{ row }">{{ priceText(row.original) }}</template></el-table-column>
            <el-table-column label="财务输入" align="right"><template #default="{ row }">{{ priceText(row.finance) }}</template></el-table-column>
            <el-table-column label="客户输入" align="right"><template #default="{ row }">{{ dirty ? '—' : priceText(row.customer) }}</template></el-table-column>
          </el-table>
          <details class="additional"><summary>计算公式</summary><code>{{ rule.compiled.expression }}</code></details>
        </template>
        <template v-else>
          <p class="source">主表 {{ rule.sheet }} 第 {{ rule.row }} 行 · 区间表 {{ rule.matrixSheet }} 第 {{ rule.matrixRow }} 行 · {{ rule.taxIncluded ? '原格含税' : '原格未税' }}</p>
          <el-table :data="rule.bands" max-height="340">
            <el-table-column label="原始档位" min-width="180"><template #default="{ row }">{{ row.header.rawValue }}</template></el-table-column>
            <el-table-column label="来源格" width="110"><template #default="{ row }">{{ row.address.cell }}</template></el-table-column>
            <el-table-column label="原格单价" width="140" align="right"><template #default="{ row }">{{ priceText(row.price) }}</template></el-table-column>
            <el-table-column label="原始公式" min-width="180" show-overflow-tooltip><template #default="{ row }">{{ row.source?.formula || '—' }}</template></el-table-column>
            <el-table-column prop="problem" label="档位问题" min-width="200" />
          </el-table>
          <p v-if="!dirty && result?.customer.extrapolation" class="source">本次按原稿档差向上推算：Cu每增加 {{ priceText(result.customer.extrapolation.factorStep) }} 元/吨，单价增加 {{ priceText(result.customer.extrapolation.priceStep) }}。</p>
        </template>
      </template>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { trialLinkedOriginal, trialRangeOriginal, fetchLinkedEffectiveDetail, fetchRangeEffectiveDetail } from '../api/originalPriceTrials'
import { fetchLinkedImportBasis } from '../api/priceLinkedItems'
import { fetchRangeOriginal } from '../api/priceRangeItems'
import { priceText, rangeText, originalFormulaText } from './originalPriceDisplay'
const props = defineProps({ ruleId: { type: Number, default: null }, kind: { type: String, required: true }, pricingMonth: { type: String, required: true } })
defineEmits(['close'])
const sourceDetail = ref(null)
const result = ref(null), error = ref(''), loading = ref(false), customerCopper = ref(''), dirty = ref(false)
let generation = 0
const rule = computed(() => props.kind === 'linked' ? result.value?.rule || sourceDetail.value?.rule : result.value?.saved.sources[0] || sourceDetail.value?.saved.sources[0])
const unitLabel = value => ({ CNY_KG: '元/公斤', CNY_TON: '元/吨', CNY_G: '元/克' })[value] || value
const linkedFactors = computed(() => Object.entries(rule.value?.factors || {}).map(([symbol, factor]) => ({
  name: factor.canonicalKey.replace(/^AVG\|/, ''), source: `${factor.address.sheet}!${factor.address.cell}`, unit: unitLabel(factor.unit),
  original: rule.value.compiled.sourceInputs[symbol], finance: result.value?.finance.inputs[symbol], customer: result.value?.customer.inputs[symbol],
})))
const run = async (copper = null) => {
  const current = ++generation
  loading.value = true; error.value = ''
  try {
    const data = copper == null
      ? await (props.kind === 'linked' ? fetchLinkedEffectiveDetail : fetchRangeEffectiveDetail)(props.ruleId, props.pricingMonth)
      : await (props.kind === 'linked' ? trialLinkedOriginal : trialRangeOriginal)(props.ruleId, { pricingMonth: props.pricingMonth, customerCopperPerTon: copper })
    if (generation !== current) return
    result.value = data; customerCopper.value = String(data.summary.customerCopperPerTon); dirty.value = false
  } catch (failure) { if (generation === current) { error.value = failure.message || (copper == null ? '有效价读取失败' : '试算失败'); dirty.value = true } }
  finally { if (generation === current) loading.value = false }
}
const calculate = () => {
  const text = customerCopper.value.trim()
  if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text)) || Number(text) <= 0) { error.value = '客户Cu必须大于0'; dirty.value = true; return }
  run(text)
}
watch(() => [props.ruleId, props.kind, props.pricingMonth], async () => {
  const current = ++generation
  result.value = null; sourceDetail.value = null; error.value = ''; loading.value = false; dirty.value = false; customerCopper.value = ''
  if (props.ruleId == null) return
  loading.value = true
  try {
    const source = props.kind === 'linked' ? await fetchLinkedImportBasis(props.ruleId) : await fetchRangeOriginal(props.ruleId)
    if (current !== generation) return
    sourceDetail.value = props.kind === 'linked'
      ? { rule: JSON.parse(source.sourceInputSnapshotJson).rule, sourceFile: source.sourceFileName, pricingMonth: source.pricingMonth }
      : source
    await run()
  } catch (failure) { if (current === generation) error.value = failure.message || '原稿读取失败' }
  finally { if (current === generation) loading.value = false }
}, { immediate: true })
</script>

<style scoped>
.identity { font-weight: 600; }
.source { color: #606266; line-height: 1.7; }
.trial-form { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
.trial-form > span { margin-right: auto; }
.trial-form .el-input { width: 235px; }
.formula { display: flex; flex-direction: column; gap: 8px; margin-top: 24px; }
code { overflow-wrap: anywhere; white-space: pre-wrap; }
.formula-text { overflow-wrap: anywhere; white-space: pre-wrap; line-height: 1.7; }
.additional { margin-top: 16px; }
.additional summary { cursor: pointer; margin-bottom: 10px; }
</style>
