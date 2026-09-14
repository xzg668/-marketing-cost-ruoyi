<template>
  <div class="technical-review-page">
    <template v-if="!taskId">
      <div class="page-heading">
        <div>
          <h2>补录审核</h2>
          <p>按产品、版本和模块审核技术资料；退回后只开放被退回模块。</p>
        </div>
        <el-button :loading="loading" @click="loadList">刷新</el-button>
      </div>
      <el-card shadow="never">
        <div class="filters">
          <el-select v-model="filters.taskStatus" clearable placeholder="全部状态" @change="reload">
            <el-option label="待审核" value="SUBMITTED" />
            <el-option label="部分退回" value="PARTIALLY_RETURNED" />
            <el-option label="已通过" value="APPROVED" />
          </el-select>
          <el-date-picker v-model="filters.accountingMonth" type="month" value-format="YYYY-MM" placeholder="核算月份" @change="reload" />
          <el-input v-model="keyword" clearable placeholder="搜索任务号 / OA单号 / 技术负责人" />
        </div>
        <el-table v-loading="loading" :data="visibleRecords" empty-text="当前没有补录审核任务">
          <el-table-column prop="taskNo" label="协作任务" min-width="250" />
          <el-table-column prop="oaNo" label="关联报价单" min-width="180" />
          <el-table-column prop="accountingMonth" label="核算月份" width="115" />
          <el-table-column prop="assigneeName" label="技术负责人" width="130" />
          <el-table-column prop="reviewRound" label="审核轮次" width="100">
            <template #default="{ row }">第 {{ row.reviewRound }} 轮</template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }"><el-tag :type="statusType(row.taskStatus)">{{ statusLabel(row.taskStatus) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="openTask(row.id)">进入审核</el-button></template>
          </el-table-column>
        </el-table>
        <div class="pagination"><el-pagination v-model:current-page="page.current" :page-size="page.size" :total="page.total" layout="total, prev, pager, next" @current-change="loadList" /></div>
      </el-card>
    </template>

    <template v-else>
      <button class="back-link" type="button" @click="back">← 返回补录审核</button>
      <div class="page-heading">
        <div>
          <h2>补录审核详情</h2>
          <p v-if="review">{{ review.task.taskNo }} / {{ review.task.oaNo }} / {{ review.task.accountingMonth }}</p>
        </div>
        <el-button :loading="loading" @click="loadDetail">刷新</el-button>
      </div>
      <el-skeleton v-if="loading && !review" :rows="8" animated />
      <template v-else-if="review">
        <div class="summary">
          <div><span>技术负责人</span><b>{{ review.task.assigneeName }}</b></div>
          <div><span>审核轮次</span><b>第 {{ review.task.reviewRound }} 轮</b></div>
          <div><span>待审核</span><b>{{ review.pendingCount }}</b></div>
          <div><span>已通过</span><b>{{ review.passedCount }}</b></div>
          <div><span>已退回</span><b>{{ review.returnedCount }}</b></div>
          <div><span>任务状态</span><b>{{ statusLabel(review.task.taskStatus) }}</b></div>
        </div>
        <el-alert v-if="review.task.taskStatus === 'PARTIALLY_RETURNED'" title="本轮已汇总退回；V1永久保留，系统已复制下一版草稿且只开放退回模块。" type="warning" :closable="false" />
        <el-alert v-if="review.task.taskStatus === 'APPROVED'" title="全部必审模块已通过，当前提交版本已成为产品有效版本。" type="success" :closable="false" />
        <el-card class="review-card" shadow="never">
          <el-table :data="review.reviewItems" border>
            <el-table-column label="产品料号" min-width="150">
              <template #default="{ row }">{{ productOf(row.productId)?.materialNo || '-' }}</template>
            </el-table-column>
            <el-table-column label="产品名称" min-width="150">
              <template #default="{ row }">{{ productOf(row.productId)?.productName || '-' }}</template>
            </el-table-column>
            <el-table-column label="提交版本" width="105">
              <template #default="{ row }">V{{ row.submittedVersionNo }}</template>
            </el-table-column>
            <el-table-column label="模块" width="105">
              <template #default="{ row }">{{ moduleLabel(row.moduleType) }}</template>
            </el-table-column>
            <el-table-column label="审核结论" width="115">
              <template #default="{ row }"><el-tag :type="decisionType(row.decision)">{{ decisionLabel(row.decision) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="审核来源" min-width="155">
              <template #default="{ row }">{{ row.inheritedFromReviewItemId ? `继承审核项 #${row.inheritedFromReviewItemId}` : '本轮人工审核' }}</template>
            </el-table-column>
            <el-table-column prop="decisionReason" label="意见" min-width="180" show-overflow-tooltip />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="inspect(row)">查看明细</el-button>
                <template v-if="row.decision === 'PENDING' && review.task.taskStatus === 'SUBMITTED'">
                  <el-button link type="success" :loading="decidingId === row.id" @click="decide(row, 'PASSED')">通过</el-button>
                  <el-button link type="danger" :loading="decidingId === row.id" @click="decide(row, 'RETURNED')">退回</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
    </template>

    <el-drawer v-model="drawer" title="审核项明细" size="66%">
      <el-skeleton v-if="itemLoading" :rows="6" animated />
      <template v-else-if="itemDetail">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="产品料号">{{ itemDetail.product.materialNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{ itemDetail.product.productName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="模块">{{ moduleLabel(itemDetail.reviewItem.moduleType) }}</el-descriptions-item>
          <el-descriptions-item label="提交版本">V{{ itemDetail.reviewItem.submittedVersionNo }}</el-descriptions-item>
          <el-descriptions-item label="结论">{{ decisionLabel(itemDetail.reviewItem.decision) }}</el-descriptions-item>
          <el-descriptions-item label="可编辑模块">{{ itemDetail.editableModules.map(moduleLabel).join('、') || '无' }}</el-descriptions-item>
        </el-descriptions>
        <pre class="data-preview">{{ pretty(itemDetail.moduleData) }}</pre>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  decideTechnicalDataReviewItem,
  fetchMyTechnicalDataReviews,
  fetchTechnicalDataReviewItem,
  fetchTechnicalDataReviewTask,
} from '../../../api/technicalDataReviews'
import { showErrorOnce } from '../../../utils/errorHandler'

const route = useRoute()
const router = useRouter()
const taskId = computed(() => route.params.taskId || '')
const loading = ref(false)
const review = ref(null)
const records = ref([])
const keyword = ref('')
const filters = reactive({ taskStatus: 'SUBMITTED', accountingMonth: '' })
const page = reactive({ current: 1, size: 20, total: 0 })
const decidingId = ref(null)
const drawer = ref(false)
const itemLoading = ref(false)
const itemDetail = ref(null)

const visibleRecords = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  if (!key) return records.value
  return records.value.filter((row) => [row.taskNo, row.oaNo, row.assigneeName]
    .some((value) => String(value || '').toLowerCase().includes(key)))
})

async function loadList() {
  loading.value = true
  try {
    const result = await fetchMyTechnicalDataReviews({ ...filters, ...page })
    records.value = result?.records || []
    page.total = Number(result?.total || 0)
  } catch (error) {
    records.value = []
    showErrorOnce(error, '补录审核列表加载失败')
  } finally { loading.value = false }
}

async function loadDetail() {
  loading.value = true
  try { review.value = await fetchTechnicalDataReviewTask(taskId.value) }
  catch (error) { review.value = null; showErrorOnce(error, '补录审核详情加载失败') }
  finally { loading.value = false }
}

function reload() { page.current = 1; loadList() }
function openTask(id) { router.push(`/collaboration/technical-data/reviews/${id}`) }
function back() { router.push('/collaboration/finance-reviews') }
function productOf(id) { return review.value?.task?.products?.find((product) => product.id === id) }

async function inspect(item) {
  drawer.value = true
  itemLoading.value = true
  try { itemDetail.value = await fetchTechnicalDataReviewItem(taskId.value, item.id) }
  catch (error) { itemDetail.value = null; showErrorOnce(error, '审核项明细加载失败') }
  finally { itemLoading.value = false }
}

async function decide(item, decision) {
  let reason = ''
  try {
    const input = await ElMessageBox.prompt(
      decision === 'RETURNED' ? '请填写明确的退回原因' : '可填写通过意见；管理员代操作时必填',
      decision === 'RETURNED' ? '退回模块' : '通过模块',
      { inputPlaceholder: '审核意见', inputValidator: (value) => decision === 'PASSED' || String(value || '').trim() ? true : '退回原因不能为空' },
    )
    reason = input.value
  } catch { return }
  decidingId.value = item.id
  try {
    const result = await decideTechnicalDataReviewItem(
      taskId.value, item, decision, review.value.task.taskVersion, reason,
    )
    review.value = result.detail
    ElMessage.success(decision === 'RETURNED' ? '该模块已退回' : '该模块已通过')
  } catch (error) {
    showErrorOnce(error, '审核处理失败')
    await loadDetail()
  } finally { decidingId.value = null }
}

function moduleLabel(value) { return ({ PROFILE: '产品信息', PACKAGE: '包装', AUXILIARY: '辅料', SALARY: '工资' })[value] || value }
function decisionLabel(value) { return ({ PENDING: '待审核', PASSED: '已通过', RETURNED: '已退回' })[value] || value }
function decisionType(value) { return value === 'PASSED' ? 'success' : value === 'RETURNED' ? 'danger' : 'warning' }
function statusLabel(value) { return ({ SUBMITTED: '审核中', PARTIALLY_RETURNED: '部分退回', APPROVED: '已通过', CANCELLED: '已作废' })[value] || value }
function statusType(value) { return value === 'APPROVED' ? 'success' : value === 'PARTIALLY_RETURNED' ? 'danger' : 'warning' }
function pretty(value) { return JSON.stringify(value, null, 2) }

watch(taskId, () => { if (taskId.value) loadDetail(); else loadList() })
onMounted(() => { if (taskId.value) loadDetail(); else loadList() })
</script>

<style scoped>
.technical-review-page { min-width: 900px; color: #303846; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.page-heading h2 { margin: 0 0 6px; font-size: 24px; }
.page-heading p { margin: 0; color: #7d8999; }
.filters { display: grid; grid-template-columns: 160px 170px 320px; gap: 12px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.back-link { margin-bottom: 14px; padding: 0; border: 0; background: transparent; color: #318de5; cursor: pointer; }
.summary { display: grid; grid-template-columns: repeat(6, 1fr); margin-bottom: 16px; border: 1px solid #e1e6ee; background: #fff; }
.summary div { padding: 13px 16px; border-right: 1px solid #edf0f4; }
.summary span { display: block; color: #8a95a4; font-size: 12px; }
.summary b { display: block; margin-top: 5px; }
.review-card { margin-top: 16px; }
.data-preview { margin-top: 18px; padding: 16px; overflow: auto; border: 1px solid #e2e7ee; background: #f7f9fc; line-height: 1.6; white-space: pre-wrap; }
</style>
