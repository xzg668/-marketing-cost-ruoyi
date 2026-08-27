<template>
  <div class="finance-review-page" v-loading="loading">
    <div class="page-heading">
      <div>
        <h2>补录审核</h2>
        <p>审核由你发起核算的报价补录；BOM、包装和底层价格逐项确认后统一生效。</p>
      </div>
      <div>
        <el-switch v-model="showCompleted" active-text="已审" inactive-text="待审" @change="loadReviews()" />
        <el-button class="refresh-button" @click="loadReviews()">刷新</el-button>
      </div>
    </div>

    <el-result
      v-if="accessDenied && !loading"
      icon="warning"
      title="当前账号没有补录审核权限"
      sub-title="请使用发起本次核算的报价账号，或被指定的财务审核账号登录。"
    />

    <el-empty v-else-if="!reviews.length && !loading" description="当前没有分配给你的审核任务" />

    <div v-else class="review-layout">
      <el-card shadow="never" class="review-list-card">
        <template #header><strong>{{ showCompleted ? '本人已审' : '本人待审' }}</strong></template>
        <button
          v-for="review in reviews" :key="review.reviewId" type="button"
          class="review-row" :class="{ active: review.reviewId === activeReviewId }"
          @click="selectReview(review.reviewId)"
        >
          <strong>{{ review.oaNo }}</strong>
          <span>{{ review.reviewNo }} · 第{{ review.reviewRound }}轮</span>
          <span>{{ review.productCount }}个产品 · {{ review.priceDraftCount }}项补价</span>
        </button>
      </el-card>

      <el-card v-if="detail" shadow="never" class="detail-card">
        <template #header>
          <div class="detail-heading">
            <div><strong>{{ detail.oaNo }}</strong><span>第{{ detail.reviewRound }}轮审核</span></div>
            <el-tag :type="reviewStatusType(detail.status)" effect="plain">{{ reviewDisplayStatusLabel }}</el-tag>
          </div>
        </template>

        <div class="summary-strip">
          <span>产品 {{ detail.productCount }}</span>
          <span>补价 {{ detail.priceDraftCount }}</span>
          <span>已通过 {{ detail.passedCount }}</span>
          <span>待修改 {{ detail.rejectedCount }}</span>
        </div>

        <div class="item-layout">
          <div class="item-list">
            <button
              v-for="item in detail.items" :key="item.reviewItemId" type="button"
              class="item-row" :class="{ active: item.reviewItemId === activeItemId }"
              @click="selectItem(item.reviewItemId)"
            >
              <span>{{ productCode(item.productTaskId) }}</span>
              <strong>{{ item.itemTypeLabel }}</strong>
              <small v-if="item.summary" class="item-summary">{{ item.summary }}</small>
              <el-tag size="small" :type="decisionType(item.decision)" effect="plain">{{ decisionLabel(item.decision) }}</el-tag>
            </button>
          </div>

          <div v-loading="itemLoading" class="item-detail">
            <template v-if="activeItem">
              <h3>{{ activeItem.productCode }} · {{ activeItem.itemTypeLabel }}</h3>
              <p class="muted">{{ activeItem.productName }} · {{ activeItem.summary }}</p>

              <section>
                <h4>{{ activeItem.itemType === 'PRICE_DRAFT' ? '本次补价与参考价格对比' : '技术本次填写' }}</h4>
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item
                    v-for="entry in technicalEntries" :key="entry.key" :label="entry.label"
                  >{{ entry.value }}</el-descriptions-item>
                </el-descriptions>
                <el-empty v-if="!technicalEntries.length" description="本项没有可展示的差异字段" :image-size="56" />
              </section>

              <section>
                <h4>系统校验结论</h4>
                <el-alert
                  :type="validationPassed ? 'success' : 'error'" :closable="false" show-icon
                  :title="validationPassed ? '校验通过' : '校验未通过，请退回技术修改'"
                />
              </section>

              <el-alert
                v-if="activeItem.decisionReason" type="warning" :closable="false"
                :title="`退回原因：${activeItem.decisionReason}`" class="decision-reason"
              />

              <div v-if="canDecide && activeItem.decision === 'PENDING'" class="item-actions">
                <el-button type="danger" plain @click="rejectItem">退回本项</el-button>
                <el-button type="primary" @click="passItem">本项通过</el-button>
              </div>
            </template>
            <el-empty v-else description="请选择左侧审核项" />
          </div>
        </div>

        <div v-if="canDecide" class="footer-actions">
          <span class="muted">逐项处理后，只保留一个最终操作。</span>
          <el-button v-if="detail.rejectedCount > 0 && noPending" type="danger" :loading="acting" @click="submitReject">
            退回技术修改
          </el-button>
          <el-button v-else type="primary" :disabled="!detail.canApprove" :loading="acting" @click="submitApprove">
            审核通过并生效
          </el-button>
        </div>
        <div v-else-if="canRetryRecheck" class="footer-actions">
          <span class="muted">正式价格已发布，但系统重新取价失败；重试不会重复发布。</span>
          <el-button type="primary" :loading="acting" @click="retryRecheck">重试重新取价</el-button>
        </div>
        <div v-else-if="businessGapReturned" class="footer-actions">
          <span class="muted">重新取价发现仍有真实缺价，系统已把新缺口退回原技术人员；技术重新提交后会生成新一轮审核。</span>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { isDomainError, showErrorOnce } from '../../../utils/errorHandler'
import {
  approveFinanceReview,
  decideFinanceReviewItem,
  fetchFinanceReview,
  fetchFinanceReviewItem,
  fetchMyFinanceReviews,
  rejectFinanceReview,
  retryFinanceReviewRecheck,
} from '../../../api/financeCollaborationReviews'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const itemLoading = ref(false)
const acting = ref(false)
const showCompleted = ref(false)
const reviews = ref([])
const detail = ref(null)
const activeReviewId = ref(null)
const activeItemId = ref(null)
const activeItem = ref(null)
const accessDenied = ref(false)

const canDecide = computed(() => ['PENDING', 'PARTIAL'].includes(detail.value?.status))
const noPending = computed(() => detail.value?.items?.every(item => item.decision !== 'PENDING'))
const validationPassed = computed(() => activeItem.value?.validation?.status === 'PASSED')
const technicalEntries = computed(() => flattenTechnicalInput(activeItem.value?.technicalInput))
const productStatuses = computed(() => detail.value?.products?.map(item => item.taskStatus) || [])
const businessGapReturned = computed(() => detail.value?.status === 'FAILED'
  && productStatuses.value.includes('RETURNED_TO_TECH'))
const canRetryRecheck = computed(() => detail.value?.status === 'FAILED'
  && productStatuses.value.includes('PUBLISH_OR_REPRICE_FAILED'))
const reviewDisplayStatusLabel = computed(() => businessGapReturned.value
  ? '发现缺价，已退回技术'
  : reviewStatusLabel(detail.value?.status))

async function loadReviews(resolveDeepLink = false) {
  loading.value = true
  accessDenied.value = false
  try {
    const requested = route.params.reviewId ? Number(route.params.reviewId) : null
    if (resolveDeepLink && requested) {
      const requestedDetail = await fetchFinanceReview(requested)
      showCompleted.value = !['PENDING', 'PARTIAL'].includes(requestedDetail.status)
    }
    const response = await fetchMyFinanceReviews(showCompleted.value)
    reviews.value = response?.items || []
    const target = reviews.value.find(item => item.reviewId === requested)?.reviewId
      || reviews.value[0]?.reviewId || null
    if (target) await selectReview(target, false)
    else clearDetail()
  } catch (error) {
    clearDetail()
    reviews.value = []
    if (isDomainError(error, 'TASK_ASSIGNEE_MISMATCH')) accessDenied.value = true
    else showErrorOnce(error, '审核清单加载失败')
  }
  finally { loading.value = false }
}

async function selectReview(reviewId, updateRoute = true) {
  activeReviewId.value = reviewId
  activeItemId.value = null
  activeItem.value = null
  try {
    detail.value = await fetchFinanceReview(reviewId)
    if (updateRoute && route.params.reviewId !== String(reviewId)) {
      router.replace(`/collaboration/finance-reviews/${reviewId}`)
    }
    if (detail.value.items?.length) await selectItem(detail.value.items[0].reviewItemId)
  } catch (error) { showErrorOnce(error, '审核详情加载失败') }
}

async function selectItem(itemId) {
  activeItemId.value = itemId
  itemLoading.value = true
  try { activeItem.value = await fetchFinanceReviewItem(activeReviewId.value, itemId) }
  catch (error) { showErrorOnce(error, '审核项加载失败') }
  finally { itemLoading.value = false }
}

async function passItem() {
  await decide('PASSED', null, '本项已通过')
}

async function rejectItem() {
  let value
  try {
    value = await ElMessageBox.prompt('请明确写出技术需要修改的内容', '退回本项', {
      confirmButtonText: '确认退回', cancelButtonText: '取消', inputPattern: /\S+/,
      inputErrorMessage: '退回原因不能为空', type: 'warning',
    })
  } catch { return }
  await decide('REJECTED', value.value.trim(), '已标记为退回')
}

async function decide(decision, reason, message) {
  acting.value = true
  try {
    detail.value = await decideFinanceReviewItem(
      activeReviewId.value, activeItemId.value, decision, reason)
    await selectItem(activeItemId.value)
    ElMessage.success(message)
  } catch (error) { showErrorOnce(error, '保存审核结论失败') }
  finally { acting.value = false }
}

async function submitReject() {
  await finalAction(() => rejectFinanceReview(activeReviewId.value), '已退回原技术人员修改')
}

async function submitApprove() {
  try {
    await ElMessageBox.confirm('通过后将发布正式价格并按当前报价重新取价，确认继续？', '统一审核通过', {
      confirmButtonText: '确认通过', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  await finalAction(() => approveFinanceReview(activeReviewId.value), '审核已通过，数据已准备完成')
}

async function retryRecheck() {
  await finalAction(() => retryFinanceReviewRecheck(activeReviewId.value), '重新取价成功，数据已准备完成')
}

async function finalAction(action, message) {
  acting.value = true
  try {
    detail.value = await action()
    ElMessage.success(message)
    await loadReviews()
  } catch (error) { showErrorOnce(error, '提交失败') }
  finally { acting.value = false }
}

function clearDetail() {
  activeReviewId.value = null
  activeItemId.value = null
  activeItem.value = null
  detail.value = null
}

function productCode(productTaskId) {
  return detail.value?.products?.find(item => item.productTaskId === productTaskId)?.productCode || '新品暂无料号'
}

function flattenTechnicalInput(value) {
  if (!value || typeof value !== 'object') return []
  const fields = Array.isArray(value.fields) ? value.fields : null
  if (fields) return fields.map((field, index) => ({
    key: `${field.section || ''}-${field.row || ''}-${field.code || index}`,
    label: field.name || field.code || `字段${index + 1}`,
    value: displayValue(field.target),
  }))
  return Object.entries(value).map(([key, item]) => ({ key, label: key, value: displayValue(item) }))
}

function displayValue(value) {
  if (value == null || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function decisionLabel(value) { return ({ PENDING: '待确认', PASSED: '已通过', REJECTED: '待修改' })[value] || value }
function decisionType(value) { return value === 'PASSED' ? 'success' : value === 'REJECTED' ? 'danger' : 'warning' }
function reviewStatusLabel(value) { return ({ PENDING: '待审核', PARTIAL: '审核中', REJECTED: '已退回', APPROVED: '已通过', PUBLISHING: '发布中', EFFECTIVE: '已生效', FAILED: '重新取价失败' })[value] || value }
function reviewStatusType(value) { return value === 'EFFECTIVE' ? 'success' : value === 'FAILED' || value === 'REJECTED' ? 'danger' : 'warning' }

onMounted(() => loadReviews(true))
</script>

<style scoped>
.finance-review-page { min-width: 900px; }
.item-summary { color: #909399; font-size: 12px; font-weight: 400; }
.page-heading, .detail-heading, .footer-actions { display: flex; align-items: center; justify-content: space-between; }
.page-heading { margin-bottom: 16px; }
.page-heading h2 { margin: 0 0 7px; font-size: 24px; }
.page-heading p, .muted { margin: 0; color: #909399; font-size: 13px; }
.refresh-button { margin-left: 14px; }
.review-layout { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 14px; }
.review-list-card, .detail-card { min-height: 520px; }
.review-row, .item-row { width: 100%; border: 0; border-bottom: 1px solid #ebeef5; background: #fff; text-align: left; cursor: pointer; }
.review-row { display: flex; flex-direction: column; gap: 6px; padding: 14px 10px; }
.review-row span { color: #909399; font-size: 12px; }
.review-row.active, .item-row.active { background: #ecf5ff; box-shadow: inset 3px 0 #409eff; }
.detail-heading div { display: flex; align-items: center; gap: 12px; }
.detail-heading span { color: #909399; font-size: 13px; }
.summary-strip { display: flex; gap: 30px; padding: 10px 14px; background: #f5f7fa; }
.item-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 390px; margin-top: 14px; border: 1px solid #ebeef5; }
.item-list { border-right: 1px solid #ebeef5; }
.item-row { display: grid; grid-template-columns: 1fr; gap: 5px; padding: 12px 14px; }
.item-row .el-tag { justify-self: start; }
.item-detail { padding: 18px; }
.item-detail h3 { margin: 0 0 6px; }
.item-detail section { margin-top: 20px; }
.item-detail h4 { margin: 0 0 10px; }
.decision-reason { margin-top: 18px; }
.item-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
.footer-actions { margin-top: 14px; padding-top: 14px; border-top: 1px solid #ebeef5; }
@media (max-width: 1100px) { .review-layout { grid-template-columns: 230px minmax(0, 1fr); } }
</style>
