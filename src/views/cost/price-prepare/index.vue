<template>
  <div class="price-prepare-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>价格准备</h1>
        <p>成本核算前置准备</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="RefreshRight" :loading="loadingAny" @click="refreshAll">刷新</el-button>
        <el-button
          v-hasPermi="['cost:price-prepare:generate']"
          type="primary"
          :icon="Operation"
          :loading="generating"
          @click="openGenerateDialog"
        >
          生成
        </el-button>
      </div>
    </section>

    <section class="query-panel">
      <el-form :inline="true" class="query-form" label-width="82px">
        <el-form-item label="关键词">
          <el-input
            v-model="candidateFilters.keyword"
            clearable
            placeholder="OA / 成品 / 客户 / 产品"
            @keyup.enter="applyCandidateFilters"
          />
        </el-form-item>
        <el-form-item label="范围">
          <el-select v-model="candidateFilters.ownerScope" placeholder="范围">
            <el-option label="我的候选" value="MINE" />
            <el-option v-hasPermi="['cost:price-prepare:list-all']" label="全部候选" value="ALL" />
          </el-select>
        </el-form-item>
        <el-form-item label="核算状态">
          <el-input v-model="candidateFilters.calcStatus" clearable placeholder="默认未核算" />
        </el-form-item>
        <el-form-item label="准备状态">
          <el-select v-model="candidateFilters.prepareStatus" clearable placeholder="待处理">
            <el-option
              v-for="option in PRICE_PREPARE_SUMMARY_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="仅待处理">
          <el-switch v-model="candidateFilters.onlyPending" />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" :icon="Search" @click="applyCandidateFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetCandidateFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <div class="section-title">
        <strong>候选行</strong>
        <span>已选择 {{ selectedCandidates.length }} 行</span>
      </div>
      <el-table
        ref="candidateTableRef"
        :data="candidateRows"
        border
        stripe
        highlight-current-row
        v-loading="candidateLoading"
        row-key="candidateKey"
        class="prepare-table"
        @selection-change="handleCandidateSelection"
        @row-click="selectCandidate"
      >
        <el-table-column type="selection" width="48" reserve-selection />
        <el-table-column prop="oaNo" label="OA单号" width="160" fixed show-overflow-tooltip />
        <el-table-column prop="topProductCode" label="成品料号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="customer" label="客户" min-width="150" show-overflow-tooltip />
        <el-table-column prop="calcStatus" label="核算状态" width="105" />
        <el-table-column label="准备状态" width="115">
          <template #default="{ row }">
            <el-tag size="small" :type="summaryStatusTag(row.prepareStatus)">
              {{ summaryStatusLabel(row.prepareStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="明细" width="80" align="right" />
        <el-table-column prop="gapCount" label="缺口" width="80" align="right" />
        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="selectCandidate(row)">查看</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无价格准备候选" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="candidatePage"
        v-model:page-size="candidatePageSize"
        :total="candidateTotal"
      />
    </section>

    <section class="table-panel">
      <div class="section-title">
        <strong>明细 / 缺口</strong>
        <span>{{ detailScopeText }}</span>
      </div>
      <el-tabs v-model="activeTab" class="prepare-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="明细" name="items">
          <div class="tab-filter-row">
            <el-input v-model="itemFilters.materialCode" clearable placeholder="料号" />
            <el-select v-model="itemFilters.itemType" clearable placeholder="料号类型">
              <el-option
                v-for="option in PRICE_PREPARE_ITEM_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select v-model="itemFilters.status" clearable placeholder="明细状态">
              <el-option
                v-for="option in PRICE_PREPARE_ITEM_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button type="primary" :icon="Search" :disabled="!selectedCandidate" @click="applyItemFilters">查询</el-button>
            <el-button :icon="RefreshLeft" :disabled="!selectedCandidate" @click="resetItemFilters">重置</el-button>
          </div>

          <el-table :data="itemRows" border stripe v-loading="itemLoading" row-key="id" class="prepare-table">
            <el-table-column prop="oaNo" label="OA单号" width="150" fixed show-overflow-tooltip />
            <el-table-column prop="topProductCode" label="成品料号" width="145" show-overflow-tooltip />
            <el-table-column prop="materialCode" label="料号" width="150" show-overflow-tooltip />
            <el-table-column prop="materialName" label="名称" min-width="170" show-overflow-tooltip />
            <el-table-column label="类型" width="105">
              <template #default="{ row }">
                <el-tag size="small" :type="itemTypeTag(row.itemType)">{{ itemTypeLabel(row.itemType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="115">
              <template #default="{ row }">
                <el-tag size="small" :type="itemStatusTag(row.status)">{{ itemStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="用量" width="100" align="right">
              <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
            </el-table-column>
            <el-table-column prop="unitPrice" label="单价" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="120" align="right">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="priceSource" label="价格来源" width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ priceSourceLabel(row.priceSource) }}</template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="240" show-overflow-tooltip />
            <template #empty>
              <el-empty :description="selectedCandidate ? '暂无价格准备明细' : '请先选择候选行'" />
            </template>
          </el-table>
          <BasePagination v-model:current-page="itemPage" v-model:page-size="itemPageSize" :total="itemTotal" />
        </el-tab-pane>

        <el-tab-pane label="缺口" name="gaps">
          <div class="stage-notice">缺口已记录，OA 推送后续接入。当前清单用于补齐主档、结构和价格。</div>
          <div class="tab-filter-row">
            <el-input v-model="gapFilters.materialCode" clearable placeholder="父料号" />
            <el-input v-model="gapFilters.gapMaterialCode" clearable placeholder="缺口料号" />
            <el-select v-model="gapFilters.itemType" clearable placeholder="料号类型">
              <el-option
                v-for="option in PRICE_PREPARE_ITEM_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select v-model="gapFilters.gapType" clearable placeholder="缺口类型">
              <el-option
                v-for="option in PRICE_PREPARE_GAP_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button type="primary" :icon="Search" :disabled="!selectedCandidate" @click="applyGapFilters">查询</el-button>
            <el-button :icon="RefreshLeft" :disabled="!selectedCandidate" @click="resetGapFilters">重置</el-button>
          </div>

          <el-table :data="gapRows" border stripe v-loading="gapLoading" row-key="id" class="prepare-table">
            <el-table-column prop="oaNo" label="OA单号" width="150" fixed show-overflow-tooltip />
            <el-table-column prop="topProductCode" label="成品料号" width="145" show-overflow-tooltip />
            <el-table-column prop="materialCode" label="父料号" width="145" show-overflow-tooltip />
            <el-table-column prop="gapMaterialCode" label="缺口料号" width="145" show-overflow-tooltip />
            <el-table-column label="料号类型" width="105">
              <template #default="{ row }">
                <el-tag size="small" :type="itemTypeTag(row.itemType)">{{ itemTypeLabel(row.itemType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="缺口类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="gapTypeTag(row.gapType)">{{ gapTypeLabel(row.gapType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sourceTable" label="缺口来源" width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ sourceLabel(row.sourceTable) }}</template>
            </el-table-column>
            <el-table-column label="OA推送" width="170">
              <template #default="{ row }">
                <el-tag size="small" :type="pushStatusTag(row.oaPushStatus)">
                  {{ pushStatusLabel(row.oaPushStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
            <template #empty>
              <el-empty :description="selectedCandidate ? '暂无价格准备缺口' : '请先选择候选行'" />
            </template>
          </el-table>
          <BasePagination v-model:current-page="gapPage" v-model:page-size="gapPageSize" :total="gapTotal" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="generateDialogVisible" title="生成价格准备" width="760px">
      <el-form :model="generateForm" label-width="92px">
        <el-form-item label="候选行">
          <el-cascader
            v-model="generateForm.targetKeys"
            :options="candidateTreeOptions"
            :props="candidateCascaderProps"
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            :loading="dialogCandidatesLoading"
            placeholder="选择 OA + 成品料号"
            style="width: 100%"
            @visible-change="handleGenerateCascaderVisible"
          />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="generateForm.periodMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="默认当前期间"
            style="width: 100%"
          />
        </el-form-item>
        <el-collapse class="advanced-generate">
          <el-collapse-item title="高级：粘贴 OA 单号" name="paste">
            <el-form-item label="OA单号">
              <el-input
                v-model="generateForm.oaNosText"
                type="textarea"
                :rows="4"
                clearable
                placeholder="未选择候选行时，可粘贴多行 OA 单号"
              />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <el-table v-if="bulkResultRows.length" :data="bulkResultRows" border stripe size="small" class="bulk-result-table">
        <el-table-column prop="oaNo" label="OA单号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="topProductCode" label="成品料号" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.topProductCode || '-' }}</template>
        </el-table-column>
        <el-table-column prop="gapCount" label="缺口" width="80" align="right" />
        <el-table-column label="状态" width="105">
          <template #default="{ row }">
            <el-tag size="small" :type="summaryStatusTag(row.status)">{{ summaryStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="180" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="generateDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="generating" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Operation, RefreshLeft, RefreshRight, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../components/BasePagination.vue'
import {
  PRICE_PREPARE_GAP_PUSH_STATUS_OPTIONS,
  PRICE_PREPARE_GAP_TYPE_OPTIONS,
  PRICE_PREPARE_ITEM_STATUS_OPTIONS,
  PRICE_PREPARE_ITEM_TYPE_OPTIONS,
  PRICE_PREPARE_SUMMARY_STATUS_OPTIONS,
  fetchPricePrepareCandidates,
  fetchPricePrepareGaps,
  fetchPricePrepareItems,
  generatePricePrepareBulk,
  normalizePricePreparePage,
} from '../../../api/pricePrepare.js'

const activeTab = ref('items')
const candidateTableRef = ref(null)
const candidateRows = ref([])
const dialogCandidateRows = ref([])
const selectedCandidates = ref([])
const selectedCandidate = ref(null)
const itemRows = ref([])
const gapRows = ref([])
const bulkResultRows = ref([])

const candidateTotal = ref(0)
const itemTotal = ref(0)
const gapTotal = ref(0)
const candidatePage = ref(1)
const itemPage = ref(1)
const gapPage = ref(1)
const candidatePageSize = ref(10)
const itemPageSize = ref(20)
const gapPageSize = ref(20)

const candidateLoading = ref(false)
const dialogCandidatesLoading = ref(false)
const itemLoading = ref(false)
const gapLoading = ref(false)
const generating = ref(false)
const generateDialogVisible = ref(false)

const candidateFilters = reactive({
  keyword: '',
  ownerScope: 'MINE',
  calcStatus: '未核算',
  prepareStatus: '',
  onlyPending: true,
})
const itemFilters = reactive({ materialCode: '', itemType: '', status: '' })
const gapFilters = reactive({ materialCode: '', gapMaterialCode: '', itemType: '', gapType: '' })
const generateForm = reactive({ targetKeys: [], oaNosText: '', periodMonth: '' })

const loadingAny = computed(() => candidateLoading.value || itemLoading.value || gapLoading.value)
const detailScopeText = computed(() => {
  if (!selectedCandidate.value) return '未选择候选行'
  return `${selectedCandidate.value.oaNo} / ${selectedCandidate.value.topProductCode}`
})

const optionMap = (options) => computed(() => Object.fromEntries(options.map((item) => [item.value, item])))
const itemTypeMap = optionMap(PRICE_PREPARE_ITEM_TYPE_OPTIONS)
const itemStatusMap = optionMap(PRICE_PREPARE_ITEM_STATUS_OPTIONS)
const gapTypeMap = optionMap(PRICE_PREPARE_GAP_TYPE_OPTIONS)
const pushStatusMap = optionMap(PRICE_PREPARE_GAP_PUSH_STATUS_OPTIONS)
const summaryStatusMap = optionMap(PRICE_PREPARE_SUMMARY_STATUS_OPTIONS)

const selectedTargetKeySet = computed(() => new Set(generateForm.targetKeys))
const candidateCascaderProps = {
  multiple: true,
  emitPath: false,
}
const candidatePoolRows = computed(() => {
  const byKey = new Map()
  for (const row of [...selectedCandidates.value, ...candidateRows.value, ...dialogCandidateRows.value]) {
    if (row?.oaNo && row?.topProductCode) {
      byKey.set(candidateKey(row), enrichCandidate(row))
    }
  }
  return Array.from(byKey.values())
})
const candidateTreeOptions = computed(() => {
  const byOa = new Map()
  for (const row of candidatePoolRows.value) {
    const oaNo = row.oaNo
    if (!byOa.has(oaNo)) {
      byOa.set(oaNo, {
        value: oaNo,
        label: `${oaNo} / ${row.customer || '-'}`,
        children: [],
      })
    }
    byOa.get(oaNo).children.push({
      value: candidateKey(row),
      label: `${row.topProductCode} / ${row.productName || '-'} / ${summaryStatusLabel(row.prepareStatus)}`,
    })
  }
  return Array.from(byOa.values())
})
const candidateOptions = computed(() => {
  const selected = selectedCandidates.value.map(toCandidateOption)
  const all = candidatePoolRows.value.map(toCandidateOption)
  const byKey = new Map()
  for (const option of [...selected, ...all]) {
    if (option?.key) byKey.set(option.key, option)
  }
  return Array.from(byKey.values())
})

const currentMonthText = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const candidateKey = (row) => `${row?.oaNo || ''}__${row?.topProductCode || ''}`
const enrichCandidate = (row) => ({ ...row, candidateKey: candidateKey(row) })
const toTarget = (row) => ({ oaNo: row.oaNo, topProductCode: row.topProductCode })
const toCandidateOption = (row) => ({
  key: candidateKey(row),
  label: `${row.oaNo} / ${row.topProductCode} / ${row.customer || '-'} / ${summaryStatusLabel(row.prepareStatus)}`,
})

const labelFrom = (map, value) => map.value[value]?.label || value || '-'
const tagFrom = (map, value, fallback = 'info') => map.value[value]?.tag || fallback
const itemTypeLabel = (type) => labelFrom(itemTypeMap, type)
const itemTypeTag = (type) => tagFrom(itemTypeMap, type, 'info')
const itemStatusLabel = (status) => labelFrom(itemStatusMap, status)
const itemStatusTag = (status) => tagFrom(itemStatusMap, status, 'info')
const gapTypeLabel = (type) => labelFrom(gapTypeMap, type)
const gapTypeTag = (type) => tagFrom(gapTypeMap, type, 'warning')
const pushStatusLabel = (status) => labelFrom(pushStatusMap, status || 'PENDING')
const pushStatusTag = (status) => tagFrom(pushStatusMap, status || 'PENDING', 'info')
const summaryStatusLabel = (status) => labelFrom(summaryStatusMap, normalizeSummaryStatus(status))
const summaryStatusTag = (status) => tagFrom(summaryStatusMap, normalizeSummaryStatus(status), 'info')

const normalizeSummaryStatus = (status) => {
  if (status === 'SUCCESS') return 'READY'
  return status || 'NOT_PREPARED'
}

const sourceLabel = (value) => {
  const map = {
    lp_bom_costing_row: 'BOM结算明细',
    lp_bom_u9_source: 'U9 BOM结构',
    'lp_material_master_raw/lp_material_master': '料品主档',
    lp_material_scrap_ref: '材料废料映射',
    lp_make_part_price_gap_item: '自制件价格缺口',
    lp_package_component_price_detail: '包装组件价格明细',
    PackageComponentSnapshotService: '包装组件结构',
    PackageComponentPricePrepareStrategy: '包装组件价格准备',
    MakePartPricePrepareStrategy: '自制件价格准备',
    MakePartWeightService: '自制件重量',
    PriceResolver: '普通料号取价',
  }
  return map[value] || value || '-'
}

const priceSourceLabel = (value) => {
  if (!value) return '-'
  if (value === 'FIXED_PRICE') return '固定采购价'
  if (value === 'MAKE_PART_PRICE') return '自制件价格'
  if (value === 'PACKAGE_PRICE') return '包装组件价格'
  return value
}

const formatDateTime = (value) => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

const buildCandidateParams = () => ({
  ...candidateFilters,
  page: candidatePage.value,
  pageSize: candidatePageSize.value,
})

const fetchCandidates = async () => {
  candidateLoading.value = true
  try {
    const page = normalizePricePreparePage(await fetchPricePrepareCandidates(buildCandidateParams()))
    candidateRows.value = page.list.map(enrichCandidate)
    candidateTotal.value = page.total
    if (selectedCandidate.value) {
      selectedCandidate.value =
        candidateRows.value.find((row) => row.candidateKey === selectedCandidate.value.candidateKey) || selectedCandidate.value
    }
  } catch (error) {
    ElMessage.error(error?.message || '查询价格准备候选失败')
  } finally {
    candidateLoading.value = false
  }
}

const fetchGenerateCandidates = async () => {
  dialogCandidatesLoading.value = true
  try {
    const baseParams = {
      keyword: candidateFilters.keyword,
      calcStatus: candidateFilters.calcStatus,
      prepareStatus: candidateFilters.prepareStatus,
      onlyPending: candidateFilters.onlyPending,
      page: 1,
      pageSize: 500,
    }
    const preferredScope = candidateFilters.ownerScope || 'MINE'
    let page = normalizePricePreparePage(await fetchPricePrepareCandidates({
      ...baseParams,
      ownerScope: preferredScope,
    }))
    if (!page.list.length && preferredScope !== 'ALL') {
      try {
        page = normalizePricePreparePage(await fetchPricePrepareCandidates({
          ...baseParams,
          ownerScope: 'ALL',
        }))
      } catch (error) {
        // 无 list-all 权限时保持我的候选结果，不打断弹窗操作。
      }
    }
    dialogCandidateRows.value = page.list.map(enrichCandidate)
  } catch (error) {
    ElMessage.error(error?.message || '查询生成候选失败')
  } finally {
    dialogCandidatesLoading.value = false
  }
}

const buildItemParams = () => ({
  ...itemFilters,
  oaNo: selectedCandidate.value?.oaNo,
  topProductCode: selectedCandidate.value?.topProductCode,
  page: itemPage.value,
  pageSize: itemPageSize.value,
})

const buildGapParams = () => ({
  ...gapFilters,
  oaNo: selectedCandidate.value?.oaNo,
  topProductCode: selectedCandidate.value?.topProductCode,
  page: gapPage.value,
  pageSize: gapPageSize.value,
})

const fetchItems = async () => {
  if (!selectedCandidate.value) {
    itemRows.value = []
    itemTotal.value = 0
    return
  }
  itemLoading.value = true
  try {
    const page = normalizePricePreparePage(await fetchPricePrepareItems(buildItemParams()))
    itemRows.value = page.list
    itemTotal.value = page.total
  } catch (error) {
    ElMessage.error(error?.message || '查询价格准备明细失败')
  } finally {
    itemLoading.value = false
  }
}

const fetchGaps = async () => {
  if (!selectedCandidate.value) {
    gapRows.value = []
    gapTotal.value = 0
    return
  }
  gapLoading.value = true
  try {
    const page = normalizePricePreparePage(await fetchPricePrepareGaps(buildGapParams()))
    gapRows.value = page.list
    gapTotal.value = page.total
  } catch (error) {
    ElMessage.error(error?.message || '查询价格准备缺口失败')
  } finally {
    gapLoading.value = false
  }
}

const fetchActiveRows = async () => {
  if (activeTab.value === 'gaps') {
    await fetchGaps()
  } else {
    await fetchItems()
  }
}

const refreshAll = async () => {
  await fetchCandidates()
  await Promise.all([fetchItems(), fetchGaps()])
}

const handleCandidateSelection = (rows) => {
  selectedCandidates.value = rows
}

const selectCandidate = async (row) => {
  selectedCandidate.value = row
  itemPage.value = 1
  gapPage.value = 1
  await Promise.all([fetchItems(), fetchGaps()])
}

const applyCandidateFilters = async () => {
  candidatePage.value = 1
  selectedCandidate.value = null
  selectedCandidates.value = []
  itemRows.value = []
  gapRows.value = []
  candidateTableRef.value?.clearSelection?.()
  await fetchCandidates()
}

const resetCandidateFilters = async () => {
  Object.assign(candidateFilters, {
    keyword: '',
    ownerScope: 'MINE',
    calcStatus: '未核算',
    prepareStatus: '',
    onlyPending: true,
  })
  await applyCandidateFilters()
}

const applyItemFilters = async () => {
  itemPage.value = 1
  await fetchItems()
}

const resetItemFilters = async () => {
  Object.assign(itemFilters, { materialCode: '', itemType: '', status: '' })
  await applyItemFilters()
}

const applyGapFilters = async () => {
  gapPage.value = 1
  await fetchGaps()
}

const resetGapFilters = async () => {
  Object.assign(gapFilters, { materialCode: '', gapMaterialCode: '', itemType: '', gapType: '' })
  await applyGapFilters()
}

const handleTabChange = () => {
  fetchActiveRows()
}

const openGenerateDialog = async () => {
  const initialTargets = selectedCandidates.value.length
    ? selectedCandidates.value
    : (selectedCandidate.value ? [selectedCandidate.value] : [])
  Object.assign(generateForm, {
    targetKeys: initialTargets.map(candidateKey),
    oaNosText: '',
    periodMonth: currentMonthText(),
  })
  bulkResultRows.value = []
  generateDialogVisible.value = true
  await fetchGenerateCandidates()
}

const handleGenerateCascaderVisible = (visible) => {
  if (visible && !dialogCandidateRows.value.length && !dialogCandidatesLoading.value) {
    fetchGenerateCandidates()
  }
}

const parseOaNos = (text) => Array.from(new Set(
  String(text || '')
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
))

const selectedTargets = () => {
  const byKey = new Map(candidateOptions.value.map((option) => [option.key, option]))
  const rowsByKey = new Map(candidatePoolRows.value.map((row) => [candidateKey(row), row]))
  return Array.from(selectedTargetKeySet.value)
    .filter((key) => byKey.has(key))
    .map((key) => rowsByKey.get(key))
    .filter((row) => row?.oaNo && row?.topProductCode)
    .map(toTarget)
}

const submitGenerate = async () => {
  const targets = selectedTargets()
  const oaNos = parseOaNos(generateForm.oaNosText)
  if (!targets.length && !oaNos.length) {
    ElMessage.warning('请选择候选行或输入 OA 单号')
    return
  }
  generating.value = true
  try {
    const result = await generatePricePrepareBulk({
      targets: targets.length ? targets : undefined,
      oaNos: targets.length ? undefined : oaNos,
      periodMonth: generateForm.periodMonth || currentMonthText(),
    })
    bulkResultRows.value = Array.isArray(result?.records) ? result.records : []
    ElMessage.success(`生成完成：成功 ${result?.successCount || 0} 个，失败 ${result?.failedCount || 0} 个`)
    await refreshAll()
  } catch (error) {
    ElMessage.error(error?.message || '生成价格准备失败')
  } finally {
    generating.value = false
  }
}

watch([candidatePage, candidatePageSize], fetchCandidates)
watch([itemPage, itemPageSize], fetchItems)
watch([gapPage, gapPageSize], fetchGaps)

onMounted(fetchCandidates)
</script>

<style scoped>
.price-prepare-page {
  min-height: 100%;
  padding: 18px;
  background: #f5f7fb;
  color: #1f2937;
}

.page-toolbar,
.query-panel,
.table-panel {
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
.tab-filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.query-panel {
  margin-top: 14px;
  padding: 14px 16px 2px;
}

.query-form :deep(.el-form-item) {
  margin-right: 18px;
  margin-bottom: 12px;
}

.query-form :deep(.el-input),
.query-form :deep(.el-select),
.query-form :deep(.el-date-editor) {
  width: 188px;
}

.query-actions :deep(.el-form-item__content) {
  gap: 8px;
}

.table-panel {
  margin-top: 14px;
  padding: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #374151;
}

.section-title strong {
  color: #111827;
  font-size: 15px;
}

.section-title span {
  min-width: 0;
  color: #6b7280;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prepare-tabs :deep(.el-tabs__header) {
  margin: 0 0 10px;
}

.prepare-table,
.bulk-result-table {
  width: 100%;
}

.tab-filter-row {
  margin-bottom: 10px;
}

.tab-filter-row :deep(.el-input),
.tab-filter-row :deep(.el-select) {
  width: 176px;
}

.stage-notice {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  font-size: 13px;
}

.advanced-generate {
  border-top: 0;
  border-bottom: 0;
}

.bulk-result-table {
  margin-top: 12px;
}

@media (max-width: 900px) {
  .price-prepare-page {
    padding: 12px;
  }

  .page-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
