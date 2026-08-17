<template>
  <div class="technical-task-page" v-loading="loading">
    <div class="page-heading">
      <div>
        <el-button link @click="router.push('/collaboration/tasks')">← 返回本人任务</el-button>
        <h2>{{ task?.productName || '技术协作任务' }}</h2>
        <p v-if="task">{{ task.productCode || '新品暂无料号' }} · {{ task.productModel || task.productSpec || '-' }}</p>
      </div>
      <el-button v-if="task" @click="showChangeLog">查看处理记录</el-button>
    </div>

    <el-result
      v-if="accessDenied && !loading"
      icon="warning"
      title="当前账号不能查看此技术任务"
      sub-title="协助者只能查看分配给自己的产品，请返回本人任务清单。"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/collaboration/tasks')">返回本人任务</el-button>
      </template>
    </el-result>

    <template v-else-if="task">
      <el-alert :closable="false" type="info" show-icon class="guidance">
        <template #title>{{ task.guidance }}</template>
      </el-alert>

      <el-alert
        v-if="task.returnIssues?.length"
        :closable="false"
        type="error"
        show-icon
        class="return-alert"
      >
        <template #title>财务退回原因，请按下列内容修改后重新校验</template>
        <div v-for="(issue, index) in task.returnIssues" :key="`${issue.itemType}-${index}`">
          {{ index + 1 }}. {{ issue.itemTypeLabel }}：{{ issue.reason }}
        </div>
      </el-alert>

      <el-card shadow="never" class="summary-card">
        <div class="summary-grid">
          <div><span>需要处理</span><strong>{{ task.primaryScopeLabel }}</strong></div>
          <div><span>当前状态</span><strong>{{ task.statusLabel }}</strong></div>
          <div><span>完成情况</span><strong>{{ task.completedRequirementCount }}/{{ task.totalRequirementCount }}</strong></div>
          <div><span>下一步</span><strong>{{ task.nextActionLabel }}</strong></div>
        </div>
      </el-card>

      <el-card shadow="never" class="content-card">
        <template #header><strong>本产品要处理的内容</strong></template>
        <div v-for="item in task.requirements" :key="item.code" class="requirement-row">
          <div>
            <div class="requirement-name">{{ item.label }}</div>
            <div class="muted">{{ item.message }}</div>
          </div>
          <el-tag :type="item.completed ? 'success' : 'warning'" effect="plain">
            {{ item.completed ? '已完成' : '待处理' }}
          </el-tag>
        </div>
        <el-empty v-if="!task.requirements.length" description="当前没有待处理内容" :image-size="70" />
      </el-card>

      <TechnicalBomDraftWorkspace
        v-if="needsBom && task.editable && !canStart"
        :task-id="task.taskId"
        @updated="handleBomUpdated"
      />

      <TechnicalPackageDraftWorkspace
        v-if="needsPackage && task.editable && !canStart"
        :task-id="task.taskId"
        @updated="handlePackageUpdated"
      />

      <TechnicalPriceDraftWorkspace
        v-if="needsPrice && task.editable && !canStart"
        :task-id="task.taskId"
        :next-action="task.nextAction"
        @updated="handlePriceUpdated"
      />

      <el-card v-if="task.gaps.length" shadow="never" class="content-card">
        <template #header><strong>问题明细</strong></template>
        <el-table :data="task.gaps" size="small">
          <el-table-column prop="categoryLabel" label="类型" width="90" />
          <el-table-column label="物料" min-width="220">
            <template #default="{ row }">
              <div>{{ row.materialName || row.materialCode || '-' }}</div>
              <div class="muted">{{ [row.materialCode, row.materialModel || row.materialSpec].filter(Boolean).join(' · ') }}</div>
            </template>
          </el-table-column>
          <el-table-column label="BOM位置与用量" min-width="260">
            <template #default="{ row }">
              <div>{{ row.bomPath || '-' }}</div>
              <div class="muted">
                {{ row.bomQuantity == null ? '-' : `${row.bomQuantity} ${row.bomUnit || ''}` }}
                <template v-if="row.accountingMonth || row.applicableOrgCode">
                  · {{ [row.accountingMonth, row.applicableOrgCode].filter(Boolean).join(' / ') }}
                </template>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="为什么要处理" min-width="260" />
          <el-table-column prop="statusLabel" label="状态" width="110" />
        </el-table>
      </el-card>

      <el-alert v-if="validationIssues.length" type="error" :closable="false" show-icon class="validation-alert">
        <template #title>校验未通过，还有 {{ validationIssues.length }} 个问题</template>
        <div v-for="issue in validationIssues" :key="`${issue.code}-${issue.message}`">• {{ issue.message }}</div>
      </el-alert>

      <div class="footer-actions">
        <span class="muted">数据从服务端保存，返回重进或刷新不会丢失。</span>
        <div>
          <el-button @click="load">刷新</el-button>
          <el-button
            v-if="canStart"
            type="primary"
            :loading="acting"
            @click="startTask"
          >开始处理</el-button>
          <el-button
            v-else-if="canValidate"
            type="primary"
            :loading="acting"
            @click="validateTask"
          >检查完整性</el-button>
          <el-button
            v-else-if="canSubmit"
            type="primary"
            :loading="acting"
            @click="submitTask"
          >完成并提交财务审核</el-button>
        </div>
      </div>
    </template>

    <el-drawer v-model="logVisible" title="处理记录" size="420px">
      <el-timeline v-if="changeLog.length">
        <el-timeline-item
          v-for="entry in changeLog"
          :key="`${entry.occurredAt}-${entry.eventType}`"
          :timestamp="formatTime(entry.occurredAt)"
        >
          <strong>{{ entry.title }}</strong>
          <div class="muted">{{ entry.description }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无处理记录" />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchTechnicalTask,
  fetchTechnicalTaskChangeLog,
  startTechnicalTask,
  submitTechnicalTask,
  validateTechnicalTask,
} from '../api/technicalCollaborationTasks'
import TechnicalBomDraftWorkspace from '../components/TechnicalBomDraftWorkspace.vue'
import TechnicalPackageDraftWorkspace from '../components/TechnicalPackageDraftWorkspace.vue'
import TechnicalPriceDraftWorkspace from '../components/TechnicalPriceDraftWorkspace.vue'
import { isDomainError, showErrorOnce } from '../utils/errorHandler'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const acting = ref(false)
const task = ref(null)
const accessDenied = ref(false)
const validationIssues = ref([])
const logVisible = ref(false)
const changeLog = ref([])

const canStart = computed(() => task.value?.editable && ['WAIT_TECH', 'TECH_VALIDATION_FAILED'].includes(task.value.status))
const canSubmit = computed(() => task.value?.editable && task.value.validationStatus === 'PASSED')
const canValidate = computed(() => task.value?.editable && task.value?.nextAction === 'VALIDATE_COMPLETENESS')
const needsBom = computed(() => task.value?.requirements?.some(item => item.code === 'BOM' && item.required && !item.completed))
const needsPackage = computed(() => task.value?.requirements?.some(item => item.code === 'PACKAGE' && item.required && !item.completed))
const needsPrice = computed(() => task.value?.requirements?.some(item => item.code === 'PRICE' && item.required && !item.completed))

async function load() {
  loading.value = true
  accessDenied.value = false
  validationIssues.value = []
  try {
    task.value = await fetchTechnicalTask(route.params.taskId)
  } catch (error) {
    task.value = null
    if (isDomainError(error, 'TASK_ASSIGNEE_MISMATCH')) accessDenied.value = true
    else showErrorOnce(error, '任务加载失败')
  } finally {
    loading.value = false
  }
}

async function startTask() {
  await act(() => startTechnicalTask(task.value.taskId, task.value.taskVersion), '任务已开始')
}

async function validateTask() {
  acting.value = true
  try {
    const result = await validateTechnicalTask(task.value.taskId, task.value.taskVersion)
    task.value = result.task
    validationIssues.value = result.issues || []
    result.passed ? ElMessage.success(result.message) : ElMessage.warning(result.message)
  } catch (error) {
    showErrorOnce(error, '完整性校验失败')
  } finally {
    acting.value = false
  }
}

async function submitTask() {
  try {
    await ElMessageBox.confirm('提交后本任务将只读，确认提交给财务审核？', '确认提交', {
      confirmButtonText: '确认提交', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  await act(() => submitTechnicalTask(task.value.taskId, task.value.taskVersion), '技术任务已提交')
}

async function act(action, successMessage) {
  acting.value = true
  try {
    task.value = await action()
    validationIssues.value = []
    ElMessage.success(successMessage)
  } catch (error) {
    showErrorOnce(error, '操作失败')
  } finally {
    acting.value = false
  }
}

async function showChangeLog() {
  try {
    const data = await fetchTechnicalTaskChangeLog(route.params.taskId)
    changeLog.value = data?.entries || []
    logVisible.value = true
  } catch (error) {
    showErrorOnce(error, '处理记录加载失败')
  }
}

async function handleBomUpdated() {
  await load()
}

async function handlePackageUpdated() {
  await load()
}

async function handlePriceUpdated() {
  await load()
}

function formatTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 19)
}

watch(() => route.params.taskId, load)
onMounted(load)
</script>

<style scoped>
.technical-task-page { min-width: 760px; padding-bottom: 76px; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-heading h2 { margin: 8px 0 6px; font-size: 24px; color: #303133; }
.page-heading p { margin: 0; color: #909399; }
.guidance, .return-alert, .summary-card, .content-card, .validation-alert { margin-bottom: 14px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.summary-grid div { display: flex; flex-direction: column; gap: 8px; }
.summary-grid span, .muted { color: #909399; font-size: 13px; }
.summary-grid strong { color: #303133; }
.requirement-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #ebeef5; }
.requirement-row:last-child { border-bottom: 0; }
.requirement-name { margin-bottom: 5px; font-weight: 600; color: #303133; }
.footer-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding: 14px 18px; border: 1px solid #ebeef5; background: #fff; }
@media (max-width: 1000px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
