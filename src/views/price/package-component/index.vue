<template>
  <div class="package-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>包装组件价格</h1>
        <p>价格源管理</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="RefreshRight" :loading="activeLoading" @click="refreshActive">刷新</el-button>
        <el-button
          v-hasPermi="['price:package-component:generate']"
          type="primary"
          :icon="Operation"
          :loading="generating"
          @click="openGenerateDialog()"
        >
          生成
        </el-button>
      </div>
    </section>

    <section class="query-panel">
      <el-form :model="activeFilters" class="query-form" :inline="true" label-width="96px">
        <el-form-item label="期间">
          <el-date-picker
            v-model="activeFilters.periodMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            clearable
            placeholder="全部月份"
          />
        </el-form-item>
        <el-form-item label="包装父料号">
          <el-input v-model="activeFilters.packageMaterialCode" clearable placeholder="9830000026238" />
        </el-form-item>
        <el-form-item v-if="activeTab === 'prices'" label="顶层产品">
          <el-input v-model="priceFilters.topProductCode" clearable placeholder="参考/顶层料号" />
        </el-form-item>
        <el-form-item v-if="activeTab === 'prices'" label="取价状态">
          <el-select v-model="priceFilters.priceStatus" clearable placeholder="全部">
            <el-option
              v-for="option in PACKAGE_PRICE_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="activeTab === 'snapshots'" label="结构状态">
          <el-select v-model="snapshotFilters.status" clearable placeholder="全部">
            <el-option
              v-for="option in PACKAGE_SNAPSHOT_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="activeTab === 'gaps' && canViewGaps" label="异常类型">
          <el-select v-model="gapFilters.gapType" clearable placeholder="全部">
            <el-option
              v-for="option in PACKAGE_GAP_TYPE_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="activeTab === 'gaps' && canViewGaps" label="OA状态">
          <el-select v-model="gapFilters.oaPushStatus" clearable placeholder="全部">
            <el-option
              v-for="option in PACKAGE_OA_PUSH_STATUS_OPTIONS"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel">
      <el-tabs v-model="activeTab" class="package-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="生成结果" name="prices">
          <el-table
            :data="priceRows"
            border
            stripe
            v-loading="priceLoading"
            row-key="id"
            class="package-table"
          >
            <el-table-column prop="periodMonth" label="期间" width="105" fixed />
            <el-table-column prop="packageMaterialCode" label="包装父料号" width="160" fixed show-overflow-tooltip />
            <el-table-column prop="packageMaterialName" label="包装名称" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ row.packageMaterialName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="sourceTopProductCode" label="来源顶层产品" width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sourceTopProductCode || '-' }}</template>
            </el-table-column>
            <el-table-column prop="totalPrice" label="包装组件单价" width="135" align="right">
              <template #default="{ row }">{{ formatMoney(row.totalPrice) }}</template>
            </el-table-column>
            <el-table-column prop="packageQtyPerParent" label="包装用量" width="110" align="right">
              <template #default="{ row }">{{ formatNumber(row.packageQtyPerParent) }}</template>
            </el-table-column>
            <el-table-column prop="packageParentBaseQty" label="母件底数" width="110" align="right">
              <template #default="{ row }">{{ formatNumber(row.packageParentBaseQty) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="130">
              <template #default="{ row }">
                <el-tag size="small" :type="priceStatusTag(row.priceStatus)">
                  {{ priceStatusLabel(row.priceStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="子件行数" width="105" align="right">
              <template #default="{ row }">{{ detailStats(row).childCount }}</template>
            </el-table-column>
            <el-table-column label="缺价行数" width="105" align="right">
              <template #default="{ row }">
                <span :class="{ danger: detailStats(row).missingCount > 0 }">
                  {{ detailStats(row).missingCount }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="generatedAt" label="生成时间" width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ formatDateTime(row.generatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button v-if="canViewDetail" type="primary" link @click="openPriceDetail(row)">查看明细</el-button>
                <el-button
                  v-hasPermi="['price:package-component:generate']"
                  type="primary"
                  link
                  :loading="regeneratingId === row.id"
                  @click="regenerate(row)"
                >
                  重新取价
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无包装组件价格" />
            </template>
          </el-table>
          <BasePagination
            v-model:current-page="pricePage"
            v-model:page-size="pricePageSize"
            :total="priceTotal"
          />
        </el-tab-pane>

        <el-tab-pane label="结构快照" name="snapshots">
          <el-table
            :data="snapshotRows"
            border
            stripe
            v-loading="snapshotLoading"
            row-key="id"
            class="package-table"
          >
            <el-table-column prop="periodMonth" label="期间" width="105" fixed />
            <el-table-column prop="packageMaterialCode" label="包装父料号" width="160" fixed show-overflow-tooltip />
            <el-table-column prop="sourceType" label="来源类型" width="110">
              <template #default="{ row }">{{ row.sourceType || row.sourceBomSourceType || '-' }}</template>
            </el-table-column>
            <el-table-column prop="sourceTopProductCode" label="来源顶层产品" width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sourceTopProductCode || '-' }}</template>
            </el-table-column>
            <el-table-column prop="lockedAt" label="锁定时间" width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ formatDateTime(row.lockedAt) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="snapshotStatusTag(row.status)">
                  {{ snapshotStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="missingReason" label="备注" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ row.missingReason || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button v-if="canViewDetail" type="primary" link @click="openSnapshotDetail(row)">查看子件</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无结构快照" />
            </template>
          </el-table>
          <BasePagination
            v-model:current-page="snapshotPage"
            v-model:page-size="snapshotPageSize"
            :total="snapshotTotal"
          />
        </el-tab-pane>

        <el-tab-pane v-if="canViewGaps" label="缺结构/缺价清单" name="gaps">
          <el-table
            :data="gapRows"
            border
            stripe
            v-loading="gapLoading"
            row-key="id"
            class="package-table"
          >
            <el-table-column label="异常类型" width="125" fixed>
              <template #default="{ row }">
                <el-tag size="small" :type="gapTypeTag(row.gapType)">
                  {{ gapTypeLabel(row.gapType) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="periodMonth" label="期间" width="105" />
            <el-table-column prop="packageMaterialCode" label="包装父料号" width="160" show-overflow-tooltip />
            <el-table-column prop="childMaterialCode" label="子件料号" width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.childMaterialCode || '-' }}</template>
            </el-table-column>
            <el-table-column prop="priceType" label="价格类型" width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.priceType || '-' }}</template>
            </el-table-column>
            <el-table-column prop="missingReason" label="缺失原因" min-width="220" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="130">
              <template #default="{ row }">{{ row.status || '-' }}</template>
            </el-table-column>
            <el-table-column label="OA推送状态" width="125">
              <template #default="{ row }">
                <el-tag size="small" :type="oaPushStatusTag(row.oaPushStatus)">
                  {{ oaPushStatusLabel(row.oaPushStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无缺结构/缺价清单" />
            </template>
          </el-table>
          <BasePagination
            v-model:current-page="gapPage"
            v-model:page-size="gapPageSize"
            :total="gapTotal"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="generateDialogVisible" title="生成包装组件价格" width="640px">
      <el-form :model="generateForm" label-width="116px">
        <el-form-item label="OA单号" required>
          <el-input v-model="generateForm.oaNo" clearable placeholder="输入 OA 单号" />
        </el-form-item>
        <el-form-item label="成品料号">
          <el-input v-model="generateForm.topProductCode" clearable placeholder="不填则生成整张 OA 下全部产品" />
        </el-form-item>
        <el-form-item label="期间">
          <el-date-picker
            v-model="generateForm.periodMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="默认当前月份"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="来源类型">
          <el-input v-model="generateForm.sourceType" clearable placeholder="U9" />
        </el-form-item>
        <el-form-item label="取价日期">
          <el-date-picker
            v-model="generateForm.asOfDate"
            type="date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
            placeholder="默认今天"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <el-table v-if="bulkResultRows.length" :data="bulkResultRows" border stripe size="small" class="bulk-result-table">
        <el-table-column prop="oaNo" label="OA单号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="topProductCode" label="成品料号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="packageMaterialCode" label="包装父料号" min-width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="priceStatusTag(row.status)">
              {{ priceStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="180" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="priceDetailVisible" title="包装组件价格明细" size="820px">
      <section v-if="priceDetail.price" class="detail-head">
        <div>
          <span>包装父料号</span>
          <strong>{{ priceDetail.price.packageMaterialCode }}</strong>
        </div>
        <div>
          <span>期间</span>
          <strong>{{ priceDetail.price.periodMonth }}</strong>
        </div>
        <div>
          <span>单价</span>
          <strong>{{ formatMoney(priceDetail.price.totalPrice) }}</strong>
        </div>
        <div>
          <span>母件底数</span>
          <strong>{{ formatNumber(priceDetail.price.packageParentBaseQty) }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ priceStatusLabel(priceDetail.price.priceStatus) }}</strong>
        </div>
      </section>
      <el-table :data="priceDetail.details" border stripe v-loading="detailLoading" class="drawer-table">
        <el-table-column prop="lineNo" label="行号" width="76" />
        <el-table-column prop="childMaterialCode" label="子件料号" width="150" show-overflow-tooltip />
        <el-table-column prop="childMaterialName" label="子件名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="qtyPerParent" label="用量" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.qtyPerParent) }}</template>
        </el-table-column>
        <el-table-column prop="childParentBaseQty" label="母件底数" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.childParentBaseQty) }}</template>
        </el-table-column>
        <el-table-column prop="priceType" label="价格类型" width="120" show-overflow-tooltip />
        <el-table-column prop="childUnitPrice" label="子件单价" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.childUnitPrice) }}</template>
        </el-table-column>
        <el-table-column prop="childAmount" label="金额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.childAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="detailPriceStatusTag(row.priceStatus)">
              {{ detailPriceStatusLabel(row.priceStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="missingReason" label="缺失原因" min-width="190" show-overflow-tooltip />
      </el-table>
    </el-drawer>

    <el-drawer v-model="snapshotDetailVisible" title="包装组件结构子件" size="760px">
      <section v-if="snapshotDetail.snapshot" class="detail-head">
        <div>
          <span>包装父料号</span>
          <strong>{{ snapshotDetail.snapshot.packageMaterialCode }}</strong>
        </div>
        <div>
          <span>期间</span>
          <strong>{{ snapshotDetail.snapshot.periodMonth }}</strong>
        </div>
        <div>
          <span>来源顶层产品</span>
          <strong>{{ snapshotDetail.snapshot.sourceTopProductCode || '-' }}</strong>
        </div>
        <div>
          <span>包装用量</span>
          <strong>{{ formatNumber(snapshotDetail.snapshot.packageQtyPerParent) }}</strong>
        </div>
        <div>
          <span>母件底数</span>
          <strong>{{ formatNumber(snapshotDetail.snapshot.packageParentBaseQty) }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ snapshotStatusLabel(snapshotDetail.snapshot.status) }}</strong>
        </div>
      </section>
      <el-table :data="snapshotDetail.details" border stripe v-loading="detailLoading" class="drawer-table">
        <el-table-column prop="lineNo" label="行号" width="76" />
        <el-table-column prop="childMaterialCode" label="子件料号" width="150" show-overflow-tooltip />
        <el-table-column prop="childMaterialName" label="子件名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="childMaterialSpec" label="规格" min-width="160" show-overflow-tooltip />
        <el-table-column prop="childShapeAttr" label="形态属性" width="110" />
        <el-table-column prop="qtyPerParent" label="用量" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.qtyPerParent) }}</template>
        </el-table-column>
        <el-table-column prop="childParentBaseQty" label="母件底数" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.childParentBaseQty) }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Operation, RefreshLeft, RefreshRight, Search } from '@element-plus/icons-vue'
import BasePagination from '../../../components/BasePagination.vue'
import { useUserStore } from '../../../store/modules/user.js'
import {
  PACKAGE_GAP_TYPE_OPTIONS,
  PACKAGE_OA_PUSH_STATUS_OPTIONS,
  PACKAGE_PRICE_STATUS_OPTIONS,
  PACKAGE_SNAPSHOT_STATUS_OPTIONS,
  fetchPackageComponentGaps,
  fetchPackageComponentPriceDetails,
  fetchPackageComponentPrices,
  fetchPackageComponentSnapshotDetails,
  fetchPackageComponentSnapshots,
  generatePackageComponentPrice,
  generatePackageComponentPriceByOa,
  normalizePackagePage,
} from '../../../api/packageComponentPrice.js'

const activeTab = ref('prices')
const userStore = useUserStore()
const ALL_PERMISSION = '*:*:*'
const DEFAULT_BOM_PURPOSE = '主制造'
const hasPermission = (permission) => {
  const permissions = userStore.permissions || []
  return permissions.includes(ALL_PERMISSION) || permissions.includes(permission)
}
const canViewDetail = computed(() => hasPermission('price:package-component:detail'))
const canViewGaps = computed(() => hasPermission('price:package-component:gaps'))

const priceFilters = reactive({
  periodMonth: '',
  packageMaterialCode: '',
  topProductCode: '',
  priceStatus: '',
})
const snapshotFilters = reactive({
  periodMonth: '',
  packageMaterialCode: '',
  status: '',
})
const gapFilters = reactive({
  periodMonth: '',
  packageMaterialCode: '',
  gapType: '',
  oaPushStatus: '',
})

const priceRows = ref([])
const priceTotal = ref(0)
const pricePage = ref(1)
const pricePageSize = ref(20)
const priceLoading = ref(false)

const snapshotRows = ref([])
const snapshotTotal = ref(0)
const snapshotPage = ref(1)
const snapshotPageSize = ref(20)
const snapshotLoading = ref(false)

const gapRows = ref([])
const gapTotal = ref(0)
const gapPage = ref(1)
const gapPageSize = ref(20)
const gapLoading = ref(false)

const detailCache = ref({})
const detailLoading = ref(false)
const priceDetailVisible = ref(false)
const snapshotDetailVisible = ref(false)
const priceDetail = reactive({ price: null, details: [] })
const snapshotDetail = reactive({ snapshot: null, details: [] })

const generateDialogVisible = ref(false)
const generating = ref(false)
const regeneratingId = ref(null)
const bulkResultRows = ref([])
const generateForm = reactive({
  periodMonth: '',
  oaNo: '',
  topProductCode: '',
  bomPurpose: '',
  sourceType: 'U9',
  asOfDate: '',
})

const optionMap = (options) => Object.fromEntries(options.map((item) => [item.value, item]))
const priceStatusMap = computed(() => optionMap(PACKAGE_PRICE_STATUS_OPTIONS))
const snapshotStatusMap = computed(() => optionMap(PACKAGE_SNAPSHOT_STATUS_OPTIONS))
const gapTypeMap = computed(() => optionMap(PACKAGE_GAP_TYPE_OPTIONS))
const oaPushStatusMap = computed(() => optionMap(PACKAGE_OA_PUSH_STATUS_OPTIONS))

const activeFilters = computed(() => {
  if (activeTab.value === 'snapshots') return snapshotFilters
  if (activeTab.value === 'gaps') return gapFilters
  return priceFilters
})

const activeLoading = computed(() => {
  if (activeTab.value === 'snapshots') return snapshotLoading.value
  if (activeTab.value === 'gaps') return gapLoading.value
  return priceLoading.value
})

const currentMonthText = () => {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

const buildPriceParams = () => ({
  ...priceFilters,
  page: pricePage.value,
  pageSize: pricePageSize.value,
})

const buildSnapshotParams = () => ({
  ...snapshotFilters,
  page: snapshotPage.value,
  pageSize: snapshotPageSize.value,
})

const buildGapParams = () => ({
  ...gapFilters,
  page: gapPage.value,
  pageSize: gapPageSize.value,
})

const fetchPriceRows = async () => {
  priceLoading.value = true
  try {
    const page = normalizePackagePage(await fetchPackageComponentPrices(buildPriceParams()))
    priceRows.value = page.list
    priceTotal.value = page.total
    await loadVisiblePriceStats(page.list)
  } catch (error) {
    ElMessage.error(error?.message || '查询包装组件价格失败')
  } finally {
    priceLoading.value = false
  }
}

const fetchSnapshotRows = async () => {
  snapshotLoading.value = true
  try {
    const page = normalizePackagePage(await fetchPackageComponentSnapshots(buildSnapshotParams()))
    snapshotRows.value = page.list
    snapshotTotal.value = page.total
  } catch (error) {
    ElMessage.error(error?.message || '查询结构快照失败')
  } finally {
    snapshotLoading.value = false
  }
}

const fetchGapRows = async () => {
  if (!canViewGaps.value) return
  gapLoading.value = true
  try {
    const page = normalizePackagePage(await fetchPackageComponentGaps(buildGapParams()))
    gapRows.value = page.list
    gapTotal.value = page.total
  } catch (error) {
    ElMessage.error(error?.message || '查询缺结构/缺价清单失败')
  } finally {
    gapLoading.value = false
  }
}

const fetchActiveRows = async () => {
  if (activeTab.value === 'snapshots') return fetchSnapshotRows()
  if (activeTab.value === 'gaps' && canViewGaps.value) return fetchGapRows()
  return fetchPriceRows()
}

const refreshActive = async () => {
  await fetchActiveRows()
}

const applyFilters = async () => {
  if (activeTab.value === 'snapshots') snapshotPage.value = 1
  else if (activeTab.value === 'gaps') gapPage.value = 1
  else pricePage.value = 1
  await fetchActiveRows()
}

const resetFilters = async () => {
  if (activeTab.value === 'snapshots') {
    Object.assign(snapshotFilters, { periodMonth: '', packageMaterialCode: '', status: '' })
    snapshotPage.value = 1
  } else if (activeTab.value === 'gaps') {
    Object.assign(gapFilters, { periodMonth: '', packageMaterialCode: '', gapType: '', oaPushStatus: '' })
    gapPage.value = 1
  } else {
    Object.assign(priceFilters, { periodMonth: '', packageMaterialCode: '', topProductCode: '', priceStatus: '' })
    pricePage.value = 1
  }
  await fetchActiveRows()
}

const handleTabChange = async () => {
  await fetchActiveRows()
}

const loadVisiblePriceStats = async (rows) => {
  if (!canViewDetail.value) return
  const missingRows = rows.filter((row) => row?.id && !detailCache.value[row.id])
  if (!missingRows.length) return
  const results = await Promise.allSettled(
    missingRows.map((row) => fetchPackageComponentPriceDetails(row.id))
  )
  results.forEach((result, index) => {
    const row = missingRows[index]
    if (result.status === 'fulfilled') {
      const details = Array.isArray(result.value?.details) ? result.value.details : []
      detailCache.value[row.id] = {
        price: result.value?.price || row,
        details,
        stats: buildDetailStats(details),
      }
    } else {
      detailCache.value[row.id] = {
        price: row,
        details: [],
        stats: { childCount: '-', missingCount: '-' },
      }
    }
  })
}

const buildDetailStats = (details) => ({
  childCount: details.length,
  missingCount: details.filter((item) => item.priceStatus && item.priceStatus !== 'PRICED').length,
})

const detailStats = (row) => detailCache.value[row.id]?.stats || { childCount: '-', missingCount: '-' }

const openGenerateDialog = (row) => {
  Object.assign(generateForm, {
    periodMonth: row?.periodMonth || priceFilters.periodMonth || currentMonthText(),
    oaNo: '',
    topProductCode: row?.sourceTopProductCode || priceFilters.topProductCode || '',
    bomPurpose: DEFAULT_BOM_PURPOSE,
    sourceType: 'U9',
    asOfDate: '',
  })
  bulkResultRows.value = []
  generateDialogVisible.value = true
}

const buildGenerateBody = () => {
  const body = {
    oaNo: String(generateForm.oaNo || '').trim(),
    periodMonth: generateForm.periodMonth || currentMonthText(),
    topProductCode: String(generateForm.topProductCode || '').trim(),
    bomPurpose: DEFAULT_BOM_PURPOSE,
    sourceType: generateForm.sourceType || 'U9',
    asOfDate: generateForm.asOfDate,
    forceRefresh: true,
  }
  Object.keys(body).forEach((key) => {
    if (body[key] === '') delete body[key]
  })
  return body
}

const submitGenerate = async () => {
  const body = buildGenerateBody()
  if (!body.oaNo) {
    ElMessage.warning('请输入 OA 单号')
    return
  }
  generating.value = true
  try {
    const result = await generatePackageComponentPriceByOa(body)
    bulkResultRows.value = Array.isArray(result?.records) ? result.records : []
    priceFilters.periodMonth = body.periodMonth
    priceFilters.packageMaterialCode = bulkResultRows.value.length === 1
      ? (bulkResultRows.value[0]?.packageMaterialCode || '')
      : ''
    priceFilters.topProductCode = body.topProductCode || ''
    activeTab.value = 'prices'
    pricePage.value = 1
    detailCache.value = {}
    ElMessage.success(`生成完成：成功 ${result?.successCount || 0} 个，失败 ${result?.failedCount || 0} 个`)
    await fetchPriceRows()
  } catch (error) {
    ElMessage.error(error?.message || '生成包装组件价格失败')
  } finally {
    generating.value = false
  }
}

const regenerate = async (row) => {
  if (!row.sourceTopProductCode) {
    ElMessage.warning('缺少来源顶层产品，请用生成按钮重新生成')
    return
  }
  try {
    await ElMessageBox.confirm(`确认重新取价 ${row.packageMaterialCode} / ${row.periodMonth}？`, '提示', {
      type: 'warning',
    })
  } catch (error) {
    return
  }
  regeneratingId.value = row.id
  try {
    const result = await generatePackageComponentPrice({
      packageMaterialCode: row.packageMaterialCode,
      periodMonth: row.periodMonth,
      topProductCode: row.sourceTopProductCode,
      bomPurpose: DEFAULT_BOM_PURPOSE,
      sourceType: 'U9',
      forceRefresh: true,
    })
    delete detailCache.value[row.id]
    showGenerateResultMessage(result)
    await fetchPriceRows()
  } catch (error) {
    ElMessage.error(error?.message || '重新取价失败')
  } finally {
    regeneratingId.value = null
  }
}

const showGenerateResultMessage = (result) => {
  const status = result?.price?.priceStatus || ''
  const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : []
  if (result?.complete) {
    ElMessage.success('包装组件价格已生成')
  } else {
    ElMessage.warning(warnings[0] || `包装组件价格未完整：${priceStatusLabel(status)}`)
  }
}

const openPriceDetail = async (row) => {
  priceDetailVisible.value = true
  priceDetail.price = row
  priceDetail.details = detailCache.value[row.id]?.details || []
  detailLoading.value = true
  try {
    const detail = await fetchPackageComponentPriceDetails(row.id)
    priceDetail.price = detail?.price || row
    priceDetail.details = Array.isArray(detail?.details) ? detail.details : []
    detailCache.value[row.id] = {
      price: priceDetail.price,
      details: priceDetail.details,
      stats: buildDetailStats(priceDetail.details),
    }
  } catch (error) {
    ElMessage.error(error?.message || '读取包装组件价格明细失败')
  } finally {
    detailLoading.value = false
  }
}

const openSnapshotDetail = async (row) => {
  snapshotDetailVisible.value = true
  snapshotDetail.snapshot = row
  snapshotDetail.details = []
  detailLoading.value = true
  try {
    const detail = await fetchPackageComponentSnapshotDetails(row.id)
    snapshotDetail.snapshot = detail?.snapshot || row
    snapshotDetail.details = Array.isArray(detail?.details) ? detail.details : []
  } catch (error) {
    ElMessage.error(error?.message || '读取结构子件失败')
  } finally {
    detailLoading.value = false
  }
}

const labelFrom = (map, value) => map.value[value]?.label || value || '-'
const tagFrom = (map, value, fallback = 'info') => map.value[value]?.tag || fallback
const priceStatusLabel = (status) => labelFrom(priceStatusMap, status)
const priceStatusTag = (status) => tagFrom(priceStatusMap, status, status === 'PRICED' ? 'success' : 'warning')
const snapshotStatusLabel = (status) => labelFrom(snapshotStatusMap, status)
const snapshotStatusTag = (status) => tagFrom(snapshotStatusMap, status, status === 'NORMAL' ? 'success' : 'warning')
const gapTypeLabel = (type) => labelFrom(gapTypeMap, type)
const gapTypeTag = (type) => tagFrom(gapTypeMap, type, 'warning')
const oaPushStatusLabel = (status) => labelFrom(oaPushStatusMap, status)
const oaPushStatusTag = (status) => tagFrom(oaPushStatusMap, status, 'info')
const detailPriceStatusLabel = (status) => {
  if (status === 'PRICED') return '已取价'
  if (status === 'MISSING_ROUTE') return '缺价格类型'
  if (status === 'MISSING_PRICE') return '缺价格'
  return status || '-'
}
const detailPriceStatusTag = (status) => status === 'PRICED' ? 'success' : 'warning'

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
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

watch([pricePage, pricePageSize], fetchPriceRows)
watch([snapshotPage, snapshotPageSize], fetchSnapshotRows)
watch([gapPage, gapPageSize], fetchGapRows)

onMounted(fetchPriceRows)
</script>

<style scoped>
.package-page {
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

.toolbar-actions {
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
  padding: 10px 12px 12px;
}

.package-tabs :deep(.el-tabs__header) {
  margin: 0 0 10px;
}

.package-table {
  width: 100%;
}

.bulk-result-table {
  margin-top: 12px;
}

.danger {
  color: #dc2626;
  font-weight: 650;
}

.detail-head {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.detail-head div {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
}

.detail-head span {
  display: block;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 4px;
}

.detail-head strong {
  display: block;
  color: #111827;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-table {
  width: 100%;
}

@media (max-width: 900px) {
  .package-page {
    padding: 12px;
  }

  .page-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .query-form :deep(.el-input),
  .query-form :deep(.el-select),
  .query-form :deep(.el-date-editor) {
    width: 100%;
  }

  .detail-head {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
