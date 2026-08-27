<template>
  <div class="technical-task-list">
    <div class="page-heading">
      <div>
        <h2>我的协作任务</h2>
        <p>这里只显示分配给你的产品；BOM、包装和补价合并在同一个任务中，处理完成后统一提交报价员审核；已提交任务仅供查看。</p>
      </div>
      <div class="page-actions">
        <el-select v-model="taskFilter" aria-label="任务类型" style="width: 130px">
          <el-option label="全部任务" value="ALL" />
          <el-option label="BOM/包装" value="BOM" />
          <el-option label="补价格" value="PRICE" />
        </el-select>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-result
        v-if="accessDenied && !loading"
        icon="warning"
        title="当前账号没有技术协作权限"
        sub-title="请使用被分配为本产品技术处理人的账号登录；你只能查看分配给自己的任务。"
      />
      <el-table v-else v-loading="loading" :data="visibleItems" empty-text="当前没有分配给你的对应任务">
        <el-table-column label="产品" min-width="260">
          <template #default="{ row }">
            <div class="product-code">{{ row.productCode || '新品暂无料号' }}</div>
            <div class="muted">{{ [row.productName, row.productModel || row.productSpec].filter(Boolean).join(' · ') || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="primaryScopeLabel" label="需要处理" min-width="180" />
        <el-table-column label="当前状态" width="150">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缺价明细" width="120">
          <template #default="{ row }">{{ row.openGapCount || 0 }} 项</template>
        </el-table-column>
        <el-table-column label="下一步" min-width="170">
          <template #default="{ row }">{{ row.nextActionLabel }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTask(row.taskId)">
              {{ row.editable ? '进入处理' : '查看任务' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchMyTechnicalTasks } from '../../../api/technicalCollaborationTasks'
import { isDomainError, showErrorOnce } from '../../../utils/errorHandler'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const items = ref([])
const accessDenied = ref(false)
const taskFilter = ref('ALL')
const portalEntry = computed(() => Boolean(route.meta?.collaborationPortal))
const visibleItems = computed(() => items.value.filter((item) => {
  if (taskFilter.value === 'BOM') return item.primaryScope !== 'PRICE_ONLY'
  if (taskFilter.value === 'PRICE') {
    return item.primaryScope === 'PRICE_ONLY' || Number(item.openGapCount || 0) > 0
  }
  return true
}))

async function load() {
  loading.value = true
  accessDenied.value = false
  try {
    const data = await fetchMyTechnicalTasks()
    items.value = data?.items || []
  } catch (error) {
    items.value = []
    if ([401, 403].includes(Number(error?.resultCode))
      || isDomainError(error, 'TASK_ASSIGNEE_MISMATCH')) accessDenied.value = true
    else showErrorOnce(error, '本人任务加载失败')
  } finally {
    loading.value = false
  }
}

function openTask(taskId) {
  router.push(portalEntry.value
    ? `/collaborate/product-tasks/${taskId}`
    : `/collaboration/product-tasks/${taskId}`)
}

function statusType(status) {
  if (['TECH_SUBMITTED', 'WAIT_FINANCE', 'READY_FOR_COSTING', 'COMPLETED'].includes(status)) return 'success'
  if (['TECH_VALIDATION_FAILED', 'RETURNED_TO_TECH'].includes(status)) return 'danger'
  if (status === 'CANCELLED') return 'info'
  return 'warning'
}

onMounted(load)
</script>

<style scoped>
.technical-task-list { min-width: 760px; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-heading h2 { margin: 0 0 8px; font-size: 24px; color: #303133; }
.page-heading p { margin: 0; color: #909399; }
.page-actions { display: flex; gap: 10px; }
.product-code { font-weight: 600; color: #303133; }
.muted { margin-top: 5px; font-size: 13px; color: #909399; }
</style>
