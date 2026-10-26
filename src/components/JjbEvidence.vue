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
        <template v-if="selected.baseAmount != null"><dt>采用基数</dt><dd>{{ selected.baseAmount }}</dd></template>
        <dt>费用／费率口径</dt><dd>{{ rowBasis(selected) || '历史未记录' }}</dd>
        <template v-if="selected.coefficient != null"><dt>本次属性系数 K</dt><dd>{{ selected.coefficient }}</dd></template>
        <template v-if="selected.paths?.length"><dt>实际计价路径</dt><dd>{{ selected.paths.join('；') }}</dd></template>
        <dt>说明</dt><dd>{{ selected.remark || '' }}</dd>
      </dl>
      <div v-for="source in selected.sources" :key="`${source.table}:${source.id}`" class="source-note">来源：{{ source.table || '历史未记录' }}<span v-if="source.id != null"> #{{ source.id }}</span> {{ source.description || '' }}</div>
      <article v-for="price in selectedPrices" :key="price.id" class="monthly-evidence" :data-monthly-price-id="price.id">
        <h4>已采用月价 #{{ price.id }} · {{ price.materialCode }}</h4>
        <dl><dt>保存单价</dt><dd>{{ price.price }} {{ price.currency }}/{{ price.unit }}</dd>
          <dt>来源</dt><dd>{{ price.sourceType }} #{{ price.sourceId || '历史未记录' }}<span v-if="price.sourceVersion"> · 版本 {{ price.sourceVersion }}</span><span v-if="price.sourceBatch"> · 批次 {{ price.sourceBatch }}</span></dd>
          <dt>供应商</dt><dd>{{ price.supplier || '不适用／未记录' }}</dd>
          <dt>适用组织</dt><dd>{{ price.applicableOrganizations.join('、') }}</dd><dt>本次消费组织</dt><dd>{{ price.consumerOrganizations.join('、') }}</dd>
          <dt>税口径</dt><dd>{{ price.taxBasis === 'INCLUDED' ? '含税来源口径' : price.taxBasis === 'EXCLUDED' ? '不含税来源口径' : price.taxBasis }}</dd>
          <dt>依据指纹</dt><dd class="fingerprint">{{ price.evidenceHash }}</dd>
        </dl>
      </article>
    </div>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { savedMoney, rowBasis, sheetTotals } from '../utils/jjbSheet'
const props = defineProps({ sheet: { type: Object, required: true }, initialTrace: { type: Object, default: null } })
const selectedKey = ref('')
watch(() => [props.sheet, props.initialTrace], () => {
  const initial = props.initialTrace
  const found = props.sheet.rows.find(row => row.key === initial?.rowKey
    || initial?.costCode && row.code === initial.costCode
    || initial?.partItemId && row.partItemIds?.includes(initial.partItemId)
    || initial?.costItemId && row.costItemIds?.includes(initial.costItemId))
  selectedKey.value = found?.key || props.sheet.rows[0]?.key || ''
}, { immediate: true })
const selected = computed(() => props.sheet.rows.find(row => row.key === selectedKey.value))
const selectedPrices = computed(() => props.sheet.monthlyPrices.filter(price => selected.value?.monthlyPriceIds?.includes(price.id)))
</script>
<style scoped>
.jjb-evidence {padding:0 0 20px;}.version-identity {color:#526376;font-size:13px;}.evidence-totals {display:flex;gap:24px;padding:12px 0 20px;}.evidence-totals div {display:flex;flex-direction:column;gap:6px;}.evidence-totals span {font-size:12px;color:#526376;}.evidence-totals strong {font-size:14px;font-variant-numeric:tabular-nums;}
select {max-width:100%;padding:8px;margin-left:8px;border:1px solid #bdc9d5;border-radius:4px;} dl {display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;font-size:13px;}dt {color:#607184;}dd {margin:0;overflow-wrap:anywhere;}.source-note {font-size:12px;margin:8px 0;color:#526376;}.monthly-evidence {margin-top:18px;padding:12px;background:#f2f6fa;border:1px solid #d1dce6;border-radius:4px;}.monthly-evidence h4 {margin:0 0 14px;}.fingerprint {font-family:monospace;}
</style>
