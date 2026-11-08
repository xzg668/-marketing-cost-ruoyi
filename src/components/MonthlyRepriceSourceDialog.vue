<template>
  <el-dialog :model-value="!!source" title="本月核算的报价来源" width="min(850px, 95vw)" @close="$emit('close')">
    <p v-if="source">{{ source.pricingMonth }} · {{ source.productCode }} · {{ source.customerValue || '客户身份未保存' }}</p>
    <el-alert v-if="source?.reason" :title="source.reason" type="info" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="oaNo" label="原OA单号" min-width="180" />
      <el-table-column prop="oaFormItemId" label="原产品行" width="120" />
      <el-table-column prop="sourceCostVersionId" label="原成功成本版本" width="150" />
      <el-table-column label="来源用途" width="160"><template #default="{row}">{{ row.unresolved ? '待完善的原报价来源' : row.selected ? '本月采用的整份资料' : '归并来源' }}</template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" :disabled="loading" layout="total, prev, pager, next" @current-change="load" />
  </el-dialog>
</template>
<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { useUserStore } from '../store/modules/user'
import { fetchMonthlyRepriceResultSources, fetchMonthlyComparisonHistoricalSources } from '../api/monthlyReprice'
const props=defineProps({source:Object});const emit=defineEmits(['close']);const user=useUserStore()
const rows=ref([]),total=ref(0),page=ref(1),loading=ref(false),error=ref('');let generation=0
async function load(){
  const id=++generation,s=props.source;rows.value=[];error.value='';loading.value=false
  if(!s)return
  if(!s.resultId && !s.versionId){rows.value=[{oaNo:s.oaNo,oaFormItemId:s.oaFormItemId,sourceCostVersionId:s.sourceCostVersionId,unresolved:true}];total.value=1;return}
  loading.value=true
  try{const params={page:page.value,pageSize:20};const value=await(s.resultId
      ?fetchMonthlyRepriceResultSources(s.repriceNo,s.resultId,params):fetchMonthlyComparisonHistoricalSources(s.versionId,params));
    if(id===generation){rows.value=value.list;total.value=value.total}}
  catch(e){if(id===generation){error.value=e.message || '报价来源读取失败';total.value=0}}
  finally{if(id===generation)loading.value=false}
}
watch(()=>props.source,()=>{page.value=1;total.value=0;load()},{immediate:true})
watch(()=>user.businessUnitType,()=>{generation++;rows.value=[];total.value=0;loading.value=false;emit('close')})
onUnmounted(()=>{generation++})
</script>
