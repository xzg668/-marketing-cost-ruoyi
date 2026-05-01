<template>
  <div class="cost-run-result">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <div class="header-title">成本试算结果</div>
          <div class="header-sub">OA 单号：{{ meta.oaNo || '-' }}</div>
        </div>
        <el-button @click="goBack">返回列表</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="section-title">试算信息</div>
      <el-descriptions :column="4" border>
        <el-descriptions-item label="OA单号">
          {{ meta.oaNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="表单类型">
          {{ meta.formType || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="客户名称">
          {{ meta.customer || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="申请日期">
          {{ meta.applyDate || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ displayStatus }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="running" shadow="never" class="progress-card">
      <div class="section-title">试算进度</div>
      <!-- T17：排队中时进度条上方显示排队位置 -->
      <div v-if="queuePos > 0" class="queue-tip">
        <el-tag type="warning" effect="light">
          前面有 {{ queuePos - 1 }} 个试算在排队，本次第 {{ queuePos }} 位，预计等约 {{ estimatedWaitSec }}s
        </el-tag>
      </div>
      <el-progress
        :percentage="progress"
        :status="progressStatus"
        :indeterminate="false"
      />
      <div class="progress-tip">{{ progressTip }}</div>
    </el-card>

    <el-card v-else shadow="never">
      <div class="section-title">产品成本金额</div>
      <el-table :data="filteredItems" stripe>
        <el-table-column prop="productName" label="产品名称" min-width="180" />
        <el-table-column prop="materialCode" label="料号" width="140" />
        <el-table-column prop="customerDrawing" label="客户图号" width="140" />
        <el-table-column prop="spec" label="规格" width="120" />
        <el-table-column label="数量" width="100">
          <template #default="{ row }">
            {{ formatQty(row.supportQty) }}
          </template>
        </el-table-column>
        <el-table-column label="单位成本(元/只)" width="150">
          <template #default="{ row }">
            {{ formatAmount(row.unitCost) }}
          </template>
        </el-table-column>
        <el-table-column label="成本金额(元)" width="150">
          <template #default="{ row }">
            {{ formatAmount(row.totalCost) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goOaDetail(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchOaFormDetail } from '../api/oaForms'
import { fetchCostRunProgress, runCostTrial } from '../api/costRunTrial'

const route = useRoute()
const router = useRouter()

const result = ref({
  meta: {},
  items: [],
})

const running = ref(false)
const progress = ref(0)
const timer = ref(null)
const progressTimer = ref(null)
const startAt = ref(0)
const lastDurationMs = ref(0)
const elapsedMs = ref(0)
const statusOverride = ref('')
// T17：排队位置（0=正在跑/已结束，>0=排队中第 N 位）
const queuePos = ref(0)
// T17：单个试算预估时长（秒）；OA-GOLDEN-001 实测约 1s 内，保守按 5s × 队长估算
const SINGLE_TRIAL_EST_SEC = 5
// T18(a)：后端 status 镜像（IDLE/QUEUED/RUNNING/DONE/ERROR），驱动 progressStatus + 提示
const trialStatus = ref('')
// T18(d)：后端崩溃 30s 无响应 toast 阈值
const POLL_TIMEOUT_MS = 30 * 1000

const oaNo = computed(() => String(route.params.oaNo || route.query.oaNo || '').trim())
const queryStatus = computed(() => String(route.query.status || '').trim())

const meta = computed(() => result.value.meta || {})
const displayStatus = computed(
  () => statusOverride.value || queryStatus.value || meta.value.status || '未核算',
)

const filteredItems = computed(() => {
  const items = Array.isArray(result.value.items) ? result.value.items : []
  const productName = String(route.query.productName || '').trim()
  const materialCode = String(route.query.materialCode || '').trim()
  const customerDrawing = String(route.query.customerDrawing || '').trim()
  const spec = String(route.query.spec || '').trim()

  if (!productName && !materialCode && !customerDrawing && !spec) {
    return items
  }

  return items.filter((item) => {
    if (productName && item.productName !== productName) {
      return false
    }
    if (materialCode && item.materialCode !== materialCode) {
      return false
    }
    if (customerDrawing && item.customerDrawing !== customerDrawing) {
      return false
    }
    if (spec && item.spec !== spec) {
      return false
    }
    return true
  })
})

const totalSupportQty = computed(() => {
  let sum = 0
  let hasValue = false
  filteredItems.value.forEach((item) => {
    const qty = Number(item.supportQty)
    if (Number.isFinite(qty)) {
      sum += qty
      hasValue = true
    }
  })
  return hasValue ? sum : null
})

// T17：排队预计等候 = 前面 (queuePos-1) 个 × 单试算估时
const estimatedWaitSec = computed(() => Math.max(0, (queuePos.value - 1) * SINGLE_TRIAL_EST_SEC))

// T18(a)：进度条状态映射 — 出错时红色，完成时绿色，否则默认蓝色
//   需要 trialStatus 这个 ref（在 polling 里同步 data.status）
const progressStatus = computed(() => {
  if (trialStatus.value === 'ERROR') return 'exception'
  if (progress.value >= 100 || trialStatus.value === 'DONE') return 'success'
  return ''
})
const progressTip = computed(() => {
  if (running.value) {
    const seconds = Math.max(0, Math.floor(elapsedMs.value / 1000))
    return `正在试算，已耗时 ${seconds}s`
  }
  if (lastDurationMs.value > 0) {
    const seconds = Math.max(1, Math.ceil(lastDurationMs.value / 1000))
    return `试算完成，用时 ${seconds}s`
  }
  return '试算完成'
})

const formatAmount = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return '-'
  }
  return number.toFixed(2)
}

const formatQty = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return String(value)
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

const mapItems = (items) =>
  items.map((item) => ({
    productName: item.productName || '',
    materialCode: item.materialNo || item.materialCode || '',
    customerDrawing: item.customerDrawing || '',
    spec: item.spec || '',
    supportQty: item.supportQty ?? null,
    unitCost:
      item.unitCost ??
      item.totalNoShip ??
      item.totalWithShip ??
      item.materialCost ??
      item.laborCost ??
      null,
    totalCost:
      item.costAmount ??
      item.totalWithShip ??
      item.totalNoShip ??
      item.materialCost ??
      item.laborCost ??
      null,
  }))

const loadResult = async () => {
  if (!oaNo.value) {
    ElMessage.error('缺少 OA 单号')
    return
  }
  const data = await fetchOaFormDetail(oaNo.value)
  const key = data?.key || {}
  const items = Array.isArray(data?.items) ? data.items : []
  result.value = {
    meta: {
      oaNo: key.oaNo || oaNo.value,
      formType: key.formType || '',
      customer: key.customer || '',
      applyDate: key.applyDate || '',
      status: key.calcStatus || key.status || key.auditStatus || '',
    },
    items: mapItems(items),
  }
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

const stopProgressTimer = () => {
  if (progressTimer.value) {
    clearInterval(progressTimer.value)
    progressTimer.value = null
  }
}

const pollProgress = async () => {
  if (!oaNo.value) {
    return
  }
  try {
    const data = await fetchCostRunProgress(oaNo.value)
    if (!data) {
      return
    }
    const percent = Number(data.percent)
    if (Number.isFinite(percent)) {
      progress.value = Math.max(0, Math.min(100, percent))
    }
    // T17：同步排队位置
    queuePos.value = Number(data.queuePos) || 0
    // T18(a)：同步状态镜像，驱动进度条颜色 + 复原后 UI
    trialStatus.value = data.status || ''
    if (data.status === 'ERROR') {
      ElMessage.error(data.message || '试算失败')
      stopProgressTimer()
    }
  } catch (error) {
    // Ignore polling errors to avoid blocking the trial flow.
  }
}

const waitForCompletion = () => {
  // T18(d)：原 5min 太长，后端崩溃用户要等到天荒地老。30s 内没拿到 DONE/ERROR → toast + 兜底
  const pollStart = Date.now()
  let lastSuccessAt = Date.now()
  return new Promise((resolve) => {
    const check = async () => {
      if (!oaNo.value) {
        resolve('ERROR')
        return
      }
      // T18(d)：30s 内没拿到任何 progress 响应 → 视为后端崩溃
      if (Date.now() - lastSuccessAt > POLL_TIMEOUT_MS) {
        ElMessage.error('后端长时间无响应（>30s），请检查后端是否崩溃；可刷新页面重试')
        resolve('ERROR')
        return
      }
      try {
        const data = await fetchCostRunProgress(oaNo.value)
        if (data) {
          lastSuccessAt = Date.now()
          const percent = Number(data.percent)
          if (Number.isFinite(percent)) {
            progress.value = Math.max(0, Math.min(100, percent))
          }
          // T17：同步排队位置
          queuePos.value = Number(data.queuePos) || 0
          // T18(a)：同步状态镜像
          trialStatus.value = data.status || ''
          if (data.status === 'DONE') {
            progress.value = 100
            queuePos.value = 0
            resolve('DONE')
            return
          }
          if (data.status === 'ERROR') {
            ElMessage.error(data.message || '试算失败')
            resolve('ERROR')
            return
          }
        }
      } catch (e) {
        // ignore polling errors
      }
      setTimeout(check, 1000)
    }
    setTimeout(check, 500)
  })
}

const startProgress = () => {
  stopTimer()
  stopProgressTimer()
  progress.value = 0
  running.value = true
  elapsedMs.value = 0
  lastDurationMs.value = 0
  startAt.value = Date.now()
  timer.value = window.setInterval(() => {
    elapsedMs.value = Date.now() - startAt.value
  }, 500)
}

const resetFlow = async () => {
  if (!oaNo.value) {
    stopTimer()
    stopProgressTimer()
    running.value = false
    progress.value = 0
    elapsedMs.value = 0
    lastDurationMs.value = 0
    statusOverride.value = ''
    result.value = { meta: {}, items: [] }
    return
  }
  stopProgressTimer()
  elapsedMs.value = 0
  lastDurationMs.value = 0
  statusOverride.value = ''

  // T18(f)：进页面先查 live progress，后端还在跑 → 直接接管 polling，不重复 enqueue
  try {
    const live = await fetchCostRunProgress(oaNo.value)
    if (live && (live.status === 'RUNNING' || live.status === 'QUEUED')) {
      startProgress()
      progress.value = Math.max(0, Math.min(100, Number(live.percent) || 0))
      queuePos.value = Number(live.queuePos) || 0
      trialStatus.value = live.status
      const finalStatus = await waitForCompletion()
      if (finalStatus === 'DONE') {
        statusOverride.value = '已核算'
      }
      await loadResult()
      lastDurationMs.value = Date.now() - startAt.value
      elapsedMs.value = lastDurationMs.value
      stopTimer()
      stopProgressTimer()
      running.value = false
      return
    }
  } catch (e) {
    // 查不到 progress 不影响后续流程
  }

  await loadResult()
  if (displayStatus.value === '未核算') {
    startProgress()
    try {
      await runCostTrial(oaNo.value)
      // 后端是异步执行，轮询进度直到 DONE 或 ERROR
      const finalStatus = await waitForCompletion()
      if (finalStatus === 'DONE') {
        statusOverride.value = '已核算'
      }
      await loadResult()
    } catch (error) {
      ElMessage.error(error?.message || '试算失败')
    } finally {
      lastDurationMs.value = Date.now() - startAt.value
      elapsedMs.value = lastDurationMs.value
      stopTimer()
      stopProgressTimer()
      running.value = false
    }
    return
  }
  stopTimer()
  stopProgressTimer()
  progress.value = 100
  running.value = false
}

const goBack = () => {
  router.push('/cost/run')
}

const goOaDetail = (row) => {
  if (!meta.value.oaNo) {
    return
  }
  const query = {
    status: displayStatus.value,
  }
  if (meta.value.customer) {
    query.customer = meta.value.customer
  }
  if (row?.productName) {
    query.productName = row.productName
  }
  if (row?.materialCode) {
    query.materialCode = row.materialCode
  }
  if (row?.customerDrawing) {
    query.customerDrawing = row.customerDrawing
  }
  if (row?.spec) {
    query.spec = row.spec
  }
  router.push({
    path: `/cost/run/${meta.value.oaNo}/detail`,
    query,
  })
}

watch([oaNo, queryStatus], () => {
  resetFlow()
}, { immediate: true })

onBeforeUnmount(() => {
  stopTimer()
  stopProgressTimer()
})
</script>

<style scoped>
.cost-run-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card {
  padding-bottom: 4px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
}

.header-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
  margin-bottom: 10px;
}

.progress-card {
  padding-bottom: 6px;
}

.progress-tip {
  margin-top: 6px;
  color: #6b7280;
  font-size: 12px;
}

/* T17：排队提示 */
.queue-tip {
  margin-bottom: 8px;
}
</style>
