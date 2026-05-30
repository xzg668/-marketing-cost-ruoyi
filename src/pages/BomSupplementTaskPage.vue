<template>
  <div class="bom-task-page">
    <section class="page-header">
      <div>
        <h1>BOM 补录任务</h1>
        <p>查看技术员提交内容、包装调整差异和完整 BOM 预览，并完成财务确认或退回。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadTasks">刷新</el-button>
    </section>

    <section class="query-band">
      <el-form :inline="true" class="query-form">
        <el-form-item label="任务号">
          <el-input
            v-model="query.taskNo"
            placeholder="QBP-"
            clearable
            @keyup.enter="loadTasks"
          />
        </el-form-item>
        <el-form-item label="OA 编号">
          <el-input
            v-model="query.oaNo"
            placeholder="OA"
            clearable
            @keyup.enter="loadTasks"
          />
        </el-form-item>
        <el-form-item label="产品料号">
          <el-input
            v-model="query.productCode"
            placeholder="产品料号"
            clearable
            @keyup.enter="loadTasks"
          />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="query.taskStatus" placeholder="全部" clearable>
            <el-option label="技术处理中" value="IN_PROGRESS" />
            <el-option label="财务审核" value="FINANCE_REVIEW" />
            <el-option label="已确认" value="APPROVED" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="query.reviewStatus" placeholder="全部" clearable>
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已退回" value="RETURNED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="loadTasks">
            查询
          </el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-band">
      <el-table :data="rows" v-loading="loading" stripe empty-text="暂无补录任务">
        <el-table-column prop="taskNo" label="任务号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productCode" label="产品料号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="customerCode" label="客户" width="120" show-overflow-tooltip />
        <el-table-column label="任务类型" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ labelForTaskType(row.taskType) }}</template>
        </el-table-column>
        <el-table-column label="任务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.taskStatus)" effect="plain">
              {{ labelForTaskStatus(row.taskStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.reviewStatus)" effect="plain">
              {{ labelForReviewStatus(row.reviewStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交内容" width="150">
          <template #default="{ row }">
            <span>本体 {{ row.supplementLineCount || 0 }} / 包装 {{ row.packageLineCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="DocumentChecked" @click="openDetail(row.taskId)">
              查看审核
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-row">
        <el-pagination
          v-model:current-page="query.pageNo"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadTasks"
          @current-change="loadTasks"
        />
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      size="88%"
      :title="detailTitle"
      class="task-detail-drawer"
      @closed="detail = null"
    >
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <section class="detail-section">
            <div class="section-title">任务信息</div>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="任务号">{{ task.taskNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="OA 编号">{{ detail.preparation?.oaNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="任务类型">{{ labelForTaskType(task.taskType) }}</el-descriptions-item>
              <el-descriptions-item label="产品料号">{{ task.productCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="产品名称">{{ task.productName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ task.productModel || '-' }}</el-descriptions-item>
              <el-descriptions-item label="客户">{{ task.customerCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="期间">{{ detail.preparation?.periodMonth || '-' }}</el-descriptions-item>
              <el-descriptions-item label="包装方式">{{ task.packageMethod || '-' }}</el-descriptions-item>
              <el-descriptions-item label="任务状态">
                <el-tag :type="statusTagType(task.taskStatus)" effect="plain">
                  {{ labelForTaskStatus(task.taskStatus) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="审核状态">
                <el-tag :type="statusTagType(detail.preparation?.reviewStatus)" effect="plain">
                  {{ labelForReviewStatus(detail.preparation?.reviewStatus) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="技术员">{{ task.technicianName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="缺口说明" :span="3">
                {{ task.missingReason || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="审核意见" :span="3">
                {{ task.remark || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="detail-section">
            <div class="section-title">本体 BOM 明细</div>
            <el-alert
              v-if="formalBodyLines.length"
              type="info"
              show-icon
              :closable="false"
              title="当前任务本体 BOM 已有正式明细，财务只读确认。"
            />
            <el-table
              :data="bodyLines"
              size="small"
              border
              empty-text="暂无本体 BOM 明细"
              class="dense-table"
            >
              <el-table-column prop="lineNo" label="行号" width="70" />
              <el-table-column prop="level" label="层级" width="70" />
              <el-table-column prop="parentCode" label="母件" min-width="130" show-overflow-tooltip />
              <el-table-column prop="materialCode" label="子件料号" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialName" label="子件名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialSpec" label="规格" min-width="130" show-overflow-tooltip />
              <el-table-column prop="qtyPerParent" label="用量" width="110" />
              <el-table-column prop="qtyPerTop" label="累计用量" width="110" />
              <el-table-column prop="parentBaseQty" label="母件底数" width="110" />
              <el-table-column prop="unit" label="单位" width="80" />
              <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
            </el-table>
          </section>

          <section class="detail-section">
            <div class="section-title">包装参考成品料号</div>
            <el-descriptions :column="4" border>
              <el-descriptions-item label="裸品料号">
                {{ detail.packageReference?.bareProductCode || detail.preparation?.bareProductCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="参考成品料号">
                {{ detail.packageReference?.referenceFinishedCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="来源顶层料号">
                {{ detail.packageReference?.sourceTopProductCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="参考状态">
                {{ detail.packageReference?.referenceStatus || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="detail-section">
            <div class="section-title">包装组件明细</div>
            <el-table
              :data="packageLines"
              size="small"
              border
              empty-text="暂无包装组件明细"
              class="dense-table"
            >
              <el-table-column prop="referenceFinishedCode" label="参考成品" min-width="140" show-overflow-tooltip />
              <el-table-column prop="sourceTopProductCode" label="来源顶层料号" min-width="140" show-overflow-tooltip />
              <el-table-column prop="packageParentCode" label="包装父件" min-width="140" show-overflow-tooltip />
              <el-table-column prop="packageMaterialCode" label="包装子件" min-width="140" show-overflow-tooltip />
              <el-table-column prop="packageMaterialName" label="子件名称" min-width="140" show-overflow-tooltip />
              <el-table-column label="父件用量" width="130">
                <template #default="{ row }">{{ displayPair(row.packageQtyPerParent, row.adjustedPackageQtyPerParent) }}</template>
              </el-table-column>
              <el-table-column label="父件累计" width="130">
                <template #default="{ row }">{{ displayPair(row.packageQtyPerTop, row.adjustedPackageQtyPerTop) }}</template>
              </el-table-column>
              <el-table-column label="子件用量" width="130">
                <template #default="{ row }">{{ displayPair(row.childQtyPerParent, row.adjustedChildQtyPerParent) }}</template>
              </el-table-column>
              <el-table-column label="子件累计" width="130">
                <template #default="{ row }">{{ displayPair(row.childQtyPerTop, row.adjustedChildQtyPerTop) }}</template>
              </el-table-column>
              <el-table-column label="差异" width="90">
                <template #default="{ row }">
                  <el-tag v-if="row.edited" type="warning" effect="plain">已调整</el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="130" show-overflow-tooltip />
            </el-table>
          </section>

          <section class="detail-section">
            <div class="section-title">技术员调整差异</div>
            <el-table
              :data="changeLogs"
              size="small"
              border
              empty-text="暂无调整差异"
              class="dense-table"
            >
              <el-table-column prop="fieldLabel" label="字段" min-width="140" show-overflow-tooltip />
              <el-table-column prop="beforeValue" label="修改前" min-width="120" show-overflow-tooltip />
              <el-table-column prop="afterValue" label="修改后" min-width="120" show-overflow-tooltip />
              <el-table-column prop="changedByName" label="提交人" width="110" />
              <el-table-column prop="changedAt" label="提交时间" min-width="170" show-overflow-tooltip />
              <el-table-column prop="changeReason" label="说明" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>

          <section class="detail-section">
            <div class="section-title">完整 BOM 预览</div>
            <el-table
              :data="completeBomLines"
              size="small"
              border
              empty-text="暂无完整 BOM 预览"
              class="dense-table"
            >
              <el-table-column label="来源" width="130">
                <template #default="{ row }">
                  <el-tag :type="row.sourceType === 'PACKAGE_REFERENCE' ? 'success' : 'info'" effect="plain">
                    {{ labelForSourceType(row.sourceType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="lineNo" label="行号" width="70" />
              <el-table-column prop="parentCode" label="母件" min-width="130" show-overflow-tooltip />
              <el-table-column prop="materialCode" label="子件料号" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialName" label="子件名称" min-width="150" show-overflow-tooltip />
              <el-table-column prop="materialSpec" label="规格" min-width="130" show-overflow-tooltip />
              <el-table-column prop="referenceFinishedCode" label="参考成品" min-width="130" show-overflow-tooltip />
              <el-table-column prop="sourceTopProductCode" label="来源顶层" min-width="130" show-overflow-tooltip />
              <el-table-column prop="qtyPerParent" label="用量" width="110" />
              <el-table-column prop="qtyPerTop" label="累计用量" width="110" />
              <el-table-column prop="parentBaseQty" label="母件底数" width="110" />
              <el-table-column prop="unit" label="单位" width="80" />
            </el-table>
          </section>

          <section class="review-footer">
            <el-input
              v-model="reviewComment"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="审核意见；退回时请填写需要技术员修改的内容"
            />
            <div class="review-actions">
              <el-button
                type="danger"
                plain
                :icon="Back"
                :disabled="!canReview"
                :loading="reviewing"
                @click="returnTask"
              >
                退回技术员
              </el-button>
              <el-button
                type="primary"
                :icon="Check"
                :disabled="!canReview"
                :loading="reviewing"
                @click="approveTask"
              >
                财务确认
              </el-button>
            </div>
          </section>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Check, DocumentChecked, Refresh, Search } from '@element-plus/icons-vue'
import {
  fetchBomSupplementTaskDetail,
  fetchBomSupplementTasks,
  labelForReviewStatus,
  labelForSourceType,
  labelForTaskStatus,
  normalizeTaskQueryResponse,
  returnBomSupplementTask,
  reviewBomSupplementTask,
  statusTagType,
} from '../api/bomSupplementTasks.js'
import { labelForTaskType, normalizePackageLines, normalizeSupplementLines } from '../api/quoteBomSupplement.js'

const query = reactive({
  taskNo: '',
  oaNo: '',
  productCode: '',
  taskStatus: '',
  reviewStatus: '',
  pageNo: 1,
  pageSize: 20,
})

const rows = ref([])
const total = ref(0)
const loading = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const reviewComment = ref('')
const reviewing = ref(false)

const task = computed(() => detail.value?.task || {})
const detailTitle = computed(() => (task.value.taskNo ? `BOM 补录任务 ${task.value.taskNo}` : 'BOM 补录任务详情'))
const canReview = computed(() => task.value.taskStatus === 'FINANCE_REVIEW')
const formalBodyLines = computed(() => {
  const preparation = detail.value?.preparation || {}
  return preparation.bodyBomReady ? normalizeSupplementLines(preparation.bodyBomLines || []) : []
})
const supplementLines = computed(() => normalizeSupplementLines(detail.value?.supplementLines || []))
const bodyLines = computed(() => (formalBodyLines.value.length ? formalBodyLines.value : supplementLines.value))
const packageLines = computed(() => normalizePackageLines(detail.value?.packageLines || []))
const changeLogs = computed(() => detail.value?.changeLogs || [])
const completeBomLines = computed(() => detail.value?.completeBomPreview || [])

async function loadTasks() {
  loading.value = true
  try {
    const data = normalizeTaskQueryResponse(await fetchBomSupplementTasks({ ...query }))
    rows.value = data.rows
    total.value = data.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error?.message || '加载 BOM 补录任务失败')
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  Object.assign(query, {
    taskNo: '',
    oaNo: '',
    productCode: '',
    taskStatus: '',
    reviewStatus: '',
    pageNo: 1,
    pageSize: 20,
  })
  loadTasks()
}

async function openDetail(taskId) {
  detailVisible.value = true
  detailLoading.value = true
  reviewComment.value = ''
  try {
    detail.value = await fetchBomSupplementTaskDetail(taskId)
  } catch (error) {
    detail.value = null
    ElMessage.error(error?.message || '加载任务详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function approveTask() {
  await ElMessageBox.confirm('确认该完整 BOM 准备结果？此操作不会直接生成结算行。', '财务确认', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消',
  })
  await submitReview('approve')
}

async function returnTask() {
  if (!reviewComment.value.trim()) {
    ElMessage.warning('退回时请填写审核意见')
    return
  }
  await ElMessageBox.confirm('退回后技术员可通过协作链接重新提交。', '退回技术员', {
    type: 'warning',
    confirmButtonText: '退回',
    cancelButtonText: '取消',
  })
  await submitReview('return')
}

async function submitReview(action) {
  if (!detail.value?.task?.taskId) return
  reviewing.value = true
  const body = {
    reviewerUserId: null,
    reviewerName: '',
    comment: reviewComment.value.trim(),
  }
  try {
    if (action === 'approve') {
      await reviewBomSupplementTask(detail.value.task.taskId, body)
      ElMessage.success('已完成财务确认')
    } else {
      await returnBomSupplementTask(detail.value.task.taskId, body)
      ElMessage.success('已退回技术员')
    }
    await openDetail(detail.value.task.taskId)
    await loadTasks()
  } catch (error) {
    ElMessage.error(error?.message || '审核操作失败')
  } finally {
    reviewing.value = false
  }
}

function displayPair(original, adjusted) {
  if (adjusted === null || adjusted === undefined || adjusted === '') {
    return original ?? '-'
  }
  return `${original ?? '-'} -> ${adjusted}`
}

onMounted(loadTasks)
</script>

<style scoped>
.bom-task-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  color: #1f2937;
}

.page-header,
.query-band,
.table-band {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

.page-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  line-height: 28px;
}

.page-header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}

.query-band {
  padding: 14px 16px 4px;
}

.query-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.query-form :deep(.el-input),
.query-form :deep(.el-select) {
  width: 180px;
}

.table-band {
  padding: 12px;
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.detail-body {
  min-height: 420px;
}

.detail-section {
  margin-bottom: 18px;
}

.section-title {
  margin-bottom: 10px;
  color: #111827;
  font-size: 15px;
  font-weight: 650;
  line-height: 22px;
}

.dense-table {
  width: 100%;
}

.dense-table :deep(.cell) {
  word-break: break-word;
}

.review-footer {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0 0;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}

.review-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 900px) {
  .page-header,
  .review-footer {
    grid-template-columns: 1fr;
    display: grid;
  }

  .query-form :deep(.el-input),
  .query-form :deep(.el-select) {
    width: min(100%, 260px);
  }

  .review-actions {
    justify-content: flex-end;
  }
}
</style>
