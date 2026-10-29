<template>
  <el-card shadow="never" class="comparison-panel" :class="{embedded}">
    <h3 v-if="!embedded">制造成本明细对比</h3>
    <el-form :inline="true" @submit.prevent="query(true)">
      <el-form-item label="基准月份"><el-date-picker v-model="baseline" type="month" value-format="YYYY-MM" placeholder="选择基准月" @change="selectionEdited=true" /></el-form-item>
      <el-form-item label="对比月份"><el-date-picker v-model="comparison" type="month" value-format="YYYY-MM" placeholder="选择对比月" @change="selectionEdited=true" /></el-form-item>
      <el-form-item><el-button @click="openMetrics">差异项目（{{ metrics.length }}项）</el-button><el-button type="primary" :loading="loading" @click="query(true)">查询对比</el-button><el-button :disabled="!result || loading" :loading="exporting" @click="download">导出Excel</el-button><el-button link type="primary" :disabled="!result || !selectedMetrics.length" @click="scrollToDifferences">跳到差异列 →</el-button></el-form-item>
      <el-form-item class="oa-filter"><el-input v-model="oaNo" clearable placeholder="首次报价OA（可选）" aria-label="首次报价OA" /></el-form-item>
    </el-form>
    <div class="report-help"><span>每月取最后一次成功核算结果；新增／减少的差异金额与差异率均为“-”。</span><span>材料费逐部品比较，其余费用和制造成本在父件汇总行比较。</span></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-for="warning in result?.warnings || []" :key="warning" :title="warning" type="warning" :closable="false" />
    <el-table v-if="result" ref="comparisonTable" :data="rows" border class="comparison-table" max-height="485" :row-class-name="({row})=>row.kind==='PRODUCT'?'product-summary':''" :span-method="span" v-loading="loading">
      <el-table-column prop="parent.code" label="父件编码" fixed width="160" />
      <el-table-column prop="parent.name" label="父件名称" fixed width="160" />
      <el-table-column prop="childCode" label="一级编码" width="160" />
      <el-table-column prop="childName" label="一级名称" width="160" />
      <el-table-column prop="parent.specification" label="父件规格" width="130" />
      <el-table-column prop="parent.model" label="父件型号" width="130" />
      <el-table-column prop="object.oaNo" label="首次报价OA单号" width="190" />
      <el-table-column label="变化" width="130"><template #default="{row}">{{ comparisonChangeLabels[row.change] }}</template></el-table-column>
      <el-table-column v-for="[side,month] in monthGroups" :key="side" :label="month">
        <el-table-column v-for="[field,label] in comparisonMonthFields" :key="field" :label="label" :width="field==='completedAt'?180:150">
          <template #default="{row}"><span :data-comparison-side="side" :data-comparison-field="field">{{ comparisonCell(row,side,field) }}</span></template>
        </el-table-column>
      </el-table-column>
      <el-table-column v-for="[metric,label] in selectedMetrics" :key="metric" :label="label+'差异'">
        <el-table-column label="差异金额" width="150" class-name="difference-column"><template #default="{row}"><span :data-difference-metric="metric" data-difference-field="amount" :title="row.differences?.[metric]?.explanation">{{ comparisonDifferenceCell(row,metric,'amount') }}</span></template></el-table-column>
        <el-table-column label="差异率" width="150" class-name="difference-column"><template #default="{row}"><span :data-difference-metric="metric" data-difference-field="rate" :title="row.differences?.[metric]?.explanation">{{ comparisonDifferenceCell(row,metric,'rate') }}</span></template></el-table-column>
      </el-table-column>
    </el-table>
    <el-pagination v-if="result" v-model:current-page="page" :page-size="20" :total="result.totalProducts" layout="total, prev, pager, next" @current-change="query(false)" />
    <p v-if="result" class="scope-note">按父件分页，每个父件的两月部品一并展示；空白金额为未记录，新增或减少部品的差异为“－”。</p>
    <el-empty v-else-if="!error && !loading" description="选择两个核算月份，查询已保存的成本明细及差异。" :image-size="70" />
    <el-dialog v-model="metricsOpen" title="选择差异项目" width="min(560px, calc(100vw - 32px))">
      <p class="metric-help">每个选中项目都会增加差异金额、差异率两列。</p>
      <el-checkbox-group v-model="draftMetrics" class="metric-selection"><el-checkbox v-for="[key,label] in comparisonMetrics" :key="key" :value="key" :label="key">{{ label }}</el-checkbox></el-checkbox-group>
      <template #footer><el-button @click="metricsOpen=false">取消</el-button><el-button type="primary" @click="applyMetrics">应用</el-button></template>
    </el-dialog>
  </el-card>
</template>
<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useUserStore } from '../store/modules/user'
import { fetchMonthlyCostComparison, downloadMonthlyCostComparison } from '../api/monthlyReprice'
import { comparisonMetrics, comparisonMonthFields, comparisonChangeLabels, comparisonDisplayRows, comparisonCell, comparisonDifferenceCell } from '../utils/monthlyCostComparison'
const user=useUserStore(), baseline=ref(''), comparison=ref(''), oaNo=ref(''), metrics=ref(['MATERIAL','MANUFACTURE_COST'])
const props=defineProps({embedded:Boolean,month:String})
const metricsOpen=ref(false),draftMetrics=ref([]),comparisonTable=ref(null)
let selectionEdited=false
const result=ref(null), loading=ref(false), error=ref(''), page=ref(1), exporting=ref(false)
let savedSelection=null, downloadController
const rows=computed(()=>comparisonDisplayRows(result.value?.comparison))
const selectedMetrics=computed(()=>comparisonMetrics.filter(([key])=>result.value?.comparison.metrics.includes(key)))
const monthGroups=computed(()=>result.value?[['baseline',result.value.comparison.baselineMonth],['comparison',result.value.comparison.comparisonMonth]]:[])
let generation=0
function openMetrics(){draftMetrics.value=[...metrics.value];metricsOpen.value=true}
function applyMetrics(){metrics.value=[...draftMetrics.value];metricsOpen.value=false;query(true)}
function scrollToDifferences(){
  const column=comparisonTable.value?.$el.querySelector('.el-table__header-wrapper th.difference-column')
  if(column)comparisonTable.value.setScrollLeft(Math.max(0,column.offsetLeft-320))
}
watch(()=>props.month,month=>{
  if(!month || selectionEdited || savedSelection)return
  const [year,number]=month.split('-').map(Number)
  comparison.value=month
  baseline.value=number===1?`${year-1}-12`:`${year}-${String(number-1).padStart(2,'0')}`
},{immediate:true})
async function query(reset) {
  const request=++generation
  downloadController?.abort();exporting.value=false
  if(reset) page.value=1
  if(!baseline.value || !comparison.value){error.value='请选择基准月和对比月';loading.value=false;result.value=null;return}
  loading.value=true
  try {
    const selection={baselineMonth:baseline.value,comparisonMonth:comparison.value,oaNo:oaNo.value || undefined,metrics:[...metrics.value],page:page.value,pageSize:20}
    const value=await fetchMonthlyCostComparison(selection)
    if(request===generation){result.value=value;error.value='';savedSelection=selection}
  } catch(e){if(request===generation){error.value=e.message || '对比读取失败';result.value=null}}
  finally {if(request===generation)loading.value=false}
}
async function download() {
  if(!savedSelection || exporting.value)return
  const current=generation;downloadController?.abort();downloadController=new AbortController();exporting.value=true
  try {await downloadMonthlyCostComparison(savedSelection,{signal:downloadController.signal,isCurrent:()=>current===generation})}
  catch(e){if(current===generation)error.value=e.message || '导出失败'}
  finally {if(current===generation)exporting.value=false}
}
function span({row,columnIndex}) {if(columnIndex>1)return [1,1];return row.kind==='PRODUCT'?[row.groupRows,1]:[0,0]}
watch(()=>user.businessUnitType,()=>{generation++;downloadController?.abort();savedSelection=null;result.value=null;error.value='';loading.value=false;exporting.value=false;page.value=1;metricsOpen.value=false})
onUnmounted(()=>{generation++;downloadController?.abort()})
</script>
<style scoped>
.comparison-panel.embedded{border:0;border-radius:0;box-shadow:none}.embedded :deep(.el-card__body){padding:0}h3{margin:0 0 18px}.el-form{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:17px 18px 5px;border-bottom:1px solid #edf0f5}.el-form :deep(.el-form-item){margin:0 0 12px}.el-form :deep(.el-form-item__label){font-size:13px;color:#697482}.el-form :deep(.el-date-editor){width:145px}.el-form .oa-filter{margin-left:auto}.oa-filter .el-input{width:180px}.metric-selection{display:grid;grid-template-columns:1fr 1fr;gap:12px}.metric-selection :deep(.el-checkbox){margin:0}.metric-help{font-size:13px;color:#8791a0;margin:0 0 20px}.report-help{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 18px;font-size:12px;color:#8a94a4;line-height:1.7}.scope-note{color:#8791a0;font-size:12px;line-height:1.7;padding:0 18px 14px;margin:10px 0 0}.comparison-panel :deep(.el-alert){margin:12px 18px;width:auto}.comparison-table{font-size:12px}.comparison-table :deep(th.el-table__cell){background:#f4f8fd;color:#64748b;font-weight:500}.comparison-table :deep(th.is-group){background:#eaf3ff;color:#4273a8;text-align:center}.comparison-table :deep(th.difference-column){background:#fff6df;color:#a77b29}.comparison-table :deep(td.difference-column){background:#fffdf7}.el-pagination{padding:16px 18px 0}:deep(.product-summary){--el-table-tr-bg-color:#f0f5fc;font-weight:600}@media(max-width:760px){.el-form{gap:10px;padding:14px 12px 2px}.el-form .oa-filter{margin-left:0}.el-form :deep(.el-form-item__content){flex-wrap:wrap;gap:8px}.el-form :deep(.el-button+.el-button){margin-left:0}.el-form :deep(.el-date-editor){width:136px}.report-help{padding:10px 12px}.metric-selection{grid-template-columns:1fr}.el-pagination{padding:12px}.scope-note{padding:0 12px 12px}}
</style>
