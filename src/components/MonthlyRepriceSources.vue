<template>
  <el-card shadow="never" class="reprice-sources">
    <div class="source-heading"><h3>本次调价价格资料</h3></div>
    <el-table :data="sources" :row-class-name="({row})=>row.automatic?'automatic-source':''">
      <el-table-column label="价格及基础资料" min-width="195"><template #default="{row}"><strong>{{ row.name }}</strong><el-tag v-if="row.automatic" size="small">系统自动接入</el-tag><p>{{ row.description }}</p></template></el-table-column>
      <el-table-column label="准备情况" min-width="155"><template #default="{row}"><el-tag type="info" effect="light">{{ row.preparation }}</el-tag></template></el-table-column>
      <el-table-column label="财务操作" width="200" align="right"><template #default="{row}"><span v-if="row.automatic" class="auto-note">无需财务操作</span><el-button link type="primary" @click="selected=row">{{ row.automatic?'查看来源':'前往维护' }}</el-button><el-button v-if="row.id==='ratio'" link type="primary" @click="open('/base/supplier-relation/supply-ratio',{changes:'1'})">变更记录</el-button></template></el-table-column>
    </el-table>
    <p class="source-note">核对本次适用资料后点击调价，系统会列出具体缺失问题。</p>
    <el-dialog v-model="sourceOpen" :title="selected?.name" width="560px">
      <template v-if="selected">
        <el-alert v-if="selected.automatic" title="系统每日自动同步，无需财务导入或手动刷新。" type="info" :closable="false" />
        <p>{{ selected.description }}</p>
        <p v-if="!selected.automatic">目标月份：{{ month || '本月' }}。请在维护页核对月份和业务范围，再导入资料。</p>
        <p v-if="selected.id==='ratio'">只导入新增或变动条目；未出现的关系继续使用，明确填写0表示退出供货，无需填写生效日期。</p>
        <div class="source-links"><el-button v-for="link in selected.links" :key="link.path" type="primary" @click="open(link.path)">{{ link.label }}</el-button>
          <el-button v-if="selected.id==='ratio' && canImportRatio" @click="sourceOpen=false;ratioOpen=true">导入供货比例</el-button>
          <el-button v-if="selected.id==='ratio'" @click="open('/base/supplier-relation/supply-ratio',{changes:'1'})">变更记录</el-button>
        </div>
      </template>
    </el-dialog>
    <SupplierSupplyRatioImportDialog v-if="ratioOpen" v-model="ratioOpen" @imported="emit('prepared')" />
  </el-card>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import SupplierSupplyRatioImportDialog from './SupplierSupplyRatioImportDialog.vue'
const props=defineProps({month:String})
const emit=defineEmits(['prepared'])
const router=useRouter(),user=useUserStore(),selected=ref(null),ratioOpen=ref(false)
const sourceOpen=computed({get:()=>!!selected.value,set:value=>{if(!value)selected.value=null}})
const canImportRatio=computed(()=>user.permissions.includes('*:*:*')||user.permissions.includes('base:supplier-supply-ratio:import'))
const sources=[
 {id:'finance',name:'财务基价',preparation:'按目标月份核对',description:'商用、板换分别按目标月份维护；可直接导入，上月导出可选。',links:[{label:'维护财务基价',path:'/rules/finance-cu-base'}]},
 {id:'fixed',name:'SRM固定价',automatic:true,preparation:'系统每日接入',description:'系统每日自动同步有效来源，无需财务维护。',links:[{label:'查看SRM固定价',path:'/price/fixed'}]},
 {id:'linked',name:'联动价、区间价',preparation:'核对适用稿件',description:'财务导入原始稿件及公式，按目标月基价取价。',links:[{label:'维护联动价',path:'/price/linked/result'},{label:'维护区间价',path:'/price/range'}]},
 {id:'settlement',name:'结算固定价、结算联动价',preparation:'核对适用稿件',description:'财务按目标月份导入有效结算价格。',links:[{label:'维护结算价格',path:'/price/settlement'}]},
 {id:'inquiry',name:'询价',preparation:'核对有效询价',description:'财务导入适用询价，保留原始来源。',links:[{label:'维护询价',path:'/price/household-inquiry'}]},
 {id:'scrap',name:'废料价格',preparation:'核对有效价格',description:'财务维护最新有效稿件。',links:[{label:'维护废料价格',path:'/price/scrap'}]},
 {id:'ratio',name:'供应商供货比例',preparation:'沿用有效关系',description:'沿用有效关系，财务只导入新增或变动条目。',links:[{label:'查看供货比例',path:'/base/supplier-relation/supply-ratio'}]}
]
function open(path,query={}){selected.value=null;router.push({path,query:{priceMonth:props.month,...query}})}
watch(()=>user.businessUnitType,()=>{selected.value=null;ratioOpen.value=false})
</script>
<style scoped>
.reprice-sources{border-radius:7px;border-color:#e5e9f0}.reprice-sources :deep(.el-card__body){padding:0}.source-heading{padding:18px 20px;border-bottom:1px solid #edf0f4}h3{margin:0;font-size:16px;font-weight:600}strong{font-weight:400}p{font-size:12px;color:#929ba9;line-height:1.6;margin:5px 0 0}.el-tag{margin-left:8px}.auto-note{display:block;font-size:12px;color:#2879bd;margin-bottom:6px}.source-note{padding:10px 15px;margin:0;background:#fafbfd}.source-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.source-links .el-button{margin:0}.reprice-sources :deep(.el-table th.el-table__cell){background:#fafbfd;color:#87909e;font-size:13px;font-weight:400;padding:13px 0}.reprice-sources :deep(.el-table td.el-table__cell){padding:13px 0}.reprice-sources :deep(.el-table .cell){padding:0 15px}.reprice-sources :deep(.el-table__inner-wrapper::before){display:none}:deep(.automatic-source td){background:#f0f7ff!important}:deep(.automatic-source td:first-child){box-shadow:inset 3px 0 #409eff}
</style>
