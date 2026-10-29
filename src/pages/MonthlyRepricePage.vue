<template>
  <div class="monthly-reprice-page">
    <div class="page-head main-head"><div><h2>月度调价</h2><p>按本次BOM和价格，重新核算历史已报价单据。</p></div>
      <div class="head-actions"><span class="month-field">调价月份 <span class="pricing-month">{{ pricingMonth }}</span></span><el-tag effect="light">{{ batch ? statusLabels[batch.status] || batch.status : '未开始' }}</el-tag><el-button :loading="busy" @click="refresh">刷新</el-button>
        <template v-if="view && view.canOperate">
          <el-button v-if="!batch" type="primary" :disabled="!!error" :loading="busy" @click="run('start')">调价</el-button>
          <el-button v-if="batch && batch.status === 'FAILED'" type="primary" :disabled="!!error" :loading="busy" @click="run('retry')">修正后重试</el-button>
          <el-button v-if="batch && batch.status === 'WAIT_CONFIRM'" type="primary" :disabled="!!error" :loading="busy" @click="run('confirm')">确认</el-button>
        </template>
        <el-tag v-if="batch?.status==='CONFIRMED'" type="success">本月调价已完成</el-tag>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <MonthlyRepriceSources :month="pricingMonth" @prepared="refresh" />
    <el-card shadow="never" class="process-panel">
      <template #header><div class="panel-heading"><h3>自动处理进度</h3><el-button link type="primary" @click="showOperations">操作记录</el-button></div></template>
      <div v-for="(item,index) in processSteps" :key="item.title" class="progress-row" :class="item.state">
        <span class="progress-circle">{{ item.state==='done' ? '✓' : index+1 }}</span>
        <div><div class="progress-name">{{ item.title }}</div><div class="progress-description">{{ item.description }}</div></div>
        <span class="progress-state">{{ item.label }}</span>
      </div>
      <el-progress :percentage="percentage" :show-text="false" :stroke-width="6" :status="batch?.status==='FAILED'?'exception':batch?.status==='CONFIRMED'?'success':undefined" />
      <div class="progress-caption"><span>{{ batch ? statusLabels[batch.status] || batch.status : '未开始' }}<template v-if="batch"> · 已完成 {{ batch.successCount || 0 }} / {{ batch.totalCount || 0 }} 个产品</template></span><span>{{ percentage }}%</span></div>
      <p v-if="batch?.status==='FAILED'" class="quotation-note">修正资料后重试，将保留本批次已成功的结果。</p>
      <p v-if="view" class="quotation-note">{{ view.quotationBlocked ? '当前业务单元暂停报价，管理员或业务总监确认后恢复。' : '当前业务单元可以报价。' }}</p>
    </el-card>
    <el-card v-if="problems.length" shadow="never" class="problem-panel"><h3>需要处理的问题</h3><el-alert v-for="problem in problems" :key="problem" :title="problem" type="error" :closable="false" /></el-card>
    <el-card ref="reportPanel" shadow="never" class="report-panel">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="成本对比" name="comparison"><MonthlyCostComparisonPanel embedded :month="pricingMonth" /></el-tab-pane>
        <el-tab-pane label="操作记录" name="operations">
          <div class="operation-records">
            <p v-if="batch" class="batch-reference">批次：{{ batch.repriceNo }}</p>
            <el-timeline v-if="operationRecords.length"><el-timeline-item v-for="record in operationRecords" :key="record.title" :timestamp="record.time" :type="record.type" placement="top"><div class="record-title">{{ record.title }}</div><p>{{ record.description }}</p></el-timeline-item></el-timeline>
            <el-empty v-else :description="batch ? '本批次暂无已保存的操作时间记录' : '尚未开始本次调价'" :image-size="70" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    <el-collapse class="history"><el-collapse-item title="历史调价" name="history">
      <div class="history-actions"><el-button @click="loadHistory">查询历史</el-button></div>
      <el-table :data="history" stripe>
        <el-table-column prop="pricingMonth" label="月份" width="110" />
        <el-table-column prop="repriceNo" label="批次" min-width="230" />
        <el-table-column label="状态" width="120"><template #default="{ row }">{{ statusLabels[row.status] || row.status }}</template></el-table-column>
        <el-table-column prop="totalCount" label="产品数" width="100" />
        <el-table-column prop="confirmedName" label="确认人" width="120" />
        <el-table-column prop="confirmedAt" label="确认时间" min-width="170" />
        <el-table-column label="结果" width="90"><template #default="{ row }"><el-button link @click="showResults(row.repriceNo)">查看</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="historyPage" :page-size="20" :total="historyTotal" layout="prev, pager, next" @current-change="loadHistory" />
    </el-collapse-item></el-collapse>
    <el-dialog v-model="resultsOpen" title="历史核算结果" width="85%">
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-table :data="results"><el-table-column prop="oaNo" label="报价单" /><el-table-column prop="productCode" label="产品" />
        <el-table-column prop="totalCost" label="制造成本" /><el-table-column prop="calcStatus" label="核算状态" />
        <el-table-column label="明细"><template #default="{ row }"><el-button link @click="showDetails(row)">查看明细</el-button></template></el-table-column></el-table>
      <el-pagination v-model:current-page="resultPage" :page-size="20" :total="resultTotal" layout="prev, pager, next" @current-change="loadResults" />
    </el-dialog>
    <el-dialog v-model="detailsOpen" title="保存的成本明细" width="85%">
      <el-table :data="parts"><el-table-column prop="partCode" label="物料" /><el-table-column prop="partName" label="名称" /><el-table-column prop="quantity" label="用量" /><el-table-column prop="amount" label="金额" /></el-table>
      <el-table :data="costs"><el-table-column prop="costItemName" label="项目" /><el-table-column prop="amount" label="金额" /></el-table>
    </el-dialog>
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import MonthlyCostComparisonPanel from '../components/MonthlyCostComparisonPanel.vue'
import MonthlyRepriceSources from '../components/MonthlyRepriceSources.vue'
import { useUserStore } from '../store/modules/user'
import { fetchRepriceCurrent, startReprice, retryReprice, confirmReprice, fetchMonthlyRepriceBatches,
  fetchMonthlyRepriceResults, fetchMonthlyRepricePartItems, fetchMonthlyRepriceCostItems } from '../api/monthlyReprice'
const user = useUserStore()
const view=ref(null), busy=ref(false), error=ref(''), history=ref([]), historyPage=ref(1), historyTotal=ref(0)
const resultsOpen=ref(false), results=ref([]), resultPage=ref(1), resultTotal=ref(0), historyError=ref(''), selectedNo=ref('')
const detailsOpen=ref(false), parts=ref([]), costs=ref([])
const activeTab=ref('comparison'),reportPanel=ref(null)
const batch=computed(()=>view.value?.batch)
const pricingMonth=computed(()=>batch.value?.pricingMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`)
const statusLabels={ QUEUED:'已受理', RUNNING:'正在核算', CHECKING:'正在检查', FAILED:'待处理', WAIT_CONFIRM:'待确认', CONFIRMED:'已完成' }
const percentage=computed(()=>['WAIT_CONFIRM','CONFIRMED'].includes(batch.value?.status)?100:batch.value?.totalCount?Math.min(99,Math.round((batch.value.successCount || 0)/batch.value.totalCount*100)):0)
const processSteps=computed(()=>{
  const status=batch.value?.status
  return [
    ['获取历史报价产品的BOM','系统获取历史单据中各产品本次调价要用的BOM'],
    ['准备本次调价价格','系统按适用的价格资料和供货比例取价'],
    ['重新核算历史报价','系统按本次BOM和价格批量重算，保留原报价结果'],
    ['生成成本对比并校验','系统生成新旧成本明细及差异，完成自动检查'],
  ].map(([title,description],index)=>{
    let state='pending',label='待执行'
    if(['WAIT_CONFIRM','CONFIRMED'].includes(status) || status==='CHECKING' && index<3){state='done';label='已完成'}
    else if(status==='RUNNING' && index<3 || status==='CHECKING' && index===3){state='active';label='处理中'}
    else if(status==='FAILED'){state='failed';label='待处理'}
    return {title,description,state,label}
  })
})
const operationRecords=computed(()=>{
  const current=batch.value
  if(!current)return []
  const records=[]
  const add=(time,title,description,type)=>{if(time)records.push({time:String(time).replace('T',' '),title,description,type})}
  add(current.createdAt,'受理调价',`${current.createdName || current.createdBy || '操作人未记录'} · ${current.pricingMonth}`,'primary')
  add(current.startedAt,'开始自动处理','获取目标月BOM、准备适用价格并重新核算。','primary')
  add(current.checkedAt,current.checkStatus==='PASSED'?'自动检查通过':'自动检查未通过',`结果版本：${current.checkedRevision ?? current.resultRevision ?? '未记录'}`,current.checkStatus==='PASSED'?'success':'danger')
  add(current.confirmedAt,'确认调价',`${current.confirmedName || current.confirmedBy || '确认人未记录'} · 已恢复报价`,'success')
  return records
})
async function showOperations(){activeTab.value='operations';await nextTick();reportPanel.value?.$el.scrollIntoView({behavior:'smooth',block:'start'})}
const problems=computed(()=>{
  const list=[...(view.value?.problems || [])]
  try { for(const p of JSON.parse(batch.value?.checkResultJson || '{}').problems || []) if(!list.includes(p)) list.push(p) } catch { /* Saved evidence may be absent. */ }
  return list
})
let epoch=0, timer, refreshNo=0, historyNo=0, resultNo=0, detailNo=0
async function refresh() {
  if(busy.value)return
  const current=epoch,id=++refreshNo
  try {const value=await fetchRepriceCurrent();if(current===epoch && id===refreshNo){view.value=value;error.value=''}}
  catch(e){if(current===epoch && id===refreshNo) error.value=e.message || '调价状态读取失败'}
}
async function run(action) {
  if(busy.value) return
  busy.value=true;refreshNo++;const current=epoch
  try {
    const value=action==='start' ? await startReprice() : action==='retry' ? await retryReprice(batch.value.repriceNo)
      : await confirmReprice(batch.value.repriceNo,batch.value.checkedRevision)
    if(current===epoch){view.value=value;error.value='';await loadHistory()}
  } catch(e){if(current===epoch) error.value=e.message || '操作失败，请刷新后重试'}
  finally {if(current===epoch) busy.value=false}
}
async function loadHistory(){const current=epoch,id=++historyNo;try{const v=await fetchMonthlyRepriceBatches({page:historyPage.value,pageSize:20});if(current===epoch && id===historyNo){history.value=v.list || [];historyTotal.value=v.total || 0}}catch(e){if(current===epoch && id===historyNo)error.value=e.message}}
async function showResults(no){selectedNo.value=no;resultPage.value=1;resultsOpen.value=true;await loadResults()}
async function loadResults(){const current=epoch,id=++resultNo,no=selectedNo.value;try{const v=await fetchMonthlyRepriceResults(no,{page:resultPage.value,pageSize:20});if(current===epoch && id===resultNo && no===selectedNo.value){results.value=v.list || [];resultTotal.value=v.total || 0;historyError.value=''}}catch(e){if(current===epoch && id===resultNo && no===selectedNo.value)historyError.value=e.message}}
async function showDetails(row){const current=epoch,id=++detailNo,no=selectedNo.value;try{const [p,c]=await Promise.all([fetchMonthlyRepricePartItems(no,row.id),fetchMonthlyRepriceCostItems(no,row.id)]);if(current===epoch && id===detailNo && no===selectedNo.value){parts.value=p;costs.value=c;detailsOpen.value=true}}catch(e){if(current===epoch && id===detailNo && no===selectedNo.value)historyError.value=e.message}}
watch(()=>user.businessUnitType,()=>{epoch++;refreshNo++;historyNo++;resultNo++;detailNo++;view.value=null;history.value=[];results.value=[];parts.value=[];costs.value=[];resultsOpen.value=false;detailsOpen.value=false;activeTab.value='comparison';busy.value=false;refresh();loadHistory()})
onMounted(()=>{refresh();loadHistory();window.addEventListener('focus',refresh);timer=setInterval(()=>{if(!busy.value)refresh()},2000)})
onUnmounted(()=>{epoch++;clearInterval(timer);window.removeEventListener('focus',refresh)})
</script>
<style scoped>
.monthly-reprice-page{display:grid;gap:18px;max-width:1800px;margin:8px auto 30px;padding:0 10px;min-width:0}.monthly-reprice-page>*{min-width:0}.page-head,.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-head h2,h3{margin:0}.page-head p{color:#8b93a1;font-size:13px;margin:10px 0 0;line-height:1.7}.main-head{margin-bottom:4px;align-items:flex-start}.main-head h2{font-size:25px;font-weight:600}.head-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.head-actions .el-button{margin:0}.month-field{display:flex;align-items:center;gap:8px;font-size:13px;color:#606266}.pricing-month{padding:8px 13px;border:1px solid #dcdfe6;background:white;border-radius:5px;font-variant-numeric:tabular-nums}.process-panel,.report-panel{border-radius:7px;border-color:#e5e9f0}.process-panel :deep(.el-card__header){padding:17px 20px;border-color:#edf0f4}.process-panel :deep(.el-card__body){padding:6px 20px 16px}.panel-heading h3{font-size:16px;font-weight:600}.progress-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 0;border-bottom:1px solid #f1f3f7}.progress-circle{width:23px;height:23px;border:1px solid #dce2eb;border-radius:50%;display:grid;place-items:center;color:#a5adb8;font-size:12px}.done .progress-circle{background:#edf8f1;border-color:#a8d6bd;color:#269366}.active .progress-circle{background:#eaf4ff;border-color:#91c4fb;color:#348fe8}.progress-name{font-size:14px;color:#414956}.progress-description{font-size:12px;color:#969eaa;margin-top:5px;line-height:1.6}.progress-state{font-size:12px;color:#969eaa}.done .progress-state{color:#269366}.active .progress-state{color:#348fe8}.failed .progress-state{color:#d95f5f}.process-panel .el-progress{margin-top:18px}.progress-caption{display:flex;justify-content:space-between;gap:12px;margin-top:9px;font-size:12px;color:#929ba8}.quotation-note,.batch-reference{font-size:12px;line-height:1.7;color:#738092}.quotation-note{margin:10px 0 0}.batch-reference{overflow-wrap:anywhere;margin:0 0 24px}.problem-panel h3{font-size:16px}.problem-panel .el-alert{margin-top:12px}.report-panel :deep(.el-card__body){padding:0}.report-panel :deep(.el-tabs__header){margin:0}.report-panel :deep(.el-tabs__nav-wrap){padding:0 20px}.report-panel :deep(.el-tabs__item){height:50px;font-weight:400}.report-panel :deep(.el-tabs__nav-wrap::after){height:1px;background:#e5e9f0}.operation-records{padding:22px 24px}.operation-records .el-timeline{padding-left:5px;margin:0}.operation-records p{font-size:12px;color:#929ba8;line-height:1.7}.record-title{font-size:14px}.history{background:white;border:1px solid #e5e9f0;border-radius:7px;padding:0 20px}.history :deep(.el-collapse-item__header){font-size:14px;color:#697482;border:0}.history :deep(.el-collapse-item__wrap){border:0}.history-actions{display:flex;justify-content:flex-end;margin:0 0 14px}@media(max-width:760px){.monthly-reprice-page{padding:0;margin-top:6px;gap:14px}.main-head{display:block}.head-actions{margin-top:14px;justify-content:flex-start;gap:8px}.main-head h2{font-size:23px}.process-panel :deep(.el-card__body){padding-left:14px;padding-right:14px}.progress-row{gap:8px}.progress-description{font-size:11px}.month-field{font-size:12px}.pricing-month{padding:7px 9px}.operation-records{padding:18px}}
@media(max-width:760px){:global(.app-layout:has(.monthly-reprice-page)>.sidebar){display:none}:global(.app-layout:has(.monthly-reprice-page) .main-container){min-width:0}:global(.app-layout:has(.monthly-reprice-page) .navbar .unit-tag){display:none}:global(.app-layout:has(.monthly-reprice-page) .navbar-left){min-width:0}:global(.app-layout:has(.monthly-reprice-page) .breadcrumb){white-space:nowrap}}
</style>
