<template>
  <div class="bom-supplement-page">
    <el-result v-if="loading" icon="info" title="加载中..." />
    <el-result v-else-if="error" icon="error" :title="error">
      <template #extra>
        <el-button :icon="Refresh" @click="loadContext">重试</el-button>
      </template>
    </el-result>

    <template v-else-if="context">
      <section class="page-header">
        <div>
          <h1>BOM 补录协作</h1>
          <p>{{ labelForTaskType(context.taskType) }}</p>
        </div>
        <div class="header-actions">
          <el-tag :type="taskStatusType(task.taskStatus)" size="large">
            {{ taskStatusText(task.taskStatus) }}
          </el-tag>
          <el-tag v-if="context.tokenExpireTime" type="info" size="large">
            截止 {{ formatDateTime(context.tokenExpireTime) }}
          </el-tag>
        </div>
      </section>

      <section class="content-section">
        <div class="section-title">
          <h2>任务信息</h2>
        </div>
        <el-descriptions :column="3" border class="task-descriptions">
          <el-descriptions-item label="报价单号">{{ context.oaNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ task.customerCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品料号">{{ task.productCode || context.quoteProductCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{ task.productName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="规格">{{ task.productModel || '-' }}</el-descriptions-item>
          <el-descriptions-item label="裸品 / 非裸品">
            {{ labelForProductType(preparation.productType) }}
          </el-descriptions-item>
          <el-descriptions-item label="裸品料号">{{ preparation.bareProductCode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="包装方式">{{ task.packageMethod || '-' }}</el-descriptions-item>
          <el-descriptions-item label="处理月份">{{ preparation.periodMonth || '-' }}</el-descriptions-item>
          <el-descriptions-item label="任务说明" :span="3">
            {{ task.missingReason || task.remark || gapMessageText || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="content-section">
        <div class="section-title">
          <h2>本体 BOM</h2>
          <el-tag v-if="hasExistingBodyBom" type="success">正式 BOM</el-tag>
          <el-tag v-else type="warning">技术员补录</el-tag>
        </div>

        <el-table
          v-if="hasExistingBodyBom"
          :data="preparation.bodyBomLines"
          border
          class="data-table"
          empty-text="暂无 BOM 明细"
        >
          <el-table-column prop="lineNo" label="行号" width="80" />
          <el-table-column prop="level" label="层级" width="80" />
          <el-table-column prop="parentCode" label="父件" min-width="150" show-overflow-tooltip />
          <el-table-column prop="materialCode" label="料号" min-width="160" show-overflow-tooltip />
          <el-table-column prop="materialName" label="品名" min-width="160" show-overflow-tooltip />
          <el-table-column prop="materialSpec" label="规格" min-width="160" show-overflow-tooltip />
          <el-table-column prop="qtyPerParent" label="用量" width="120" />
          <el-table-column prop="qtyPerTop" label="累计用量" width="130" />
          <el-table-column prop="parentBaseQty" label="母件底数" width="130" />
          <el-table-column prop="unit" label="单位" width="100" />
        </el-table>

        <template v-else>
          <div class="table-toolbar">
            <el-button type="primary" :icon="Plus" @click="addSupplementLine">新增明细</el-button>
          </div>
          <el-table
            :data="supplementLines"
            border
            class="data-table editable-table"
            empty-text="暂无补录明细"
          >
            <el-table-column prop="lineNo" label="行号" width="78">
              <template #default="{ row }">
                <el-input-number v-model="row.lineNo" :min="1" :controls="false" class="cell-number" />
              </template>
            </el-table-column>
            <el-table-column prop="level" label="层级" width="78">
              <template #default="{ row }">
                <el-input-number v-model="row.level" :min="1" :controls="false" class="cell-number" />
              </template>
            </el-table-column>
            <el-table-column prop="parentCode" label="父件" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.parentCode" placeholder="父件料号" />
              </template>
            </el-table-column>
            <el-table-column prop="materialCode" label="料号" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.materialCode" placeholder="子件料号" />
              </template>
            </el-table-column>
            <el-table-column prop="materialName" label="品名" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.materialName" placeholder="品名" />
              </template>
            </el-table-column>
            <el-table-column prop="materialSpec" label="规格" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.materialSpec" placeholder="规格" />
              </template>
            </el-table-column>
            <el-table-column prop="qtyPerParent" label="用量" width="132">
              <template #default="{ row }">
                <el-input-number v-model="row.qtyPerParent" :controls="false" class="cell-number" />
              </template>
            </el-table-column>
            <el-table-column prop="qtyPerTop" label="累计用量" width="132">
              <template #default="{ row }">
                <el-input-number v-model="row.qtyPerTop" :controls="false" class="cell-number" />
              </template>
            </el-table-column>
            <el-table-column prop="parentBaseQty" label="母件底数" width="132">
              <template #default="{ row }">
                <el-input-number v-model="row.parentBaseQty" :controls="false" class="cell-number" />
              </template>
            </el-table-column>
            <el-table-column prop="unit" label="单位" width="110">
              <template #default="{ row }">
                <el-input v-model="row.unit" placeholder="单位" />
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ $index }">
                <el-button :icon="Delete" link type="danger" @click="removeSupplementLine($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </section>

      <section v-if="showPackageReference" class="content-section">
        <div class="section-title">
          <h2>包装参考</h2>
          <el-tag type="info">{{ packageLines.length }} 行</el-tag>
        </div>

        <el-form :model="packageReferenceForm" class="reference-form" label-width="110px">
          <el-form-item label="参考成品料号">
            <el-input
              v-model="packageReferenceForm.referenceFinishedCode"
              clearable
              placeholder="输入参考成品料号"
              class="reference-code-input"
            />
          </el-form-item>
          <el-form-item label="目件料号">
            <el-input
              v-model="packageReferenceForm.sourceTopProductCode"
              clearable
              placeholder="默认同参考成品料号"
              class="reference-code-input"
            />
          </el-form-item>
          <el-form-item label="月份">
            <el-input v-model="packageReferenceForm.periodMonth" clearable placeholder="YYYY-MM" class="period-input" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" :loading="packageLoading" @click="loadPackageReference">
              查询包装结构
            </el-button>
          </el-form-item>
        </el-form>

        <el-table
          :data="packageLines"
          border
          class="data-table editable-table"
          row-key="rowKey"
          empty-text="暂无包装参考明细"
        >
          <el-table-column label="带入" width="74" fixed="left">
            <template #default="{ row }">
              <el-checkbox v-model="row.selected" />
            </template>
          </el-table-column>
          <el-table-column prop="referenceFinishedCode" label="参考成品料号" min-width="170" show-overflow-tooltip />
          <el-table-column prop="sourceTopProductCode" label="目件料号" min-width="160" show-overflow-tooltip />
          <el-table-column prop="packageParentCode" label="包装父件" min-width="160" show-overflow-tooltip />
          <el-table-column prop="packageParentName" label="父件名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="packageMaterialCode" label="包装明细料号" min-width="170" show-overflow-tooltip />
          <el-table-column prop="packageMaterialName" label="明细名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="父件用量" min-width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedPackageQtyPerParent"
                :placeholder="valueText(row.packageQtyPerParent)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column label="父件累计用量" min-width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedPackageQtyPerTop"
                :placeholder="valueText(row.packageQtyPerTop)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column label="父件底数" min-width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedPackageParentBaseQty"
                :placeholder="valueText(row.packageParentBaseQty)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column label="子件用量" min-width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedChildQtyPerParent"
                :placeholder="valueText(row.childQtyPerParent)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column label="子件累计用量" min-width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedChildQtyPerTop"
                :placeholder="valueText(row.childQtyPerTop)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column label="子件底数" min-width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row.adjustedChildParentBaseQty"
                :placeholder="valueText(row.childParentBaseQty)"
                :controls="false"
                class="cell-number"
              />
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.remark" placeholder="备注" />
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="submit-section">
        <el-form :model="submitForm" label-width="90px" class="submit-form">
          <el-form-item label="提交备注">
            <el-input v-model="submitForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
          </el-form-item>
        </el-form>
        <div class="submit-actions">
          <el-button :icon="DocumentChecked" :loading="saving" @click="saveDraft">保存草稿</el-button>
          <el-button type="primary" :icon="Check" :loading="submitting" @click="submitForReview">
            提交财务审核
          </el-button>
        </div>
        <el-alert
          v-if="lastSaveResult"
          class="result-alert"
          type="success"
          show-icon
          :closable="false"
          :title="saveResultText"
        />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, Delete, DocumentChecked, Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  bodyBomNeedsSupplement,
  buildBomSupplementPayload,
  createBlankSupplementLine,
  fetchBomPackageReference,
  fetchBomSupplementContext,
  labelForProductType,
  labelForTaskType,
  normalizeBomSupplementContext,
  normalizePackageLines,
  normalizeSupplementLines,
  packageReferenceVisible,
  saveBomSupplementDraft,
  submitBomSupplement,
} from '../../api/quoteBomSupplement.js'

const route = useRoute()

const loading = ref(true)
const packageLoading = ref(false)
const saving = ref(false)
const submitting = ref(false)
const error = ref('')
const context = ref(null)
const supplementLines = ref([])
const packageLines = ref([])
const lastSaveResult = ref(null)

const packageReferenceForm = reactive({
  referenceFinishedCode: '',
  sourceTopProductCode: '',
  periodMonth: '',
  remark: '',
})

const submitForm = reactive({
  remark: '',
})

const token = computed(() => String(route.query.token || ''))
const task = computed(() => context.value?.detail?.task || {})
const preparation = computed(() => context.value?.detail?.preparation || {})
const hasExistingBodyBom = computed(() => {
  const lines = preparation.value.bodyBomLines || []
  return Boolean(preparation.value.bodyBomReady && lines.length > 0)
})
const needsBodySupplement = computed(() => bodyBomNeedsSupplement(context.value))
const showPackageReference = computed(() => packageReferenceVisible(context.value))
const selectedPackageLineCount = computed(() => packageLines.value.filter((line) => line.selected).length)
const gapMessageText = computed(() => (preparation.value.gapMessages || []).join('；'))
const saveResultText = computed(() => {
  const result = lastSaveResult.value
  if (!result) return ''
  return `已保存：本体 BOM ${result.savedSupplementLineCount || 0} 行，包装 ${result.savedPackageLineCount || 0} 行，调整日志 ${result.insertedChangeLogCount || 0} 条`
})

onMounted(loadContext)

async function loadContext() {
  loading.value = true
  error.value = ''
  if (!token.value) {
    error.value = '缺少协作令牌'
    loading.value = false
    return
  }
  try {
    context.value = normalizeBomSupplementContext(await fetchBomSupplementContext(token.value))
    const detail = context.value.detail || {}
    const reference = detail.packageReference || {}
    supplementLines.value = detail.supplementLines.length
      ? normalizeSupplementLines(detail.supplementLines)
      : [createBlankSupplementLine(1)]
    packageReferenceForm.referenceFinishedCode =
      reference.referenceFinishedCode || preparation.value.referenceFinishedCode || ''
    packageReferenceForm.sourceTopProductCode =
      reference.sourceTopProductCode || preparation.value.sourceTopProductCode || ''
    packageReferenceForm.periodMonth = reference.periodMonth || preparation.value.periodMonth || ''
    packageReferenceForm.remark = reference.remark || ''
    packageLines.value = detail.packageLines.length ? normalizePackageLines(detail.packageLines) : []
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function addSupplementLine() {
  supplementLines.value.push(createBlankSupplementLine(supplementLines.value.length + 1))
}

function removeSupplementLine(index) {
  supplementLines.value.splice(index, 1)
  if (supplementLines.value.length === 0) {
    addSupplementLine()
  }
}

async function loadPackageReference() {
  const referenceFinishedCode = packageReferenceForm.referenceFinishedCode.trim()
  if (!referenceFinishedCode) {
    ElMessage.warning('请输入参考成品料号')
    return
  }
  packageLoading.value = true
  try {
    const result = await fetchBomPackageReference({
      token: token.value,
      taskId: context.value.taskId,
      referenceFinishedCode,
      sourceTopProductCode: packageReferenceForm.sourceTopProductCode || referenceFinishedCode,
      periodMonth: packageReferenceForm.periodMonth || preparation.value.periodMonth,
    })
    if (!result?.found) {
      ElMessage.warning(`包装结构不可用：${(result?.gaps || []).join('；') || '未找到明细'}`)
      packageLines.value = []
      return
    }
    packageReferenceForm.referenceFinishedCode = result.referenceFinishedCode || referenceFinishedCode
    packageReferenceForm.sourceTopProductCode = result.sourceTopProductCode || packageReferenceForm.referenceFinishedCode
    packageReferenceForm.periodMonth = result.periodMonth || packageReferenceForm.periodMonth
    packageLines.value = normalizePackageLines(result.lines)
    ElMessage.success(`已带出 ${packageLines.value.length} 行包装明细`)
  } catch (err) {
    ElMessage.error(err.message || '查询包装结构失败')
  } finally {
    packageLoading.value = false
  }
}

async function saveDraft() {
  if (!validateDraft()) return
  saving.value = true
  try {
    lastSaveResult.value = await saveBomSupplementDraft(context.value.taskId, token.value, buildPayload())
    ElMessage.success('草稿已保存')
    await loadContext()
  } catch (err) {
    ElMessage.error(err.message || '保存草稿失败')
  } finally {
    saving.value = false
  }
}

async function submitForReview() {
  if (!validateSubmit()) return
  submitting.value = true
  try {
    lastSaveResult.value = await submitBomSupplement(context.value.taskId, token.value, buildPayload())
    ElMessage.success('已提交财务审核')
    await loadContext()
  } catch (err) {
    ElMessage.error(err.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

function buildPayload() {
  return buildBomSupplementPayload({
    supplementLines: hasExistingBodyBom.value ? [] : supplementLines.value,
    packageReference: showPackageReference.value ? packageReferenceForm : null,
    packageLines: showPackageReference.value ? packageLines.value : [],
    remark: submitForm.remark,
  })
}

function validateDraft() {
  if (!context.value?.taskId) {
    ElMessage.warning('任务信息不完整')
    return false
  }
  return true
}

function validateSubmit() {
  if (!validateDraft()) return false
  if (needsBodySupplement.value && !hasAnySupplementLine()) {
    ElMessage.warning('请补录本体 BOM 明细')
    return false
  }
  if (showPackageReference.value && !packageReferenceForm.referenceFinishedCode.trim()) {
    ElMessage.warning('请选择参考成品料号')
    return false
  }
  if (showPackageReference.value && selectedPackageLineCount.value === 0) {
    ElMessage.warning('请勾选需要带入的包装明细')
    return false
  }
  return true
}

function hasAnySupplementLine() {
  return supplementLines.value.some((line) => String(line.materialCode || '').trim())
}

function valueText(value) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

function taskStatusText(status) {
  const map = {
    TODO_PENDING: '待处理',
    IN_PROGRESS: '处理中',
    FINANCE_REVIEW: '财务审核',
    COMPLETED: '已完成',
  }
  return map[status] || status || '-'
}

function taskStatusType(status) {
  const map = {
    TODO_PENDING: 'warning',
    IN_PROGRESS: 'primary',
    FINANCE_REVIEW: 'success',
    COMPLETED: 'info',
  }
  return map[status] || 'info'
}
</script>

<style scoped>
.bom-supplement-page {
  max-width: 1440px;
  min-width: 0;
  margin: 0 auto;
  color: #1f2937;
}

.page-header,
.content-section,
.submit-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 18px;
  margin-bottom: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1,
.section-title h2 {
  margin: 0;
  color: #111827;
  font-weight: 650;
  letter-spacing: 0;
}

.page-header h1 {
  font-size: 22px;
  line-height: 1.3;
}

.page-header p {
  margin: 6px 0 0;
  color: #4b5563;
  font-size: 14px;
}

.header-actions,
.section-title,
.submit-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions {
  justify-content: flex-end;
}

.section-title {
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title h2 {
  font-size: 17px;
}

.task-descriptions {
  width: 100%;
}

.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.data-table {
  width: 100%;
}

.editable-table :deep(.el-input),
.editable-table :deep(.el-input-number) {
  width: 100%;
}

.cell-number {
  min-width: 92px;
}

.reference-form {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  column-gap: 8px;
  margin-bottom: 12px;
}

.reference-code-input {
  width: 240px;
}

.period-input {
  width: 130px;
}

.submit-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}

.submit-form {
  min-width: 0;
}

.submit-actions {
  justify-content: flex-end;
  align-self: start;
}

.result-alert {
  grid-column: 1 / -1;
}

:deep(.el-table .cell) {
  min-width: 0;
  word-break: break-word;
}

:deep(.el-button) {
  white-space: normal;
}

@media (max-width: 900px) {
  .page-header,
  .submit-section {
    display: block;
  }

  .header-actions,
  .submit-actions {
    justify-content: flex-start;
    margin-top: 12px;
  }

  .reference-form {
    display: block;
  }

  .reference-code-input,
  .period-input {
    width: 100%;
  }
}
</style>
