<template>
  <cms-cost-page-shell
    title="CMS 公共生效来源"
    description="默认按已审批 CMS 数据自动取当年 1 月起最早期间；发现异常时按年度、料号和来源月份整体更新。"
    trace-nav
  >
    <template #actions>
      <el-button
        v-hasPermi="['cms:cost:effective:refresh']"
        type="warning"
        @click="openRefreshFromFilters"
      >
        更新来源
      </el-button>
    </template>

    <section class="cms-query-panel">
      <el-form :inline="true" :model="filters" label-width="84px">
        <el-form-item label="成本年度">
          <el-select v-model="filters.costYear" placeholder="年度" style="width: 120px">
            <el-option
              v-for="year in costYearOptions"
              :key="year"
              :label="String(year)"
              :value="year"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成品料号">
          <div class="cms-parent-code-select" @paste.capture="handleFilterParentCodesPaste">
            <el-select
              v-model="filters.parentCodes"
              multiple
              filterable
              allow-create
              default-first-option
              clearable
              collapse-tags
              collapse-tags-tooltip
              :reserve-keyword="false"
              placeholder="粘贴或输入多个料号"
              style="width: 320px"
              @change="normalizeFilterParentCodeSelection"
            />
          </div>
        </el-form-item>
        <el-form-item label="来源期间">
          <el-date-picker
            v-model="filters.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="全部"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="成本类型">
          <el-select v-model="filters.sourceType" clearable placeholder="全部" style="width: 160px">
            <el-option label="直接人工工资" value="SALARY_DIRECT" />
            <el-option label="辅助员工工资" value="SALARY_INDIRECT" />
            <el-option label="辅料科目" value="AUX_SUBJECT" />
          </el-select>
        </el-form-item>
        <el-form-item label="科目编码">
          <el-input v-model="filters.subjectCode" clearable placeholder="辅料二级科目" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <el-table
      ref="effectiveTableRef"
      :data="rows"
      stripe
      border
      v-loading="loading"
      row-key="id"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="46" fixed />
      <el-table-column prop="costYear" label="年度" width="90" fixed />
      <el-table-column prop="parentCode" label="成品料号" width="150" fixed />
      <el-table-column label="成本类型" width="130">
        <template #default="{ row }">{{ displaySourceType(row.sourceType) }}</template>
      </el-table-column>
      <el-table-column prop="period" label="当前期间" width="105" />
      <el-table-column prop="unapprovedItems" label="未审批项" width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.unapprovedItems || '' }}</template>
      </el-table-column>
      <el-table-column prop="amountYuan" label="金额(元)" width="115" />
      <el-table-column prop="subjectCode" label="科目编码" width="120">
        <template #default="{ row }">{{ displayNullable(row.subjectCode) }}</template>
      </el-table-column>
      <el-table-column prop="subjectName" label="科目名称" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ displayNullable(row.subjectName) }}</template>
      </el-table-column>
      <el-table-column label="默认来源" width="95">
        <template #default="{ row }">
          <el-tag :type="row.defaultFlag ? 'success' : 'warning'" size="small">
            {{ row.defaultFlag ? '默认' : '已更新' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="refreshReason" label="更新原因" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">{{ displayNullable(row.refreshReason) }}</template>
      </el-table-column>
      <el-table-column prop="confirmedBy" label="确认人" width="110">
        <template #default="{ row }">{{ displayNullable(row.confirmedBy) }}</template>
      </el-table-column>
      <el-table-column label="确认时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.confirmedAt) }}</template>
      </el-table-column>
      <el-table-column prop="sourceRowIds" label="来源原始行" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ displayNullable(row.sourceRowIds) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openSourceRows(row)">原始行</el-button>
          <el-button link type="primary" @click="openLogs(row)">日志</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无公共生效来源" />
      </template>
    </el-table>

    <BasePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
    />

    <el-dialog v-model="refreshVisible" title="更新公共生效来源" width="560px" destroy-on-close>
      <el-form :model="refreshForm" label-width="96px">
        <el-form-item label="成本年度" required>
          <el-select v-model="refreshForm.costYear" placeholder="年度" style="width: 180px">
            <el-option
              v-for="year in costYearOptions"
              :key="year"
              :label="String(year)"
              :value="year"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成品料号" required>
          <div class="cms-parent-code-select" @paste.capture="handleRefreshParentCodesPaste">
            <el-select
              v-model="refreshForm.parentCodes"
              multiple
              filterable
              allow-create
              default-first-option
              clearable
              collapse-tags
              collapse-tags-tooltip
              :reserve-keyword="false"
              placeholder="粘贴或输入多个料号"
              style="width: 360px"
              @change="normalizeRefreshParentCodeSelection"
            />
          </div>
        </el-form-item>
        <el-form-item label="新来源期间" required>
          <el-date-picker
            v-model="refreshForm.newPeriod"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择同年度月份"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="更新原因" required>
          <el-input
            v-model="refreshForm.refreshReason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="说明本料号本年度更新来源期间的原因"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="refreshVisible = false">取消</el-button>
        <el-button type="primary" :loading="refreshing" @click="submitRefresh">
          确认更新{{ refreshForm.parentCodes.length > 1 ? `(${refreshForm.parentCodes.length})` : '' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logVisible" title="公共生效来源日志" width="1080px">
      <section class="cms-query-panel cms-query-panel--dialog">
        <el-form :inline="true" :model="logFilters" label-width="76px">
          <el-form-item label="成本年度">
            <el-select v-model="logFilters.costYear" placeholder="年度" style="width: 120px">
              <el-option
                v-for="year in costYearOptions"
                :key="year"
                :label="String(year)"
                :value="year"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="成品料号">
            <el-input v-model="logFilters.parentCode" clearable placeholder="父件编码" />
          </el-form-item>
          <el-form-item label="成本类型">
            <el-select v-model="logFilters.sourceType" clearable placeholder="全部" style="width: 150px">
              <el-option label="直接人工工资" value="SALARY_DIRECT" />
              <el-option label="辅助员工工资" value="SALARY_INDIRECT" />
              <el-option label="辅料科目" value="AUX_SUBJECT" />
            </el-select>
          </el-form-item>
          <el-form-item label="动作">
            <el-select v-model="logFilters.actionType" clearable placeholder="全部" style="width: 120px">
              <el-option label="默认生成" value="DEFAULT" />
              <el-option label="更新" value="REFRESH" />
              <el-option label="阻断" value="BLOCKED" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="applyLogFilters">查询</el-button>
          </el-form-item>
        </el-form>
      </section>

      <el-table :data="logRows" stripe border v-loading="logLoading">
        <el-table-column prop="actionType" label="动作" width="100" />
        <el-table-column prop="costYear" label="年度" width="80" />
        <el-table-column prop="parentCode" label="成品料号" width="145" />
        <el-table-column label="成本类型" width="130">
          <template #default="{ row }">{{ displaySourceType(row.sourceType) }}</template>
        </el-table-column>
        <el-table-column prop="oldPeriod" label="原期间" width="95">
          <template #default="{ row }">{{ displayNullable(row.oldPeriod) }}</template>
        </el-table-column>
        <el-table-column prop="newPeriod" label="新期间" width="95">
          <template #default="{ row }">{{ displayNullable(row.newPeriod) }}</template>
        </el-table-column>
        <el-table-column prop="oldAmountYuan" label="原金额" width="100">
          <template #default="{ row }">{{ displayNullable(row.oldAmountYuan) }}</template>
        </el-table-column>
        <el-table-column prop="newAmountYuan" label="新金额" width="100">
          <template #default="{ row }">{{ displayNullable(row.newAmountYuan) }}</template>
        </el-table-column>
        <el-table-column prop="subjectName" label="科目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ displayNullable(row.subjectName || row.subjectCode) }}</template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column prop="operator" label="操作人" width="105">
          <template #default="{ row }">{{ displayNullable(row.operator) }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无生效来源日志" />
        </template>
      </el-table>

      <BasePagination
        v-model:current-page="logCurrentPage"
        v-model:page-size="logPageSize"
        :total="logTotal"
      />
    </el-dialog>
  </cms-cost-page-shell>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import CmsCostPageShell from '../components/CmsCostPageShell.vue'
import {
  fetchCmsCostEffectiveSourceLogs,
  fetchCmsCostEffectiveSources,
  normalizeCmsCostPage,
  refreshCmsCostEffectiveSource,
  toCmsCostPageParams,
} from '../api/cmsCost'
import { displayNullable } from '../utils/cmsCostSourceDisplay'

const router = useRouter()
const currentYear = new Date().getFullYear()
const costYearOptions = Array.from({ length: 9 }, (_, index) => currentYear + 1 - index)

const filters = reactive({
  costYear: currentYear,
  parentCodes: [],
  period: '',
  sourceType: '',
  subjectCode: '',
})
const rows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const effectiveTableRef = ref(null)
const selectedRows = ref([])

const refreshVisible = ref(false)
const refreshing = ref(false)
const refreshForm = reactive({
  costYear: currentYear,
  parentCodes: [],
  newPeriod: '',
  refreshReason: '',
})

const logVisible = ref(false)
const logRows = ref([])
const logTotal = ref(0)
const logCurrentPage = ref(1)
const logPageSize = ref(20)
const logLoading = ref(false)
const logFilters = reactive({
  costYear: currentYear,
  parentCode: '',
  sourceType: '',
  subjectCode: '',
  actionType: '',
})

function splitParentCodes(text) {
  return String(text || '')
    .split(/[\s,，;；]+/)
    .map((code) => code.trim())
    .filter(Boolean)
}

function normalizeParentCodes(values) {
  const text = Array.isArray(values) ? values.join(' ') : values
  return Array.from(new Set(splitParentCodes(text)))
}

function mergeParentCodes(target, codes) {
  const merged = normalizeParentCodes([...target, ...codes])
  target.splice(0, target.length, ...merged)
}

function handleFilterParentCodesPaste(event) {
  const codes = splitParentCodes(event.clipboardData?.getData('text'))
  if (codes.length <= 1) return
  event.preventDefault()
  mergeParentCodes(filters.parentCodes, codes)
  applyFilters()
}

function handleRefreshParentCodesPaste(event) {
  const codes = splitParentCodes(event.clipboardData?.getData('text'))
  if (codes.length <= 1) return
  event.preventDefault()
  mergeParentCodes(refreshForm.parentCodes, codes)
}

function normalizeFilterParentCodeSelection(values) {
  filters.parentCodes = normalizeParentCodes(values || [])
  nextTick(syncTableSelectionByParentCodes)
}

function normalizeRefreshParentCodeSelection(values) {
  refreshForm.parentCodes = normalizeParentCodes(values || [])
}

function distinctParentCodesFromRows(selection) {
  return Array.from(
    new Set(
      (selection || [])
        .map((row) => row.parentCode)
        .filter(Boolean),
    ),
  )
}

function handleSelectionChange(selection) {
  selectedRows.value = selection || []
}

function syncTableSelectionByParentCodes() {
  const table = effectiveTableRef.value
  if (!table) return
  table.clearSelection()
  const selectedParentCodes = new Set(filters.parentCodes)
  if (!selectedParentCodes.size) return
  rows.value.forEach((row) => {
    if (selectedParentCodes.has(row.parentCode)) {
      table.toggleRowSelection(row, true)
    }
  })
}

function displaySourceType(sourceType) {
  const map = {
    SALARY_DIRECT: '直接人工工资',
    SALARY_INDIRECT: '辅助员工工资',
    AUX_SUBJECT: '辅料科目',
  }
  return map[sourceType] || displayNullable(sourceType)
}

function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function buildParams() {
  return toCmsCostPageParams(
    {
      costYear: filters.costYear,
      parentCode: filters.parentCodes.join(','),
      period: filters.period,
      sourceType: filters.sourceType,
      subjectCode: filters.subjectCode.trim(),
    },
    currentPage.value,
    pageSize.value,
  )
}

async function fetchRows() {
  loading.value = true
  try {
    const page = normalizeCmsCostPage(await fetchCmsCostEffectiveSources(buildParams()))
    rows.value = page.list
    total.value = page.total
    await nextTick()
    syncTableSelectionByParentCodes()
  } catch (error) {
    ElMessage.error(error.message || 'CMS 公共生效来源查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  filters.costYear = currentYear
  filters.parentCodes = []
  filters.period = ''
  filters.sourceType = ''
  filters.subjectCode = ''
  selectedRows.value = []
  applyFilters()
}

function openRefreshFromFilters() {
  const selectedParentCodes = distinctParentCodesFromRows(selectedRows.value)
  refreshForm.costYear = filters.costYear || currentYear
  refreshForm.parentCodes = selectedParentCodes.length ? selectedParentCodes : [...filters.parentCodes]
  refreshForm.newPeriod = filters.period || ''
  refreshForm.refreshReason = ''
  refreshVisible.value = true
}

async function submitRefresh() {
  const parentCodes = normalizeParentCodes(refreshForm.parentCodes)
  refreshForm.parentCodes = parentCodes
  if (!refreshForm.costYear) {
    ElMessage.warning('请选择成本年度')
    return
  }
  if (!parentCodes.length) {
    ElMessage.warning('请填写成品料号')
    return
  }
  if (!refreshForm.newPeriod) {
    ElMessage.warning('请选择新来源期间')
    return
  }
  if (!refreshForm.newPeriod.startsWith(`${refreshForm.costYear}-`)) {
    ElMessage.warning('新来源期间必须属于成本年度')
    return
  }
  if (!refreshForm.refreshReason.trim()) {
    ElMessage.warning('请填写更新原因')
    return
  }
  refreshing.value = true
  const failures = []
  try {
    for (const parentCode of parentCodes) {
      try {
        await refreshCmsCostEffectiveSource({
          costYear: refreshForm.costYear,
          parentCode,
          newPeriod: refreshForm.newPeriod,
          refreshReason: refreshForm.refreshReason.trim(),
        })
      } catch (error) {
        failures.push({
          parentCode,
          message: error.message || '更新失败',
        })
      }
    }
    const successCount = parentCodes.length - failures.length
    if (successCount > 0) {
      ElMessage.success(`公共生效来源已更新 ${successCount} 个料号`)
      refreshVisible.value = false
      fetchRows()
    }
    if (failures.length > 0) {
      const firstFailure = failures[0]
      ElMessage.error(`更新失败 ${failures.length} 个料号，首个失败：${firstFailure.parentCode} ${firstFailure.message}`)
    }
  } finally {
    refreshing.value = false
  }
}

function openSourceRows(row) {
  if (row.sourceType === 'SALARY_DIRECT') {
    router.push({
      path: '/base/cms-cost/workshop-rows',
      query: { costYear: row.costYear, parentCode: row.parentCode, period: row.period },
    })
    return
  }
  router.push({
    path: '/base/cms-cost/subject-rows',
    query: {
      costYear: row.costYear,
      parentCode: row.parentCode,
      period: row.period,
      subjectCode: row.subjectCode || '',
    },
  })
}

function openLogs(row) {
  logFilters.costYear = row.costYear
  logFilters.parentCode = row.parentCode
  logFilters.sourceType = row.sourceType
  logFilters.subjectCode = row.subjectCode || ''
  logFilters.actionType = ''
  logCurrentPage.value = 1
  logVisible.value = true
  fetchLogs()
}

function buildLogParams() {
  return toCmsCostPageParams(
    {
      costYear: logFilters.costYear,
      parentCode: logFilters.parentCode.trim(),
      sourceType: logFilters.sourceType,
      subjectCode: logFilters.subjectCode.trim(),
      actionType: logFilters.actionType,
    },
    logCurrentPage.value,
    logPageSize.value,
  )
}

async function fetchLogs() {
  logLoading.value = true
  try {
    const page = normalizeCmsCostPage(await fetchCmsCostEffectiveSourceLogs(buildLogParams()))
    logRows.value = page.list
    logTotal.value = page.total
  } catch (error) {
    ElMessage.error(error.message || 'CMS 公共生效来源日志查询失败')
  } finally {
    logLoading.value = false
  }
}

function applyLogFilters() {
  logCurrentPage.value = 1
  fetchLogs()
}

watch([currentPage, pageSize], fetchRows)
watch([logCurrentPage, logPageSize], () => {
  if (logVisible.value) fetchLogs()
})

onMounted(fetchRows)
</script>

<style scoped>
.cms-query-panel {
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f8fafc;
}

.cms-query-panel--dialog {
  margin-bottom: 12px;
}

</style>
