<template>
  <el-drawer :model-value="modelValue" title="计算追溯与试算" size="min(960px, 96vw)" destroy-on-close @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading" class="make-trace">
      <el-alert v-if="error" :title="error" type="warning" :closable="false" />
      <template v-if="baseline">
        <div class="trace-title"><strong>{{ baseline.materialNo }} {{ baseline.materialName }}</strong><span>{{ baseline.month }}</span></div>
        <div class="trial-input">
          <div><label for="make-trial-cu">Cu 铜价（含税元/吨）</label><p>原铜价：{{ amount(baseline.financeCopperPerTon, 3) }} 元/吨</p></div>
          <el-input id="make-trial-cu" v-model="copper" inputmode="decimal" placeholder="输入试算铜价" :disabled="!baseline.trialAvailable" @input="invalidate" @keyup.enter="calculate" />
          <el-button type="primary" :disabled="!baseline.trialAvailable" :loading="calculating" @click="calculate">试算</el-button>
          <el-button @click="reset">还原</el-button>
        </div>
        <p class="trace-note">仅试算，不修改正式价格。下列单价和金额均不含税。</p>
        <el-alert v-if="baseline.message" :title="baseline.message" type="info" :closable="false" />
        <div class="price-summary">
          <div><span>原价（元/件）</span><strong>{{ amount(baseline.originalPrice) }}</strong></div>
          <div><span>试算价（元/件）</span><strong>{{ result ? amount(result.trialPrice) : '—' }}</strong></div>
          <div><span>价差（元/件）</span><strong :class="differenceClass(result?.difference)">{{ result ? signedAmount(result.difference) : '—' }}</strong></div>
        </div>
        <p v-if="result" class="trial-conclusion">Cu 调为 {{ amount(result.trialCopperPerTon, 3) }} 元/吨，自制件单价为 <strong>{{ amount(result.trialPrice) }}</strong> 元/件，{{ differenceSentence(result.difference) }}。</p>
        <p v-else-if="baseline.trialAvailable" class="trace-note">输入铜价后点“试算”，查看变化。</p>
        <section v-for="(line, index) in shownLines" :key="line.id" class="trace-line">
          <h3>{{ shownLines.length > 1 ? `明细 ${index + 1} · ` : '' }}{{ line.process }}</h3>
          <div class="weight-line">
            <span>原料用量 {{ amount(line.rawQuantity, 8) }} {{ line.rawQuantityUnit }}</span>
            <span v-if="line.grossWeightG != null">毛重 {{ amount(line.grossWeightG, 6) }} 克</span>
            <span v-if="line.netWeightG != null">净重 {{ amount(line.netWeightG, 6) }} 克</span>
            <span>废料 {{ amount(line.scrapWeightG, 6) }} 克</span>
          </div>
          <div v-for="part in [{ key: 'raw', label: '原料单价' }, { key: 'scrap', label: '废料回收单价' }]" :key="part.key" class="source-block">
            <div class="source-heading"><strong>{{ part.label }}</strong><span>{{ line[part.key].materialNo }} {{ line[part.key].materialName }}</span><el-tag size="small" :type="line[part.key].copperLinked ? 'primary' : 'info'">{{ line[part.key].copperLinked ? '随 Cu 联动' : '不随 Cu 变化' }}</el-tag></div>
            <p class="formula">{{ line[part.key].formula }}</p>
            <table v-if="line[part.key].factors?.length" class="factor-table"><thead><tr><th>影响因素（含税）</th><th>原值</th><th v-if="result">试算值</th></tr></thead><tbody><tr v-for="(factor, factorIndex) in line[part.key].factors" :key="factorIndex"><td>{{ factor.name }}（{{ factor.unit }}）</td><td>{{ amount(factor.original, 8) }}</td><td v-if="result">{{ amount(factor.trial, 8) }}</td></tr></tbody></table>
            <p class="calculation"><span>原价：</span>{{ line[part.key].originalCalculation }} = <strong>{{ amount(line[part.key].originalPrice, 8) }}</strong> {{ line[part.key].unit }}</p>
            <p v-if="result" class="calculation"><span>试算：</span>{{ line[part.key].trialCalculation }} = <strong>{{ amount(line[part.key].trialPrice, 8) }}</strong> {{ line[part.key].unit }}</p>
          </div>
          <table class="amount-table"><thead><tr><th>单件金额（元）</th><th>原金额</th><th v-if="result">试算金额</th></tr></thead><tbody>
            <tr><td>原料金额</td><td>{{ amount(line.rawAmount, 8) }}</td><td v-if="result">{{ amount(line.trialRawAmount, 8) }}</td></tr>
            <tr><td>减：废料回收</td><td>{{ amount(line.scrapAmount, 8) }}</td><td v-if="result">{{ amount(line.trialScrapAmount, 8) }}</td></tr>
            <tr class="total-row"><td>本项净成本</td><td>{{ amount(line.cost, 8) }}</td><td v-if="result">{{ amount(line.trialCost, 8) }}</td></tr>
          </tbody></table>
          <p class="cost-formula">原价：{{ amount(line.rawQuantity, 8) }} {{ line.rawQuantityUnit }} × {{ amount(line.raw.originalPrice, 8) }} 元/{{ line.rawQuantityUnit }} − {{ amount(line.scrapWeightG, 6) }} 克 ÷ 1000 × {{ amount(line.scrap.originalPrice, 8) }} 元/千克 = <strong>{{ amount(line.cost, 8) }} 元/件</strong></p>
          <p v-if="result" class="cost-formula">试算：{{ amount(line.rawQuantity, 8) }} {{ line.rawQuantityUnit }} × {{ amount(line.raw.trialPrice, 8) }} 元/{{ line.rawQuantityUnit }} − {{ amount(line.scrapWeightG, 6) }} 克 ÷ 1000 × {{ amount(line.scrap.trialPrice, 8) }} 元/千克 = <strong>{{ amount(line.trialCost, 8) }} 元/件</strong></p>
        </section>
        <p v-if="shownLines.length > 1" class="trace-note">自制件单价为以上 {{ shownLines.length }} 项净成本之和。</p>
        <el-collapse v-if="shownLines.length" class="source-details"><el-collapse-item title="来源明细" name="source"><div v-for="line in shownLines" :key="line.id"><p v-for="part in ['raw', 'scrap']" :key="part">{{ line[part].materialNo }} {{ line[part].supplier || '' }} {{ line[part].file || '' }} {{ line[part].location || '' }}</p></div></el-collapse-item></el-collapse>
      </template>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchMakePartPriceTrace, trialMakePartPrice } from '../api/makePartPriceCalc.js'
import { amount, signedAmount, differenceClass, differenceSentence, copperTrialPayload } from './makePartPriceTrial.js'
const props = defineProps({ modelValue: Boolean, rowId: [Number, String] })
const emit = defineEmits(['update:modelValue'])
const baseline = ref(null), result = ref(null), copper = ref(''), error = ref(''), loading = ref(false), calculating = ref(false)
const shownLines = computed(() => (result.value || baseline.value)?.lines || [])
let sequence = 0
const invalidate = () => { sequence++; result.value = null; calculating.value = false; error.value = '' }
const reset = () => { invalidate(); copper.value = baseline.value?.financeCopperPerTon || '' }
watch(() => [props.modelValue, props.rowId], async ([visible, id]) => {
  const current = ++sequence
  baseline.value = null; result.value = null; error.value = ''; copper.value = ''; calculating.value = false; loading.value = false
  if (!visible || !id) return
  loading.value = true
  try {
    const value = await fetchMakePartPriceTrace(id)
    if (current !== sequence) return
    baseline.value = value; copper.value = value.financeCopperPerTon || ''
  } catch (failure) { if (current === sequence) error.value = failure?.message || '读取计算依据失败' }
  finally { if (current === sequence) loading.value = false }
}, { immediate: true })
const calculate = async () => {
  if (!baseline.value?.trialAvailable || calculating.value) return
  const current = ++sequence
  result.value = null; error.value = ''
  try {
    const payload = copperTrialPayload(baseline.value, copper.value)
    calculating.value = true
    const value = await trialMakePartPrice(props.rowId, payload)
    if (current === sequence) result.value = value
  } catch (failure) { if (current === sequence) error.value = failure?.message || '试算失败' }
  finally { if (current === sequence) calculating.value = false }
}
onBeforeUnmount(() => { sequence++ })
</script>

<style scoped>
.make-trace { color: #303133; min-height: 180px; }
.trace-title { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
.trace-title strong { font-size: 20px; }
.trace-title span, .trace-note, .trial-input p { color: #737985; font-size: 13px; }
.trial-input { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.trial-input label { font-weight: 600; }
.trial-input p { margin: 5px 0 0; }
.trial-input .el-input { width: 210px; }
.price-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px 0; border-bottom: 1px solid #e4e7ed; }
.price-summary span { display: block; color: #737985; font-size: 13px; margin-bottom: 8px; }
.price-summary strong { font-size: 25px; font-variant-numeric: tabular-nums; }
.trial-conclusion { line-height: 1.8; }
.trace-line { padding: 12px 0 20px; border-bottom: 1px solid #e4e7ed; }
.trace-line h3 { font-size: 16px; margin: 12px 0; }
.weight-line { display: flex; flex-wrap: wrap; gap: 8px 20px; color: #606266; font-size: 13px; }
.source-block { padding: 16px 0 0; }
.source-heading { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
.source-heading > span { color: #606266; font-size: 13px; }
.formula, .calculation, .cost-formula { line-height: 1.8; overflow-wrap: anywhere; font-size: 14px; margin: 8px 0; }
.calculation > span { color: #606266; }
.factor-table, .amount-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 10px 0; }
th, td { padding: 9px 12px; text-align: right; border-bottom: 1px solid #ebeef5; font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
th { color: #606266; background: #f7f8fa; font-weight: 500; }
.total-row { font-weight: 600; }
.source-details { margin-top: 16px; color: #606266; }
.price-up { color: #c45656; } .price-down { color: #38834a; }
@media (max-width: 600px) { .price-summary { gap: 10px; } .price-summary strong { font-size: 20px; } .trial-input .el-input { width: 170px; } }
</style>
