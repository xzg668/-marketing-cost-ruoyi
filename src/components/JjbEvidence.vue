<template>
  <section class="jjb-evidence" :data-version-id="sheet.identity.versionId">
    <p class="version-identity">保存版本：{{ sheet.identity.versionNo }} · {{ sheet.identity.productCode }} · {{ sheet.identity.pricingMonth }}</p>
    <div class="evidence-totals"><div v-for="total in sheetTotals(sheet)" :key="total.key"><span>{{ total.name }}</span><strong>{{ savedMoney(total.amount) || '历史未记录' }}</strong></div></div>
    <label>核算项目 <select v-model="selectedKey"><option v-for="row in sheet.rows" :key="row.key" :value="row.key">{{ row.name || row.code }}{{ row.kind === 'PART' || row.kind === 'HOUSEHOLD' ? ` · ${row.code}` : '' }}</option></select></label>
    <div v-if="selected" class="saved-evidence" :data-evidence-row="selected.key">
      <h3>{{ selected.name || selected.code }}</h3>
      <dl>
        <dt>本次金额</dt><dd>{{ savedMoney(selected.amount) || '未记录金额' }}</dd>
        <template v-if="selected.unitPrice != null"><dt>{{ selected.kind === 'HOUSEHOLD' ? '询价单价 P' : '单价' }}</dt><dd>{{ selected.unitPrice }}</dd></template>
        <template v-if="selected.quantity != null"><dt>本次用量 Q</dt><dd>{{ selected.quantity }}</dd></template>
        <dt>计量单位</dt><dd>{{ selected.unit || '历史未记录' }}</dd>
        <dt>采用的价格来源</dt><dd>{{ selected.priceSource || '见下方保存依据' }}</dd>
        <template v-if="selected.baseAmount != null"><dt>采用基数</dt><dd>{{ selected.baseAmount }}</dd></template>
        <dt>费用／费率口径</dt><dd>{{ rowBasis(selected) || '历史未记录' }}</dd>
        <template v-if="selected.coefficient != null"><dt>本次属性系数 K</dt><dd>{{ selected.coefficient }}</dd></template>
        <template v-if="selected.paths?.length"><dt>实际计价路径</dt><dd>{{ selected.paths.join('；') }}</dd></template>
        <dt>说明</dt><dd>{{ selected.remark || '' }}</dd>
      </dl>
      <CostAmountComposition v-if="compositionSelector" :cost-run-no="sheet.identity.costRunNo" v-bind="compositionSelector" />
      <article v-for="(line, index) in selected.manufacturing || []" :key="index" class="monthly-evidence" aria-label="制造件计算明细">
        <h4>{{ line.processType || '历史未记录加工方式' }} · {{ line.childMaterialNo }} {{ line.childMaterialName }}</h4>
        <dl>
          <dt>采用单价</dt><dd>{{ line.rawUnitPrice ?? '历史未记录' }} {{ line.rawPriceUnit }}</dd>
          <dt>毛重</dt><dd>{{ grossWeightWithSource(line.grossWeightG, line.grossWeightSource) || '历史未记录' }} g</dd>
          <dt>净重</dt><dd>{{ line.netWeightG ?? '历史未记录' }} g</dd>
          <dt>废料重量</dt><dd>{{ line.scrapWeightKg ?? '历史未记录' }} kg</dd>
          <dt>废料</dt><dd>{{ line.scrapCode || '无废料／历史未记录' }} {{ line.scrapName }}</dd>
          <dt>废料单价</dt><dd>{{ line.scrapUnitPrice ?? '历史未记录' }} 元/kg</dd>
          <dt>材料金额</dt><dd>{{ line.materialAmount ?? '历史未记录' }} 元/件</dd>
          <dt>废料抵扣</dt><dd>{{ line.scrapDeduction ?? '历史未记录' }} 元/件</dd>
          <dt>算法</dt><dd>{{ line.formula || '历史未记录' }}</dd>
          <dt>代入计算</dt><dd>{{ line.substitution || '历史未记录' }}</dd>
          <dt>制造件合计单价</dt><dd>{{ line.parentTotalCostPrice ?? '历史未记录' }} 元/件</dd>
        </dl>
      </article>
      <section v-if="selected.householdCalculation?.calculatedW != null" class="monthly-evidence" aria-label="家用W列计算核对">
        <h4>家用 W 列计算核对</h4>
        <p>{{ selected.householdCalculation.formula }}</p>
        <p>铜锌价格：元/公斤；重量：克。美国柜装黄铜、H65黄铜边料按本单保存的铜价档位取值；其他因素沿用本单填写值或原基准。</p>
        <dl><template v-for="field in householdFields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ selected.householdCalculation[field.key] ?? '未记录' }}</dd></template></dl>
      </section>
      <div v-for="source in selected.sources" :key="`${source.table}:${source.id}`" class="source-note">来源：{{ source.table || '历史未记录' }}<span v-if="source.id != null"> #{{ source.id }}</span> {{ source.description || '' }}</div>
      <article v-for="price in selectedPrices" :key="price.id" class="monthly-evidence" :data-monthly-price-id="price.id">
        <h4>已采用月价 #{{ price.id }} · {{ price.materialCode }}</h4>
        <dl><dt>保存单价</dt><dd>{{ price.price }} {{ price.currency }}/{{ price.unit }}</dd>
          <dt>来源表与记录</dt><dd>{{ price.sourceDetails?.name || price.sourceType }} · {{ price.sourceDetails?.table }} #{{ price.sourceId || '历史未记录' }}<span v-if="price.sourceVersion"> · 版本 {{ price.sourceVersion }}</span><span v-if="price.sourceBatch"> · 批次 {{ price.sourceBatch }}</span></dd>
          <template v-for="field in sourceFields.filter(field => price.sourceDetails?.[field.key] != null)" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ price.sourceDetails[field.key] }}</dd></template>
          <dt>供应商</dt><dd>{{ price.supplier || '不适用／未记录' }}</dd>
          <dt>适用组织</dt><dd>{{ price.applicableOrganizations.join('、') }}</dd><dt>本次消费组织</dt><dd>{{ price.consumerOrganizations.join('、') }}</dd>
          <dt>税口径</dt><dd>{{ price.taxBasis === 'INCLUDED' ? '含税来源口径' : price.taxBasis === 'EXCLUDED' ? '不含税来源口径' : price.taxBasis }}</dd>
          <dt>依据指纹</dt><dd class="fingerprint">{{ price.evidenceHash }}</dd>
        </dl>
      </article>
    </div>
    <p v-else role="status">该版本没有记录所选物料的核算底稿。</p>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { savedMoney, rowBasis, sheetTotals, grossWeightWithSource } from '../utils/jjbSheet'
import { selectEvidenceRow } from '../utils/jjbEvidence'
import CostAmountComposition from './CostAmountComposition.vue'
const props = defineProps({ sheet: { type: Object, required: true }, initialTrace: { type: Object, default: null } })
const sourceFields = [
  ['financialScenarioPrice','基准口径单价 P0'], ['customerScenarioPrice','客户口径单价 P1'],
  ['customerCuBand','客户Cu选中档位'], ['factorSubstitution','材料因素代入依据'],
  ['sourcePrice','原来源表单价'], ['originalMonth','来源月份'], ['file','来源文件'], ['sheet','原表页签'],
  ['row','原表行号'], ['document','来源单据'], ['orderNo','采购订单号'], ['orderLineNo','订单行号'],
  ['effectiveFrom','有效期起'], ['effectiveTo','有效期止'],
  ['selectionReason','当时采用原因'], ['ratios','当时供货比率'], ['effectivePriceTable','财务有效价表'],
  ['effectivePriceId','财务有效价记录'], ['effectivePrice','采用的财务有效单价'],
].map(([key, label]) => ({ key, label }))
const householdFields = [
  ['inquirySourceMonth','询价来源月份'],['pricingMonth','核算月份'],['financeMonth','基价来源月份'],
  ['matchKind','来源匹配方式'],['matchedSpecification','匹配的型号/规格'],
  ['originalPrice','原询价 E'],['baseCopper','商用铜基价'],['baseZinc','商用锌基价'],
  ['customerCopper','代入的客户铜价'],['customerZinc','代入的客户锌价'],['copperGrams','铜重'],['zincGrams','锌重'],
  ['originalWFormula','原表 W 公式'],['originalWValue','原表 W 结果'],['calculatedW','本单计算 W'],
  ['householdRate','家用两项费用率 H'],['salesRate','商用营业费用率 S'],['quantity','实际用量 Q'],
  ['financialAmount','P0 换算后金额'],['customerAmount','W 换算后金额'],['difference','材料差异']
].map(([key,label]) => ({key,label}))
const selectedKey = ref('')
watch(() => [props.sheet, props.initialTrace], () => {
  const initial = props.initialTrace
  const found = selectEvidenceRow(props.sheet.rows, initial)
  selectedKey.value = found?.key || ''
}, { immediate: true })
const selected = computed(() => props.sheet.rows.find(row => row.key === selectedKey.value))
const compositionSelector = computed(() => {
  const row = selected.value
  if (!props.sheet.identity.costRunNo || !row) return null
  if ((row.code?.startsWith('AUX_') || ['DIRECT_LABOR','INDIRECT_LABOR','OVERHAUL','TOOLING_REPAIR','WATER_POWER','DEPT_OTHER'].includes(row.code)) && row.costItemIds?.length === 1)
    return { costItemId: row.costItemIds[0] }
  if (['PART','HOUSEHOLD'].includes(row.kind) && row.partItemIds?.length === 1) return { partItemId: row.partItemIds[0] }
  return null
})
const selectedPrices = computed(() => props.sheet.monthlyPrices.filter(price => selected.value?.monthlyPriceIds?.includes(price.id)))
</script>
<style scoped>
.jjb-evidence {padding:0 0 20px;}.version-identity {color:#526376;font-size:13px;}.evidence-totals {display:flex;gap:24px;padding:12px 0 20px;}.evidence-totals div {display:flex;flex-direction:column;gap:6px;}.evidence-totals span {font-size:12px;color:#526376;}.evidence-totals strong {font-size:14px;font-variant-numeric:tabular-nums;}
select {max-width:100%;padding:8px;margin-left:8px;border:1px solid #bdc9d5;border-radius:4px;} dl {display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;font-size:13px;}dt {color:#607184;}dd {margin:0;overflow-wrap:anywhere;}.source-note {font-size:12px;margin:8px 0;color:#526376;}.monthly-evidence {margin-top:18px;padding:12px;background:#f2f6fa;border:1px solid #d1dce6;border-radius:4px;}.monthly-evidence h4 {margin:0 0 14px;}.fingerprint {font-family:monospace;}
</style>
