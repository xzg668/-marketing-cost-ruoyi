<template>
  <section class="amount-composition" aria-label="金额来源及计算明细">
    <div class="composition-title"><h4>金额来源及计算明细</h4><button type="button" :disabled="!view || loading" @click="downloadComposition(view)">下载核对明细</button></div>
    <p v-if="loading" role="status">正在读取来源明细…</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
    <template v-else-if="view">
      <p v-if="view.composition.origin === 'CURRENT_REFERENCE'" class="reference-note">当前来源核对资料：此旧版本未保存当时的 CMS 分项，原保存金额保持不变。</p>
      <p v-else>以下为本次核算保存的来源依据。</p>
      <dl><dt>保存金额</dt><dd>{{ view.amount || '未记录' }} 元</dd>
        <template v-if="view.baseAmount !== ''"><dt>采用基数</dt><dd>{{ view.baseAmount }}</dd></template>
        <template v-if="view.rate !== ''"><dt>系数／有效费率</dt><dd>{{ view.rate }}</dd></template>
        <dt>来源合计</dt><dd>{{ view.composition.sourceAmount || '未记录' }} 元</dd>
        <template v-if="view.composition.excludedAmount"><dt>剔除金额</dt><dd>{{ view.composition.excludedAmount }} 元</dd></template>
        <template v-if="view.referenceAmount !== ''"><dt>按来源核对金额</dt><dd>{{ view.referenceAmount }} 元；与保存金额差额 {{ view.difference }} 元</dd></template>
      </dl>
      <p class="formula">{{ view.composition.formula }}</p>
      <template v-if="view.calculation"><p>{{ calculationLabel }}</p><ol class="calculation-steps"><li v-for="(step,index) in view.calculation.split('；').filter(Boolean)" :key="index">{{ step }}</li></ol></template>
      <article v-for="parameter in departmentParameters" :key="parameter.sourceId" class="department-parameters">
        <h5>{{ view.composition.origin === 'CURRENT_REFERENCE' ? '当前部门费率配置（供核对）' : '本次采用的部门费率参数' }}</h5>
        <dl><dt>取数年度／事业部</dt><dd>{{ parameter.period }} ／ {{ parameter.division }}</dd>
          <dt>费用科目</dt><dd>{{ parameter.subjectName }}</dd>
          <dt>工时工资率</dt><dd>{{ parameter.manhourRate || '未记录' }}</dd>
          <dt>报价费率</dt><dd>{{ parameter.quoteRatio || '未记录' }}</dd>
          <dt>上浮系数</dt><dd>{{ parameter.upliftRatio || '未记录' }}</dd>
          <dt>费率计算方式</dt><dd>{{ parameter.calculationMode }}</dd>
          <dt>来源记录</dt><dd>#{{ parameter.sourceId }} <span v-if="parameter.sourceBatch">；批次 {{ parameter.sourceBatch }}</span></dd>
        </dl>
        <p v-if="parameter.note">{{ parameter.note }}</p>
      </article>
      <p v-if="view.composition.note" class="composition-note">{{ view.composition.note }}</p>
      <p v-for="total in packageTotals" :key="total.kind"><strong>{{ total.coefficientBasis }}：{{ total.coefficient }}</strong>；包装费 {{ total.amountYuan }} 元</p>
      <div v-if="displayRows.length" class="composition-table"><table><thead><tr><th v-for="column in columns" :key="column.key">{{ column.label }}</th></tr></thead>
        <tbody><tr v-for="(row, index) in displayRows" :key="index"><td v-for="column in columns" :key="column.key" :class="{ 'path-cell': column.key === 'path' }">{{ row[column.key] ?? '' }}</td></tr></tbody></table></div>
      <p v-else>未记录可展开的原始分项，核对说明及已保存依据可下载。</p>
      <details v-if="paths.length"><summary>展开 CMS 路径分项（{{ paths.length }} 项）</summary><ol><li v-for="(path,index) in paths" :key="index"><p>{{ path.path }}</p><p>{{ path.originalCent || '未记录' }} 分 → {{ path.amountYuan || '未记录' }} 元；{{ path.treatment }}</p></li></ol></details>
    </template>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchCostAmountComposition } from '../api/costRunDetail'
import { compositionPaths, downloadComposition, visibleCompositionColumns } from '../utils/costAmountComposition'
const props = defineProps({ costRunNo: { type: String, required: true }, costItemId: { type: [Number,String], default: null }, partItemId: { type: [Number,String], default: null } })
const view = ref(null), loading = ref(false), error = ref('')
let requestId = 0
async function load() {
  const id = ++requestId
  view.value = null; error.value = ''; loading.value = true
  try {
    const result = await fetchCostAmountComposition(props.costRunNo, { costItemId: props.costItemId, partItemId: props.partItemId })
    if (id === requestId) view.value = result
  } catch (failure) {
    if (id === requestId) error.value = failure?.message || '来源明细读取失败，请重试'
  } finally { if (id === requestId) loading.value = false }
}
watch(() => [props.costRunNo, props.costItemId, props.partItemId], load, { immediate: true })
onBeforeUnmount(() => { requestId++ })
const isPackaging = computed(() => ['OTHER_EXP_PACKAGE','BOM_BUCKET_PACKAGE'].includes(view.value?.costCode))
const displayRows = computed(() => isPackaging.value ? view.value.composition.rows.filter(row => row.kind === 'PACKAGE_COMPONENT') : view.value?.composition.rows || [])
const packageTotals = computed(() => view.value?.composition.rows.filter(row => row.kind === 'PACKAGE_TOTAL') || [])
const columns = computed(() => view.value ? visibleCompositionColumns({ ...view.value, composition: { ...view.value.composition, rows: displayRows.value } }) : [])
const paths = computed(() => view.value ? compositionPaths(view.value) : [])
const departmentParameters = computed(() => view.value?.composition.rows.filter(row => row.sourceTable === 'lp_department_fund_rate') || [])
const calculationLabel = computed(() => ['OVERHAUL','TOOLING_REPAIR','WATER_POWER','DEPT_OTHER'].includes(view.value?.costCode)
  ? '保存金额的计算过程：' : view.value?.composition.origin === 'CURRENT_REFERENCE' ? '按当前来源核对：' : '代入计算：')
</script>
<style scoped>
.amount-composition {margin:18px 0;padding:14px;border:1px solid #d1dce6;border-radius:4px;background:#f8fafc;}.composition-title {display:flex;align-items:center;justify-content:space-between;gap:12px;}.composition-title h4 {margin:0;}button {padding:7px 12px;border:1px solid #a9bacc;border-radius:4px;background:white;color:#2465a2;cursor:pointer;}button:disabled {opacity:.5;cursor:default;}p,details {font-size:13px;line-height:1.7;}.reference-note,.composition-note {white-space:pre-wrap;overflow-wrap:anywhere;color:#805b23;}.formula {white-space:pre-wrap;}dl {display:grid;grid-template-columns:125px minmax(0,1fr);gap:8px;font-size:13px;}dt {color:#607184;}dd {margin:0;}.composition-table {max-height:430px;overflow:auto;}table {border-collapse:collapse;width:100%;font-size:12px;background:white;}th,td {padding:8px;border:1px solid #dce4ed;text-align:left;min-width:100px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere;}th {position:sticky;top:0;background:#eef3f8;}.path-cell {min-width:350px;}details {margin-top:12px;}li p {overflow-wrap:anywhere;margin:6px 0;}
</style>
