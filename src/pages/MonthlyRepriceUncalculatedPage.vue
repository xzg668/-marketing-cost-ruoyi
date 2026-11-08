<template>
  <div class="uncalculated-page">
    <div class="page-heading"><div><h2>未核算明细</h2><p>查看未完成的客户产品及原报价资料，完善后可再次核算。</p></div>
      <el-button @click="backToBatch">返回月度调价</el-button></div>
    <el-form inline class="filters" @submit.prevent="search">
      <el-form-item label="月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" aria-label="月份" :disabled="busy" /></el-form-item>
      <el-form-item label="客户"><el-input v-model="customer" clearable maxlength="255" placeholder="客户名称或编号" :disabled="busy" /></el-form-item>
      <el-form-item label="产品料号"><el-input v-model="product" clearable maxlength="255" placeholder="产品料号" :disabled="busy" /></el-form-item>
      <el-form-item label="状态"><el-select v-model="status" clearable placeholder="全部未核算" :disabled="busy" style="width:155px">
        <el-option v-for="(label,value) in statusLabels" :key="value" :label="label" :value="value" />
      </el-select></el-form-item>
      <el-form-item><el-button type="primary" native-type="submit" :loading="loading" :disabled="busy">查询</el-button></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <MonthlyRepriceStatistics :statistics="data?.statistics" />
    <el-alert v-for="problem in data?.batchProblems || []" :key="problem" :title="problem" type="error" :closable="false" />
    <el-card shadow="never">
      <template #header><div class="list-heading"><span>未核算记录 {{ data?.total ?? '—' }} 条</span>
        <div><el-button :disabled="busy || loading" @click="load">刷新</el-button>
          <el-button v-if="data?.canOperate" type="primary" :loading="busy" :disabled="loading || !selection.length" @click="retry(selection)">再次核算所选（{{ selection.length }}）</el-button></div>
      </div></template>
      <p class="list-note">同料号、同客户保留一条客户结果；缺客户资料的原报价单独列出。再次核算只提交所选未成功记录，正在运行的任务会继续处理。</p>
      <el-table v-loading="loading" :data="data?.list || []" :row-key="rowKey" @selection-change="selection = $event" stripe>
        <el-table-column v-if="data?.canOperate" type="selection" width="45" :selectable="row => row.canRetry && !busy && !loading" />
        <el-table-column prop="productCode" label="产品料号" min-width="125" />
        <el-table-column label="客户" min-width="120"><template #default="{row}">{{ row.customer || '待完善客户' }}</template></el-table-column>
        <el-table-column prop="oaNo" label="采用的OA / 待完善OA" min-width="145" />
        <el-table-column prop="sourceCount" label="来源数" width="75" />
        <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="row.status === 'RUNNING' || row.status === 'PENDING' ? 'info' : 'warning'">{{ statusLabels[row.status] || row.status }}</el-tag></template></el-table-column>
        <el-table-column label="原因及物料" min-width="210"><template #default="{row}">
          <span class="reason-summary" :title="row.reason">{{ row.reason }}</span><el-button v-if="row.materials?.length" link type="primary" @click="detail = row">查看 {{ row.materials.length }} 条物料明细</el-button>
        </template></el-table-column>
        <el-table-column prop="retryCount" label="已重试" width="70" />
        <el-table-column label="最近尝试" min-width="150"><template #default="{row}">{{ row.lastAttemptAt?.replace('T',' ') || '尚未尝试' }}</template></el-table-column>
        <el-table-column v-if="data?.canOperate" label="操作" width="100" fixed="right"><template #default="{row}">
          <el-button link type="primary" :disabled="!row.canRetry || busy || loading" @click="retry([row])">再次核算</el-button>
        </template></el-table-column>
        <template #empty>{{ data?.repriceNo ? '当前查询条件下没有未核算记录' : '该月份暂无可查看的调价批次' }}</template>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="20" :total="data?.total || 0" :disabled="busy || loading" layout="total, prev, pager, next" @current-change="load" />
    </el-card>
    <el-dialog :model-value="!!detail" title="待处理物料明细" width="min(900px, 95vw)" @close="detail = null">
      <template v-if="detail"><p>{{ detail.productCode }} · {{ detail.customer || '待完善客户' }} · {{ detail.oaNo }}</p>
        <el-table :data="detail.materials" max-height="520"><el-table-column prop="materialCode" label="物料编码" min-width="160" />
          <el-table-column prop="materialName" label="物料名称" min-width="160" /><el-table-column prop="message" label="待处理原因" min-width="280" />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import { fetchUncalculatedReprice, retryReprice } from '../api/monthlyReprice'
import MonthlyRepriceStatistics from '../components/MonthlyRepriceStatistics.vue'

const route = useRoute(), router = useRouter(), user = useUserStore()
const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
const routeMonth = () => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(route.query.month || '')) ? String(route.query.month) : defaultMonth
const month = ref(routeMonth()), customer = ref(''), product = ref(''), status = ref(''), page = ref(1)
const data = ref(null), selection = ref([]), detail = ref(null), error = ref(''), loading = ref(false), busy = ref(false)
const statusLabels = { FAILED:'核算失败', PENDING:'等待核算', RUNNING:'正在核算', WAIT_CUSTOMER:'客户待完善', DATA_ISSUE:'资料异常' }
const rowKey = row => `${row.kind}:${row.id}`
let generation = 0, requestNo = 0, timer
async function load() {
  const current = generation, id = ++requestNo
  selection.value = []; detail.value = null; loading.value = true; error.value = ''
  try {
    const value = await fetchUncalculatedReprice({ month:month.value, customer:customer.value || undefined,
      product:product.value || undefined, status:status.value || undefined, page:page.value, size:20 })
    if(current === generation && id === requestNo) data.value = value
  } catch(e) { if(current === generation && id === requestNo) { data.value = null; error.value = e.message || '未核算明细读取失败' } }
  finally { if(current === generation && id === requestNo) loading.value = false }
}
function search() { if(!busy.value) { page.value = 1; load() } }
async function retry(rows) {
  if(busy.value || loading.value || !data.value?.canOperate) return
  const targets = rows.filter(row => row.canRetry)
  if(!targets.length) return
  const no = data.value.repriceNo, current = generation
  busy.value = true; error.value = ''
  try {
    await retryReprice(no, { taskIds:targets.filter(r => r.kind === 'TASK').map(r => r.id),
      sourceIds:targets.filter(r => r.kind === 'SOURCE').map(r => r.id) })
    if(current === generation) await load()
  } catch(e) { if(current === generation) error.value = e.message || '再次核算失败，请刷新检查' }
  finally { if(current === generation) busy.value = false }
}
function reset() { generation++; requestNo++; data.value = null; selection.value = []; detail.value = null; busy.value = false; page.value = 1; load() }
function backToBatch() { router.push('/cost/monthly-reprice') }
watch(() => user.businessUnitType, reset)
watch(() => route.query.month, async () => { month.value = routeMonth(); await nextTick(); reset() })
watch([month,customer,product,status], () => { requestNo++; selection.value = []; data.value = null; detail.value = null; loading.value = false })
onMounted(() => { load(); timer = setInterval(() => { if(!busy.value && !loading.value && !selection.value.length && !detail.value && data.value) load() },5000) })
onUnmounted(() => { generation++; requestNo++; clearInterval(timer) })
</script>
<style scoped>
.uncalculated-page{max-width:1800px;margin:12px auto;padding:0 12px;display:grid;gap:16px;min-width:0}
.page-heading,.list-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-heading h2{margin:0;font-size:25px;font-weight:600}
.page-heading p,.list-note{font-size:13px;color:#737e8b;line-height:1.7}.page-heading p{margin:9px 0 0}.list-note{margin-top:0}
.filters{padding:18px 18px 0;background:white;border:1px solid #e5e9f0;border-radius:6px}.filters :deep(.el-date-editor){width:145px}
.el-pagination{margin-top:18px;justify-content:flex-end}.el-table .el-button{white-space:normal;text-align:left}
.reason-summary{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;line-height:1.6}
@media(max-width:760px){.page-heading,.list-heading{align-items:flex-start;flex-wrap:wrap}.uncalculated-page{padding:0}.filters{padding:12px 12px 0}}
</style>
