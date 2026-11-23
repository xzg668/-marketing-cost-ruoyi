<template>
  <section class="month-close" v-loading="loading">
    <header class="page-head">
      <h1>月末结账</h1>
      <div class="actions">
        <el-select v-model="selectedMonth" aria-label="结账月份" @change="load">
          <el-option label="当前生效核算月" value="" />
          <el-option v-for="entry in history" :key="entry.id"
            :label="`${entry.periodMonth}（已结账）`" :value="entry.periodMonth" />
        </el-select>
        <el-button @click="load">刷新</el-button>
        <el-button v-if="view && !view.close && view.periodMonth === view.activeMonth"
          type="primary" :loading="confirming" :disabled="loading" @click="confirmClose">
          结账
        </el-button>
        <el-button v-if="view?.canRevoke" type="warning" plain
          :loading="confirming" :disabled="loading" @click="revokeClose">
          撤销结账
        </el-button>
      </div>
    </header>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="view">
      <div class="summary">
        <strong>{{ view.periodMonth }} · 商用报价</strong>
        <el-tag :type="view.close ? 'success' : 'info'">{{ view.close ? '已结账' : '结账预览' }}</el-tag>
        <span v-if="view.close">{{ view.close.closedBy }} · {{ dateTime(view.close.closedAt) }}</span>
        <span>{{ view.orderCount }} 张 OA 单 · {{ view.readyCount }} 条{{ view.close ? '已结账' : '可结账' }}</span>
      </div>
      <div class="actions filters">
        <el-input v-model="search" placeholder="搜索 OA 单号、客户、料号或型号" clearable aria-label="搜索结账明细" />
      </div>
      <el-table :data="visibleRows" row-key="itemId" border stripe max-height="660"
        empty-text="没有符合条件的产品明细">
        <el-table-column prop="oaNo" label="OA 单号" min-width="200">
          <template #default="{ row }">
            <router-link :to="`/ingest/quote-requests/${encodeURIComponent(row.oaNo)}`">{{ row.oaNo }}</router-link>
          </template>
        </el-table-column>
        <el-table-column prop="customer" label="客户" min-width="145" show-overflow-tooltip />
        <el-table-column prop="lineNo" label="行号" width="66" />
        <el-table-column prop="productCode" label="料号" min-width="125" />
        <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="model" label="型号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="spec" label="规格" min-width="125" show-overflow-tooltip />
        <el-table-column prop="amount" label="成本" width="115" align="right">
          <template #default="{ row }">{{ row.amount ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="versionNo" label="版本" width="80">
          <template #default="{ row }">{{ row.versionNo || '—' }}</template>
        </el-table-column>
        <el-table-column label="核算完成时间" min-width="167">
          <template #default="{ row }">{{ dateTime(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="145" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openVersion(row)">看成本</el-button>
            <el-button link type="primary" :loading="exporting === row.itemId" @click="download(row)">导出</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-if="filteredRows.length > pageSize" v-model:current-page="page"
        :page-size="pageSize" :total="filteredRows.length" layout="total, prev, pager, next" />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { confirmQuoteMonthClose, fetchQuoteMonthClose, fetchQuoteMonthCloseHistory, revokeQuoteMonthClose } from '../api/quoteMonthClose'
import { exportQuoteCostRunVersion } from '../api/quoteRequests'

const router = useRouter()
const selectedMonth = ref('')
const search = ref('')
const loading = ref(false)
const confirming = ref(false)
const exporting = ref(null)
const error = ref('')
const view = ref(null)
const history = ref([])
const page = ref(1)
const pageSize = 50
let generation = 0

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return (view.value?.rows || []).filter(row =>
    [row.oaNo, row.customer, row.productCode, row.productName, row.model, row.spec]
      .some(value => String(value ?? '').toLowerCase().includes(keyword)))
})
const visibleRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch(search, () => { page.value = 1 })
onScopeDispose(() => { generation++ })

function dateTime(value) { return value ? value.replace('T', ' ').slice(0, 19) : '—' }

async function load() {
  const request = ++generation
  loading.value = true
  error.value = ''
  page.value = 1
  try {
    const [data, periods] = await Promise.all([
      fetchQuoteMonthClose(selectedMonth.value || undefined),
      fetchQuoteMonthCloseHistory(),
    ])
    if (request !== generation) return
    view.value = data
    history.value = periods
  } catch (failure) {
    if (request !== generation) return
    view.value = null
    error.value = failure?.message || '读取结账清单失败'
  } finally {
    if (request === generation) loading.value = false
  }
}

async function confirmClose() {
  const current = view.value
  if (!current || current.close || current.periodMonth !== current.activeMonth || confirming.value) return
  const summary = `${current.periodMonth} · ${current.orderCount} 张 OA 单 · ${current.readyCount} 条可结账产品`
  if (!current.canConfirm) {
    const message = current.readyCount
      ? `${summary}。当前仅开放预览。`
      : `${summary}。当月没有可结账的正式成本。`
    await ElMessageBox.alert(message, '结账预览', { confirmButtonText: '关闭', type: 'info' }).catch(() => {})
    return
  }
  const request = generation
  try {
    await ElMessageBox.confirm(
      `确认结 ${current.periodMonth} 的账？将锁定 ${current.orderCount} 张 OA 单中的 ${current.readyCount} 条产品成本。`,
      '确认月末结账', { confirmButtonText: '确认结账', cancelButtonText: '返回', type: 'warning' },
    )
  } catch { return }
  if (request !== generation) return
  confirming.value = true
  try {
    const receipt = await confirmQuoteMonthClose(current.periodMonth)
    if (request !== generation) return
    selectedMonth.value = receipt.periodMonth
    ElMessage.success(`${receipt.periodMonth} 已结账`)
    await load()
  } catch (failure) {
    if (request === generation) ElMessage.error(failure?.message || '结账未完成')
  } finally { confirming.value = false }
}

async function revokeClose() {
  const current = view.value
  if (!current?.canRevoke || !current.close || confirming.value) return
  const request = generation
  let reason
  try {
    const result = await ElMessageBox.prompt(
      `撤销 ${current.periodMonth} 结账后，当月已结账产品恢复核算。请输入撤销原因。`,
      '撤销月末结账', {
        confirmButtonText: '撤销结账', cancelButtonText: '返回', type: 'warning',
        inputValidator: value => (value?.trim().length > 0 && value.trim().length <= 250) || '请输入撤销原因，最多250字',
      },
    )
    reason = result.value.trim()
  } catch { return }
  if (request !== generation) return
  confirming.value = true
  try {
    await revokeQuoteMonthClose(current.close.id, current.periodMonth, reason)
    if (request !== generation) return
    selectedMonth.value = ''
    ElMessage.success(`${current.periodMonth} 已撤销结账`)
    await load()
  } catch (failure) {
    if (request === generation) ElMessage.error(failure?.message || '撤销结账失败')
  } finally { confirming.value = false }
}

function openVersion(row) {
  router.push({
    name: 'ingest-quote-product-costing',
    params: { oaNo: row.oaNo, itemId: row.itemId },
    query: { tab: 'COST_RUN', versionId: row.versionId, historyResult: 'quote' },
  })
}

async function download(row) {
  if (exporting.value != null) return
  const request = generation
  exporting.value = row.itemId
  try {
    await exportQuoteCostRunVersion(row.oaNo, row.itemId, row.versionId, { isCurrent: () => request === generation })
  } catch (failure) {
    if (request === generation) ElMessage.error(failure?.message || '导出成本失败')
  } finally { exporting.value = null }
}

onMounted(load)
</script>

<style scoped>
.month-close { padding: 20px; display: grid; gap: 14px; }
.page-head, .summary, .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.page-head { justify-content: space-between; }
.page-head h1 { margin: 0; font-size: 22px; }
.actions .el-select { width: 182px; }
.actions .el-input { width: min(360px, 100%); }
.summary { padding: 12px 14px; background: var(--el-fill-color-light); border-radius: 6px; }
</style>
