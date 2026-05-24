<template>
  <div class="make-calc-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>制造件价格生成</h1>
        <p>价格源管理</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="RefreshRight" :loading="loading" @click="refreshLatest">刷新</el-button>
        <el-button
          v-hasPermi="['price:make-part-calc:export']"
          :icon="Download"
          :loading="exporting"
          @click="exportRows"
        >
          导出 Excel
        </el-button>
        <el-button
          v-hasPermi="['price:make-part-calc:generate']"
          type="primary"
          :loading="generating"
        >
          <el-dropdown trigger="click" @command="openGenerateDialog">
            <span class="generate-trigger">
              <el-icon><Operation /></el-icon>
              生成
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="OA">按 OA 生成</el-dropdown-item>
                <el-dropdown-item command="MATERIAL">按制造件料号生成</el-dropdown-item>
                <el-dropdown-item command="ALL">全量生成</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-button>
      </div>
    </section>

    <section class="summary-strip">
      <div class="summary-item">
        <span>当前批次</span>
        <strong :title="filters.calcBatchId">{{ filters.calcBatchId || '-' }}</strong>
      </div>
      <div class="summary-item">
        <span>总行数</span>
        <strong>{{ total }}</strong>
      </div>
      <div
        v-for="item in summaryCards"
        :key="item.status"
        class="summary-item clickable"
        @click="filterStatus(item.status)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
      </div>
    </section>

    <section class="query-panel">
      <el-form :model="filters" class="query-form" :inline="true" label-width="92px">
        <el-form-item label="OA单号">
          <el-input v-model="filters.oaNo" clearable placeholder="OA-2026..." />
        </el-form-item>
        <el-form-item label="制造件料号">
          <el-input v-model="filters.parentMaterialNo" clearable placeholder="制造件料号" />
        </el-form-item>
        <el-form-item label="只看异常">
          <el-switch v-model="filters.onlyError" @change="handleOnlyErrorChange" />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
          <el-button
            :icon="Filter"
            :type="showAdvancedFilters ? 'primary' : 'default'"
            plain
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            高级筛选
          </el-button>
        </el-form-item>
        <template v-if="showAdvancedFilters">
          <el-form-item label="生成批次">
            <el-input v-model="filters.calcBatchId" clearable placeholder="calc_batch_id" />
          </el-form-item>
          <el-form-item label="价格月份">
            <el-date-picker
              v-model="filters.pricingMonth"
              type="month"
              format="YYYY-MM"
              value-format="YYYY-MM"
              clearable
              placeholder="全部月份"
            />
          </el-form-item>
          <el-form-item label="原材料料号">
            <el-input v-model="filters.childMaterialNo" clearable placeholder="原材料/毛坯料号" />
          </el-form-item>
          <el-form-item label="回收料号">
            <el-input v-model="filters.scrapCode" clearable placeholder="废料料号" />
          </el-form-item>
          <el-form-item label="料件类型">
            <el-select v-model="filters.itemProcessType" clearable placeholder="全部">
              <el-option
                v-for="option in MAKE_PART_PROCESS_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="filters.status"
              clearable
              :disabled="filters.onlyError"
              placeholder="全部"
            >
              <el-option
                v-for="option in MAKE_PART_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="业务单元">
            <el-select v-model="filters.businessUnitType" clearable placeholder="全部">
              <el-option label="商用部品" value="COMMERCIAL" />
              <el-option label="家用部品" value="HOUSEHOLD" />
            </el-select>
          </el-form-item>
          <el-form-item label="缺价类型">
            <el-select v-model="filters.missingPriceRole" clearable placeholder="全部">
              <el-option label="缺原材料价" value="RAW" />
              <el-option label="缺废料价" value="SCRAP" />
            </el-select>
          </el-form-item>
          <el-form-item label="补价料号">
            <el-input v-model="filters.missingMaterialNo" clearable placeholder="要补价的料号" />
          </el-form-item>
        </template>
      </el-form>
    </section>

    <section class="table-panel">
      <el-tabs v-model="activeTab" class="result-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="生成结果" name="calc">
          <el-table
            :data="tableRows"
            border
            stripe
            v-loading="loading"
            row-key="id"
            class="calc-table"
          >
            <el-table-column prop="pricingMonth" label="价格月份" width="105" fixed show-overflow-tooltip>
              <template #default="{ row }">{{ displayPricingMonth(row) }}</template>
            </el-table-column>
            <el-table-column prop="createdAt" label="生成时间" width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="oaNo" label="OA单号" width="145" show-overflow-tooltip />
            <el-table-column prop="parentMaterialNo" label="料号" width="150" show-overflow-tooltip />
            <el-table-column prop="parentMaterialName" label="名称" min-width="170" show-overflow-tooltip />
            <el-table-column prop="drawingNo" label="图号" min-width="140" show-overflow-tooltip />
            <el-table-column prop="itemProcessType" label="料件类型" width="110" />
            <el-table-column prop="grossWeightG" label="毛重(g)" width="105" align="right">
              <template #default="{ row }">{{ formatNumber(row.grossWeightG) }}</template>
            </el-table-column>
            <el-table-column prop="netWeightG" label="净重(g)" width="105" align="right">
              <template #default="{ row }">{{ formatNumber(row.netWeightG) }}</template>
            </el-table-column>
            <el-table-column prop="parentTotalCostPrice" label="零件价格" width="120" align="right">
              <template #default="{ row }">{{ formatMoney(row.parentTotalCostPrice) }}</template>
            </el-table-column>
            <el-table-column prop="childMaterialNo" label="原材料代码" width="150" show-overflow-tooltip />
            <el-table-column label="原材料/毛坯" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ displayChildMaterial(row) }}</template>
            </el-table-column>
            <el-table-column label="原材料价格(元/kg 或 元/件)" width="170" align="right">
              <template #default="{ row }">{{ formatMoney(row.rawUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="scrapCode" label="回收代码" width="135" show-overflow-tooltip />
            <el-table-column prop="scrapName" label="回收名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="scrapUnitPrice" label="回收单价(元/kg)" width="145" align="right">
              <template #default="{ row }">{{ formatMoney(row.scrapUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="outsourceFee" label="委外加工费" width="120" align="right">
              <template #default="{ row }">{{ formatMoney(row.outsourceFee) }}</template>
            </el-table-column>
            <el-table-column label="是否完整取价" width="125">
              <template #default="{ row }">
                <el-tag size="small" :type="row.priceComplete ? 'success' : 'danger'">
                  {{ row.priceComplete ? '已取全价' : '缺价格' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="125">
              <template #default="{ row }">
                <el-tag size="small" :type="statusTagType(row.status)">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="118" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openTrace(row)">查看计算追溯</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无制造件价格生成结果" />
            </template>
          </el-table>

          <BasePagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
          />
        </el-tab-pane>
        <el-tab-pane label="缺价清单" name="gap">
          <el-table
            :data="gapRows"
            border
            stripe
            v-loading="gapLoading"
            row-key="id"
            class="calc-table"
          >
            <el-table-column prop="pricingMonth" label="价格月份" width="105" fixed show-overflow-tooltip>
              <template #default="{ row }">{{ displayPricingMonth(row) }}</template>
            </el-table-column>
            <el-table-column prop="generatedAt" label="生成时间" width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ formatDateTime(row.generatedAt) }}</template>
            </el-table-column>
            <el-table-column prop="calcBatchId" label="批次" width="170" show-overflow-tooltip />
            <el-table-column prop="oaNo" label="OA单号" width="140" show-overflow-tooltip />
            <el-table-column prop="businessUnitType" label="业务单元" width="110" />
            <el-table-column prop="parentMaterialNo" label="制造件料号" width="145" show-overflow-tooltip />
            <el-table-column prop="parentMaterialName" label="制造件名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="childMaterialNo" label="原材料料号" width="145" show-overflow-tooltip />
            <el-table-column label="原材料名称/规格" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.childMaterialSpec || row.childMaterialName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="scrapCode" label="废料料号" width="135" show-overflow-tooltip />
            <el-table-column prop="scrapName" label="废料名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="缺价类型" width="115">
              <template #default="{ row }">
                <el-tag size="small" :type="gapRoleTagType(row.missingPriceRole)">
                  {{ gapRoleLabel(row.missingPriceRole) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="missingMaterialNo" label="要补价的料号" width="150" show-overflow-tooltip />
            <el-table-column prop="missingMaterialName" label="补价物料名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="priceType" label="价格类型" width="110" show-overflow-tooltip />
            <el-table-column prop="reason" label="缺价原因" min-width="220" show-overflow-tooltip />
            <template #empty>
              <el-empty description="暂无缺价清单" />
            </template>
          </el-table>

          <BasePagination
            v-model:current-page="gapCurrentPage"
            v-model:page-size="gapPageSize"
            :total="gapTotal"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="generateDialogVisible" :title="generateDialogTitle" width="560px">
      <el-form :model="generateForm" label-width="112px">
        <el-form-item v-if="generateMode === 'OA'" label="OA单号" required>
          <el-input v-model="generateForm.oaNo" clearable placeholder="OA-2026..." />
        </el-form-item>
        <el-form-item v-if="generateMode === 'MATERIAL'" label="制造件料号" required>
          <el-input v-model="generateForm.parentMaterialNo" clearable placeholder="多个料号用逗号或换行分隔" />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="generateForm.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="默认当前取价期间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="traceDrawerVisible" title="计算追溯" size="640px">
      <section v-if="traceRow" class="trace-panel">
        <div class="trace-head">
          <h2>{{ traceRow.parentMaterialNo || '-' }}</h2>
          <el-tag :type="statusTagType(traceRow.status)">{{ statusLabel(traceRow.status) }}</el-tag>
        </div>
        <div class="trace-grid">
          <div><span>批次</span><strong>{{ traceRow.calcBatchId || '-' }}</strong></div>
          <div><span>原材料价</span><strong>{{ formatMoney(traceRow.rawUnitPrice) }}</strong></div>
          <div><span>回收单价</span><strong>{{ formatMoney(traceRow.scrapUnitPrice) }}</strong></div>
          <div><span>本行成本</span><strong>{{ formatMoney(traceRow.costPrice) }}</strong></div>
          <div><span>零件价格</span><strong>{{ formatMoney(traceRow.parentTotalCostPrice) }}</strong></div>
          <div><span>创建时间</span><strong>{{ traceRow.createdAt || '-' }}</strong></div>
        </div>
        <!-- 重量字段由后端统一按 g 返回；涉及元/kg 的公式已在后端计算时转 kg。 -->
        <pre class="trace-text">{{ traceText }}</pre>
      </section>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  Download,
  Filter,
  Operation,
  RefreshLeft,
  RefreshRight,
  Search,
} from '@element-plus/icons-vue'
import BasePagination from '../../../components/BasePagination.vue'
import {
  MAKE_PART_PROCESS_TYPE_OPTIONS,
  MAKE_PART_STATUS_OPTIONS,
  exportMakePartPriceCalc,
  fetchLatestMakePartPriceCalcBatch,
  fetchMakePartPriceCalcDetail,
  fetchMakePartPriceCalcPage,
  fetchMakePartPriceCalcStatusSummary,
  fetchMakePartPriceGapPage,
  generateMakePartPriceCalc,
  normalizeMakePartCalcPage,
  normalizeMakePartGenerateResult,
} from '../../../api/makePartPriceCalc.js'

const filters = reactive({
  calcBatchId: '',
  pricingMonth: '',
  oaNo: '',
  businessUnitType: '',
  parentMaterialNo: '',
  childMaterialNo: '',
  scrapCode: '',
  itemProcessType: '',
  status: '',
  missingPriceRole: '',
  missingMaterialNo: '',
  onlyError: false,
})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const gapRows = ref([])
const gapTotal = ref(0)
const gapCurrentPage = ref(1)
const gapPageSize = ref(20)
const statusSummary = ref({})
const loading = ref(false)
const gapLoading = ref(false)
const generating = ref(false)
const exporting = ref(false)
const showAdvancedFilters = ref(false)
const activeTab = ref('calc')

const generateDialogVisible = ref(false)
const generateMode = ref('ALL')
const generateForm = reactive({
  oaNo: '',
  parentMaterialNo: '',
  period: '',
})

const traceDrawerVisible = ref(false)
const traceRow = ref(null)

const statusOptionMap = computed(() =>
  Object.fromEntries(MAKE_PART_STATUS_OPTIONS.map((item) => [item.value, item]))
)

const summaryCards = computed(() => {
  const summary = statusSummary.value || {}
  const known = MAKE_PART_STATUS_OPTIONS
    .filter((item) => Number(summary[item.value] || 0) > 0)
    .map((item) => ({ ...item, status: item.value, count: Number(summary[item.value] || 0) }))
  const unknown = Object.entries(summary)
    .filter(([status]) => !statusOptionMap.value[status])
    .map(([status, count]) => ({
      status,
      label: status || 'UNKNOWN',
      count: Number(count || 0),
      tag: 'info',
    }))
  return [...known, ...unknown]
})

const generateDialogTitle = computed(() => {
  if (generateMode.value === 'OA') return '按 OA 生成'
  if (generateMode.value === 'MATERIAL') return '按制造件料号生成'
  return '全量生成'
})

const currentMonthText = () => {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

const traceText = computed(() => {
  if (!traceRow.value) return ''
  return traceRow.value.remark || '暂无计算追溯'
})

const buildParams = () => ({
  ...filters,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const buildGapParams = () => ({
  ...filters,
  page: gapCurrentPage.value,
  pageSize: gapPageSize.value,
})

const buildSummaryParams = () => {
  const params = { ...filters }
  delete params.status
  delete params.onlyError
  delete params.missingPriceRole
  delete params.missingMaterialNo
  return params
}

const fetchRows = async () => {
  loading.value = true
  try {
    const page = normalizeMakePartCalcPage(await fetchMakePartPriceCalcPage(buildParams()))
    tableRows.value = page.list
    total.value = page.total
    statusSummary.value = await fetchMakePartPriceCalcStatusSummary(buildSummaryParams())
  } catch (error) {
    ElMessage.error(error?.message || '查询制造件价格生成结果失败')
  } finally {
    loading.value = false
  }
}

const fetchGapRows = async () => {
  gapLoading.value = true
  try {
    const page = normalizeMakePartCalcPage(await fetchMakePartPriceGapPage(buildGapParams()))
    gapRows.value = page.list
    gapTotal.value = page.total
  } catch (error) {
    ElMessage.error(error?.message || '查询制造件缺价清单失败')
  } finally {
    gapLoading.value = false
  }
}

const fetchActiveRows = async () => {
  if (activeTab.value === 'gap') {
    await fetchGapRows()
  } else {
    await fetchRows()
  }
}

const fetchAllRows = async () => {
  await Promise.all([fetchRows(), fetchGapRows()])
}

const loadLatestBatch = async () => {
  const latest = await fetchLatestMakePartPriceCalcBatch({
    oaNo: filters.oaNo,
    businessUnitType: filters.businessUnitType,
    parentMaterialNo: filters.parentMaterialNo,
  })
  if (latest) {
    filters.calcBatchId = latest
  }
}

const refreshLatest = async () => {
  try {
    await loadLatestBatch()
  } catch (error) {
    filters.calcBatchId = ''
  }
  await fetchAllRows()
}

const applyFilters = async () => {
  currentPage.value = 1
  gapCurrentPage.value = 1
  await fetchActiveRows()
}

const resetFilters = async () => {
  Object.assign(filters, {
    calcBatchId: '',
    pricingMonth: '',
    oaNo: '',
    businessUnitType: '',
    parentMaterialNo: '',
    childMaterialNo: '',
    scrapCode: '',
    itemProcessType: '',
    status: '',
    missingPriceRole: '',
    missingMaterialNo: '',
    onlyError: false,
  })
  currentPage.value = 1
  gapCurrentPage.value = 1
  await refreshLatest()
}

const handleOnlyErrorChange = () => {
  activeTab.value = 'calc'
  if (filters.onlyError) {
    filters.status = ''
  }
  applyFilters()
}

const filterStatus = (status) => {
  activeTab.value = 'calc'
  filters.onlyError = false
  filters.status = status
  applyFilters()
}

const openGenerateDialog = (mode) => {
  generateMode.value = mode
  Object.assign(generateForm, {
    oaNo: filters.oaNo,
    parentMaterialNo: filters.parentMaterialNo,
    period: currentMonthText(),
  })
  generateDialogVisible.value = true
}

const splitMaterialNos = (value) =>
  String(value || '')
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const submitGenerate = async () => {
  const body = {
    period: generateForm.period || currentMonthText(),
  }
  if (generateMode.value === 'OA') {
    if (!generateForm.oaNo) {
      ElMessage.warning('请输入 OA 单号')
      return
    }
    body.oaNo = generateForm.oaNo
  } else if (generateMode.value === 'MATERIAL') {
    const parentMaterialNos = splitMaterialNos(generateForm.parentMaterialNo)
    if (!parentMaterialNos.length) {
      ElMessage.warning('请输入制造件料号')
      return
    }
    body.parentMaterialNos = parentMaterialNos
  }

  generating.value = true
  try {
    const result = normalizeMakePartGenerateResult(await generateMakePartPriceCalc(body))
    if (result.calcBatchId) {
      filters.calcBatchId = result.calcBatchId
    }
    filters.oaNo = body.oaNo || filters.oaNo
    filters.parentMaterialNo = generateMode.value === 'MATERIAL' && body.parentMaterialNos?.length === 1
      ? body.parentMaterialNos[0]
      : filters.parentMaterialNo
    generateDialogVisible.value = false
    currentPage.value = 1
    const errorText = result.errorCount > 0 ? `，异常 ${result.errorCount} 条` : ''
    ElMessage.success(`生成完成：${result.rowCount} 行${errorText}`)
    await fetchAllRows()
  } catch (error) {
    ElMessage.error(error?.message || '生成制造件价格失败')
  } finally {
    generating.value = false
  }
}

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportRows = async () => {
  exporting.value = true
  try {
    const result = await exportMakePartPriceCalc({ ...filters })
    downloadBlob(result.blob, result.fileName)
    ElMessage.success('制造件价格生成已导出')
  } catch (error) {
    ElMessage.error(error?.message || '导出制造件价格生成失败')
  } finally {
    exporting.value = false
  }
}

const openTrace = async (row) => {
  traceDrawerVisible.value = true
  traceRow.value = row
  try {
    traceRow.value = await fetchMakePartPriceCalcDetail(row.id)
  } catch (error) {
    ElMessage.error(error?.message || '读取计算追溯失败')
  }
}

const statusLabel = (status) => statusOptionMap.value[status]?.label || status || 'UNKNOWN'
const statusTagType = (status) => statusOptionMap.value[status]?.tag || (status === 'OK' ? 'success' : 'warning')
const gapRoleLabel = (role) => {
  if (role === 'RAW') return '缺原材料价'
  if (role === 'SCRAP') return '缺废料价'
  return role || '-'
}
const gapRoleTagType = (role) => (role === 'RAW' ? 'danger' : 'warning')

const displayChildMaterial = (row) => row.childMaterialSpec || row.childMaterialName || '-'

const formatDateTime = (value) => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

const displayPricingMonth = (row) => row?.pricingMonth || currentMonthText()

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
}

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

const handleTabChange = async () => {
  await fetchActiveRows()
}

watch([currentPage, pageSize], fetchRows)
watch([gapCurrentPage, gapPageSize], fetchGapRows)

onMounted(refreshLatest)
</script>

<style scoped>
.make-calc-page {
  min-height: 100%;
  padding: 18px;
  background: #f5f7fb;
  color: #1f2937;
}

.page-toolbar,
.query-panel,
.table-panel,
.summary-strip {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

.page-title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0;
}

.page-title p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.toolbar-actions,
.query-actions :deep(.el-form-item__content) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.generate-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  line-height: 1;
  outline: none;
}

.summary-strip {
  display: grid;
  grid-template-columns: minmax(220px, 1.8fr) repeat(auto-fit, minmax(110px, 1fr));
  gap: 1px;
  margin-top: 12px;
  overflow: hidden;
}

.summary-item {
  min-width: 0;
  padding: 12px 14px;
  background: #fff;
}

.summary-item.clickable {
  cursor: pointer;
}

.summary-item.clickable:hover {
  background: #f8fafc;
}

.summary-item span {
  display: block;
  color: #6b7280;
  font-size: 12px;
}

.summary-item strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
}

.query-panel,
.table-panel {
  margin-top: 12px;
  padding: 16px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.query-form :deep(.el-form-item) {
  margin-right: 0;
  margin-bottom: 10px;
}

.query-form :deep(.el-input),
.query-form :deep(.el-select) {
  width: 190px;
}

.calc-table {
  width: 100%;
}

.trace-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.trace-head h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0;
}

.trace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.trace-grid div {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.trace-grid span {
  display: block;
  color: #6b7280;
  font-size: 12px;
}

.trace-grid strong {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
}

.trace-text {
  min-height: 220px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #111827;
  color: #f9fafb;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .make-calc-page {
    padding: 12px;
  }

  .page-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions .el-button {
    margin-left: 0;
  }

  .query-form,
  .query-form :deep(.el-form-item),
  .query-form :deep(.el-form-item__content),
  .query-form :deep(.el-input),
  .query-form :deep(.el-select) {
    width: 100%;
  }

  .trace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
