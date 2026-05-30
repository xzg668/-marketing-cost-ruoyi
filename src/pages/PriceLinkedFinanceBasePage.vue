<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div>
          <div class="filter-title">影响因素表</div>
          <div class="filter-subtitle">
            当前月份真正使用的影响因素月度价格，来源于月度联动价与影响因素 Excel 导入批次
          </div>
        </div>
        <div class="filter-actions">
          <el-button
            v-hasPermi="['price:factor-adjust:export', 'price:finance-base:list']"
            :loading="exportingTemplate"
            @click="downloadAdjustTemplate"
          >
            导出调价模板
          </el-button>
          <el-button
            v-hasPermi="['price:factor-adjust:import', 'price:finance-base:edit']"
            type="primary"
            @click="openImportDialog"
          >
            导入月度调价 Excel
          </el-button>
          <el-button :loading="loading" @click="fetchList">刷新</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.priceMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-input
            v-model="filters.businessUnitType"
            placeholder="COMMERCIAL"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="简称/影响因素" />
        </el-form-item>
        <el-form-item label="调价用途">
          <el-select
            v-model="filters.latestAdjustUsageScope"
            placeholder="全部用途"
            clearable
            style="width: 210px"
          >
            <el-option label="仅用于月度调价重算" value="REPRICE_ONLY" />
            <el-option label="同时作为日常报价生效价" value="REPRICE_AND_DAILY" />
          </el-select>
        </el-form-item>
        <el-form-item label="调价批次">
          <el-select
            v-model="filters.batchId"
            placeholder="全部调价批次"
            clearable
            style="width: 260px"
          >
            <el-option
              v-for="b in availableBatches"
              :key="b.id"
              :label="b.label"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="历史范围">
          <el-select
            v-model="filters.historyScope"
            style="width: 150px"
            @change="onHistoryScopeChange"
          >
            <el-option label="我的导入" value="mine" />
            <el-option
              v-if="canViewAllUploaders"
              label="全部上传人"
              value="all"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canViewAllUploaders" label="上传人">
          <el-input
            v-model="filters.uploadedBy"
            placeholder="为空表示全部"
            clearable
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button v-if="historyLimit < 50" @click="loadMoreBatches">
            查看更多
          </el-button>
        </el-form-item>
      </el-form>
      <div class="history-hint">
        默认显示当前月份、当前业务单元下最近 {{ historyLimit }} 条调价记录；普通用户只看自己的记录。
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="summary-strip">
        <div class="summary-item">
          <span class="summary-label">批次数</span>
          <span class="summary-value">{{ batchRows.length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">影响因素</span>
          <span class="summary-value">{{ filteredRows.length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">当前月份</span>
          <span class="summary-value">{{ filters.priceMonth || '-' }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="base-title">{{ monthTitle }}</div>
      <el-table :data="filteredRows" stripe v-loading="loading">
        <el-table-column prop="seq" label="序号" width="90" />
        <el-table-column
          prop="factorName"
          label="价表影响因素名称"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column prop="shortName" label="简称" width="120" />
        <el-table-column prop="priceSource" label="取价来源" width="140" />
        <el-table-column
          prop="price"
          label="日常报价生效价"
          width="140"
          align="right"
        >
          <template #default="{ row }">{{ formatNumber(row.price) }}</template>
        </el-table-column>
        <el-table-column
          prop="latestAdjustPrice"
          label="最近调价价"
          width="130"
          align="right"
        >
          <template #default="{ row }">
            {{ formatNumber(row.latestAdjustPrice) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="priceOriginal"
          label="原价/上月价"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            {{ formatNumber(row.priceOriginal) }}
          </template>
        </el-table-column>
        <el-table-column label="涨跌幅" width="110" align="right">
          <template #default="{ row }">
            <span :class="percentChangeClass(row)">
              {{ percentChangeText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="90" />
        <el-table-column
          prop="sourceTag"
          label="来源标签"
          width="120"
        >
          <template #default="{ row }">
            {{ sourceTagText(row.sourceTag) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="latestAdjustBatchNo"
          label="最近调价批次"
          width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="batch-tag">
              {{ row.latestAdjustBatchNo || shortBatchId(row.latestAdjustBatchId) || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="latestAdjustUsageScope"
          label="调价用途"
          width="170"
        >
          <template #default="{ row }">
            {{ usageScopeText(row.latestAdjustUsageScope) }}
          </template>
        </el-table-column>
        <el-table-column prop="latestAdjustedBy" label="最后调价人" width="120" />
        <el-table-column prop="latestAdjustedAt" label="最后调价时间" width="170" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['price:finance-base:batch:list']"
              type="primary"
              link
              @click="openSourceDrawer(row)"
            >
              查看来源
            </el-button>
            <el-button
              v-hasPermi="['price:finance-base:list']"
              type="primary"
              link
              @click="openReferenceDrawer(row)"
            >
              查看引用联动价
            </el-button>
            <el-button
              v-hasPermi="['price:finance-base:edit']"
              type="primary"
              link
              @click="openAdjustDialog(row)"
            >
              调价
            </el-button>
            <el-button
              v-hasPermi="['price:finance-base:list']"
              type="primary"
              link
              @click="openAdjustHistoryDrawer(row)"
            >
              查看调价历史
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="sourceDrawerVisible" title="影响因素来源追溯" size="520px">
      <el-descriptions v-if="sourceRow" :column="1" border>
        <el-descriptions-item label="序号">{{ sourceRow.seq }}</el-descriptions-item>
        <el-descriptions-item label="影响因素">{{ sourceRow.factorName }}</el-descriptions-item>
        <el-descriptions-item label="简称">{{ sourceRow.shortName }}</el-descriptions-item>
        <el-descriptions-item label="取价来源">{{ sourceRow.priceSource }}</el-descriptions-item>
        <el-descriptions-item label="日常报价生效价">
          {{ formatNumber(sourceRow.price) }}
        </el-descriptions-item>
        <el-descriptions-item label="最近调价价">
          {{ formatNumber(sourceRow.latestAdjustPrice) }}
        </el-descriptions-item>
        <el-descriptions-item label="原价/上月价">
          {{ formatNumber(sourceRow.priceOriginal) }}
        </el-descriptions-item>
        <el-descriptions-item label="来源标签">
          {{ sourceTagText(sourceRow.sourceTag) }}
        </el-descriptions-item>
        <el-descriptions-item label="日常价来源批次">
          {{ sourceRow.sourceUploadBatchId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近调价批次">
          {{ sourceRow.latestAdjustBatchNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="调价用途">
          {{ usageScopeText(sourceRow.latestAdjustUsageScope) }}
        </el-descriptions-item>
        <el-descriptions-item label="最后调价人">
          {{ sourceRow.latestAdjustedBy || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最后调价时间">
          {{ sourceRow.latestAdjustedAt || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-drawer v-model="adjustHistoryDrawerVisible" title="影响因素调价历史" size="860px">
      <div v-if="adjustHistoryRow" class="drawer-summary">
        <span>{{ adjustHistoryRow.seq }}</span>
        <span>{{ adjustHistoryRow.shortName }}</span>
        <span>{{ adjustHistoryRow.factorName }}</span>
      </div>
      <el-table :data="adjustHistoryRows" stripe v-loading="adjustHistoryLoading">
        <el-table-column prop="adjustBatchId" label="调价批次ID" width="120" />
        <el-table-column prop="originalPrice" label="原价格" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.originalPrice) }}</template>
        </el-table-column>
        <el-table-column prop="adjustedPrice" label="调价价" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.adjustedPrice) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="applyToDaily" label="同步日常价" width="110">
          <template #default="{ row }">
            {{ row.applyToDaily === 1 ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="操作时间" width="180" />
        <el-table-column prop="failReason" label="失败原因" min-width="180" show-overflow-tooltip />
      </el-table>
    </el-drawer>

    <el-drawer v-model="referenceDrawerVisible" title="引用联动价" size="860px">
      <div v-if="referenceRow" class="drawer-summary">
        <span>{{ referenceRow.seq }}</span>
        <span>{{ referenceRow.shortName }}</span>
        <span>{{ referenceRow.factorName }}</span>
        <span>{{ filters.priceMonth || '-' }}</span>
        <span>{{ filters.businessUnitType || '-' }}</span>
      </div>
      <el-table :data="referenceRows" stripe v-loading="referenceLoading">
        <el-table-column prop="pricingMonth" label="价格月份" width="100" />
        <el-table-column prop="materialCode" label="物料代码" width="130" />
        <el-table-column
          prop="materialName"
          label="物料名称"
          width="130"
          show-overflow-tooltip
        />
        <el-table-column
          prop="supplierName"
          label="供应商"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="tokenName" label="token 名称" width="130" />
        <el-table-column prop="bindingSource" label="绑定来源" width="130" />
        <el-table-column
          prop="formulaExpr"
          label="标准公式"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="formulaExprCn"
          label="中文公式"
          min-width="220"
          show-overflow-tooltip
        />
      </el-table>
    </el-drawer>

    <el-dialog v-model="adjustDialogVisible" title="影响因素调价" width="520px">
      <el-descriptions v-if="adjustForm.factorMonthlyPriceId" :column="1" border>
        <el-descriptions-item label="影响因素">
          {{ adjustForm.factorName }}
        </el-descriptions-item>
        <el-descriptions-item label="简称">
          {{ adjustForm.shortName }}
        </el-descriptions-item>
        <el-descriptions-item label="当前价格">
          {{ formatNumber(adjustForm.oldPrice) }}
        </el-descriptions-item>
      </el-descriptions>
      <el-form label-width="90px" class="adjust-form">
        <el-form-item label="新价格">
          <el-input v-model="adjustForm.newPrice" placeholder="请输入新价格" />
        </el-form-item>
        <el-form-item label="调价原因">
          <el-input
            v-model="adjustForm.remark"
            type="textarea"
            :rows="3"
            placeholder="填写调价原因或备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitting" @click="submitAdjustment">
          确认调价
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入月度调价 Excel" width="620px">
      <el-form label-width="110px" class="adjust-form">
        <el-form-item label="目标月份">
          <el-date-picker
            v-model="importForm.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-input v-model="importForm.businessUnitType" placeholder="COMMERCIAL" />
        </el-form-item>
        <el-form-item label="调价用途">
          <el-radio-group v-model="importForm.usageScope">
            <el-radio-button label="REPRICE_ONLY">
              仅用于月度调价重算
            </el-radio-button>
            <el-radio-button label="REPRICE_AND_DAILY">
              同时作为日常报价生效价
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="上传文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls"
            :on-change="onAdjustImportFileChange"
            :on-remove="onAdjustImportFileRemove"
          >
            <el-button>选择 Excel</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="importForm.remark"
            type="textarea"
            :rows="3"
            placeholder="填写本次调价说明"
          />
        </el-form-item>
      </el-form>

      <el-descriptions
        v-if="importResult"
        class="import-result"
        :column="2"
        border
      >
        <el-descriptions-item label="调价批次号">
          {{ importResult.adjustBatchNo || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="用途">
          {{ usageScopeText(importResult.usageScope) }}
        </el-descriptions-item>
        <el-descriptions-item label="识别总数">
          {{ importResult.totalCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="变化数">
          {{ importResult.changedCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="未变化数">
          {{ importResult.noChangeCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="失败数">
          {{ importResult.failedCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="是否同步日常报价">
          {{ importResult.usageScope === 'REPRICE_AND_DAILY' ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ importResult.status || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importSubmitting" @click="submitAdjustImport">
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  adjustFactorMonthlyPrice,
  exportFactorAdjustTemplate,
  fetchFactorAdjustBatches,
  fetchFactorAdjustPrices,
  fetchFactorLinkedItems,
  fetchFactorMonthlyPrices,
  importFactorAdjustExcel,
} from '../api/financeBasePrice'
import { useUserStore } from '../store/modules/user'
import {
  calcPercentChange,
  formatNumber,
  formatPercentChange,
  shortBatchId,
} from './financeBasePriceUtils'

const userStore = useUserStore()
const route = useRoute()
const loading = ref(false)
const batchRows = ref([])
const tableRows = ref([])
const sourceDrawerVisible = ref(false)
const sourceRow = ref(null)
const adjustDialogVisible = ref(false)
const adjustSubmitting = ref(false)
const exportingTemplate = ref(false)
const importDialogVisible = ref(false)
const importSubmitting = ref(false)
const importResult = ref(null)
const adjustImportFile = ref(null)
const adjustHistoryDrawerVisible = ref(false)
const adjustHistoryLoading = ref(false)
const adjustHistoryRows = ref([])
const adjustHistoryRow = ref(null)
const referenceDrawerVisible = ref(false)
const referenceLoading = ref(false)
const referenceRows = ref([])
const referenceRow = ref(null)
const adjustForm = ref({
  factorMonthlyPriceId: '',
  factorName: '',
  shortName: '',
  oldPrice: '',
  newPrice: '',
  remark: '',
})
const importForm = ref({
  pricingMonth: '',
  businessUnitType: '',
  adjustType: 'MONTHLY',
  usageScope: 'REPRICE_ONLY',
  remark: '',
})

const currentMonthText = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const currentUsername = computed(() => userStore.username || '')

const firstQueryText = (value) =>
  Array.isArray(value) ? value[0] || '' : value || ''

const canViewAllUploaders = computed(() => {
  const roles = Array.isArray(userStore.roles) ? userStore.roles : []
  const permissions = Array.isArray(userStore.permissions)
    ? userStore.permissions
    : []
  return (
    roles.some((role) => String(role).toLowerCase() === 'admin') ||
    permissions.includes('*:*:*') ||
    permissions.includes('price:linked-item:import-history:all') ||
    permissions.includes('price:linked-item:admin') ||
    permissions.includes('price:finance-base:import-history:all') ||
    permissions.includes('price:finance-base:admin')
  )
})

const filters = ref({
  priceMonth: firstQueryText(route.query.priceMonth) || currentMonthText(),
  businessUnitType:
    firstQueryText(route.query.businessUnitType) || userStore.businessUnitType || '',
  keyword: '',
  batchId: '',
  latestAdjustUsageScope: '',
  historyScope: 'mine',
  uploadedBy: '',
})
const historyLimit = ref(10)

const monthTitle = computed(() => {
  const month = filters.value.priceMonth || tableRows.value[0]?.priceMonth || ''
  if (!month) {
    return '参照基准'
  }
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) {
    return '参照基准'
  }
  return `${year}年${Number(monthPart)}月影响因素汇总`
})

const availableBatches = computed(() =>
  batchRows.value.map((batch) => ({
    id: String(batch.id || batch.adjustBatchId || ''),
    label: [
      batch.adjustBatchNo || shortBatchId(batch.id || batch.adjustBatchId),
      usageScopeText(batch.usageScope),
      batch.uploadedBy,
    ].filter(Boolean).join(' · '),
  })),
)

const filteredRows = computed(() => {
  const keyword = filters.value.keyword?.trim().toLowerCase()
  const batchId = String(filters.value.batchId || '')
  return tableRows.value.filter((row) => {
    const matchesBatch =
      !batchId || String(row.latestAdjustBatchId || '') === batchId
    const matchesKeyword =
      !keyword ||
      [
        row.factorName,
        row.shortName,
        row.priceSource,
      ].some((text) => String(text || '').toLowerCase().includes(keyword))
    return matchesBatch && matchesKeyword
  })
})

const buildBatchParams = () => {
  const includeAllUploaders =
    canViewAllUploaders.value && filters.value.historyScope === 'all'
  return {
    pricingMonth: filters.value.priceMonth,
    businessUnitType: filters.value.businessUnitType,
    adjustType: 'MONTHLY',
    usageScope: filters.value.latestAdjustUsageScope,
    uploadedBy: includeAllUploaders
      ? filters.value.uploadedBy?.trim()
      : currentUsername.value,
    includeAllUploaders,
    limit: historyLimit.value,
    pageSize: historyLimit.value,
  }
}

const normalizeBatch = (row) => ({
  ...row,
  id: String(row?.id || row?.adjustBatchId || ''),
})

const normalizeFactorRow = (row) => ({
  id: [
    row?.factorMonthlyPriceId,
    row?.factorIdentityId,
    row?.priceMonth,
  ].filter(Boolean).join('-'),
  priceMonth: row?.priceMonth || filters.value.priceMonth,
  seq: row?.factorSeqNo || '-',
  factorName: row?.factorName || '-',
  shortName: row?.shortName || '-',
  priceSource: row?.priceSource || '-',
  price: row?.dailyEffectivePrice ?? '',
  latestAdjustPrice: row?.latestAdjustPrice ?? '',
  priceOriginal: row?.latestAdjustOriginalPrice ?? '',
  unit: row?.unit || '-',
  sourceTag: row?.sourceTag || '',
  sourceUploadBatchId: row?.sourceUploadBatchId,
  latestAdjustBatchId: row?.latestAdjustBatchId,
  latestAdjustBatchNo: row?.latestAdjustBatchNo || '',
  latestAdjustUsageScope: row?.latestAdjustUsageScope || '',
  latestAdjustedBy: row?.latestAdjustedBy || '',
  latestAdjustedAt: row?.latestAdjustedAt || '',
  factorIdentityId: row?.factorIdentityId,
  factorMonthlyPriceId: row?.factorMonthlyPriceId,
})

const fetchList = async () => {
  loading.value = true
  try {
    const [monthlyPage, batchesPage] = await Promise.all([
      fetchFactorMonthlyPrices({
        pricingMonth: filters.value.priceMonth,
        businessUnitType: filters.value.businessUnitType,
        keyword: filters.value.keyword,
        latestAdjustUsageScope: filters.value.latestAdjustUsageScope,
        latestAdjustedBy:
          canViewAllUploaders.value && filters.value.historyScope === 'all'
            ? filters.value.uploadedBy?.trim()
            : '',
        page: 1,
        pageSize: 500,
      }),
      fetchFactorAdjustBatches(buildBatchParams()),
    ])
    const batchList = Array.isArray(batchesPage)
      ? batchesPage
      : batchesPage?.list || []
    batchRows.value = batchList.map(normalizeBatch)
    const rows = Array.isArray(monthlyPage)
      ? monthlyPage
      : monthlyPage?.list || []
    tableRows.value = rows.map(normalizeFactorRow)
    if (
      filters.value.batchId &&
      !batchRows.value.some((batch) => String(batch.id) === String(filters.value.batchId))
    ) {
      filters.value.batchId = ''
    }
  } catch (error) {
    tableRows.value = []
    batchRows.value = []
    ElMessage.error(error?.message || '获取影响因素表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    priceMonth: currentMonthText(),
    businessUnitType: userStore.businessUnitType || '',
    keyword: '',
    batchId: '',
    latestAdjustUsageScope: '',
    historyScope: 'mine',
    uploadedBy: '',
  }
  historyLimit.value = 10
  fetchList()
}

const onHistoryScopeChange = () => {
  if (filters.value.historyScope === 'mine') {
    filters.value.uploadedBy = ''
  }
  historyLimit.value = 10
  fetchList()
}

const loadMoreBatches = () => {
  historyLimit.value = Math.min(historyLimit.value + 10, 50)
  fetchList()
}

const usageScopeText = (value) => {
  if (value === 'REPRICE_ONLY') return '仅用于月度调价重算'
  if (value === 'REPRICE_AND_DAILY') return '同时作为日常报价生效价'
  return value || '-'
}

const sourceTagText = (value) => {
  if (value === 'MANUAL_ADJUST') return '页面手工调价'
  if (value === 'ADJUST_IMPORT') return '月度调价导入'
  if (value === 'LINKED_IMPORT') return '联动价导入'
  return value || '-'
}

const openSourceDrawer = (row) => {
  sourceRow.value = row
  sourceDrawerVisible.value = true
}

const openImportDialog = () => {
  importForm.value = {
    pricingMonth: filters.value.priceMonth || currentMonthText(),
    businessUnitType: filters.value.businessUnitType || userStore.businessUnitType || '',
    adjustType: 'MONTHLY',
    usageScope: 'REPRICE_ONLY',
    remark: '',
  }
  adjustImportFile.value = null
  importResult.value = null
  importDialogVisible.value = true
}

const onAdjustImportFileChange = (file) => {
  adjustImportFile.value = file
}

const onAdjustImportFileRemove = () => {
  adjustImportFile.value = null
}

const submitAdjustImport = async () => {
  const rawFile = adjustImportFile.value?.raw || adjustImportFile.value
  if (!rawFile) {
    ElMessage.warning('请选择调价 Excel')
    return
  }
  if (!importForm.value.pricingMonth || !importForm.value.businessUnitType) {
    ElMessage.warning('请选择目标月份并填写业务单元')
    return
  }
  importSubmitting.value = true
  try {
    const response = await importFactorAdjustExcel(rawFile, importForm.value)
    importResult.value = response
    filters.value.priceMonth = importForm.value.pricingMonth
    filters.value.businessUnitType = importForm.value.businessUnitType
    filters.value.latestAdjustUsageScope = importForm.value.usageScope
    ElMessage.success('月度调价 Excel 已导入')
    await fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '导入月度调价 Excel 失败')
  } finally {
    importSubmitting.value = false
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

const downloadAdjustTemplate = async () => {
  if (!filters.value.priceMonth || !filters.value.businessUnitType) {
    ElMessage.warning('请选择价格月份并填写业务单元')
    return
  }
  exportingTemplate.value = true
  try {
    const result = await exportFactorAdjustTemplate({
      pricingMonth: filters.value.priceMonth,
      businessUnitType: filters.value.businessUnitType,
      keyword: filters.value.keyword,
      adjustBatchId: filters.value.batchId,
    })
    downloadBlob(result.blob, result.fileName)
    ElMessage.success('调价模板已导出')
  } catch (error) {
    ElMessage.error(error?.message || '导出调价模板失败')
  } finally {
    exportingTemplate.value = false
  }
}

const openAdjustDialog = (row) => {
  if (!row?.factorMonthlyPriceId) {
    ElMessage.warning('该影响因素缺少月度价格 ID，不能调价')
    return
  }
  adjustForm.value = {
    factorMonthlyPriceId: row.factorMonthlyPriceId,
    factorName: row.factorName,
    shortName: row.shortName,
    oldPrice: row.price,
    newPrice: row.price,
    remark: '',
  }
  adjustDialogVisible.value = true
}

const normalizeDecimalInput = (value) => {
  const text = String(value ?? '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return ''
  }
  return text
}

const submitAdjustment = async () => {
  const newPrice = normalizeDecimalInput(adjustForm.value.newPrice)
  if (!newPrice) {
    ElMessage.warning('请输入合法的新价格')
    return
  }
  adjustSubmitting.value = true
  try {
    const response = await adjustFactorMonthlyPrice(
      adjustForm.value.factorMonthlyPriceId,
      {
        newPrice,
        remark: adjustForm.value.remark,
      },
    )
    // 调价只替换当前月度价格显示，绑定关系仍靠 factorIdentityId 保持不变。
    tableRows.value = tableRows.value.map((row) =>
      String(row.factorMonthlyPriceId) === String(response.factorMonthlyPriceId)
        ? { ...row, price: response.newPrice }
        : row,
    )
    adjustDialogVisible.value = false
    ElMessage.success('调价已保存')
  } catch (error) {
    ElMessage.error(error?.message || '调价失败')
  } finally {
    adjustSubmitting.value = false
  }
}

const openAdjustHistoryDrawer = async (row) => {
  if (!row?.factorIdentityId) {
    ElMessage.warning('该影响因素缺少身份 ID，无法查看调价历史')
    return
  }
  adjustHistoryRow.value = row
  adjustHistoryDrawerVisible.value = true
  adjustHistoryLoading.value = true
  try {
    const page = await fetchFactorAdjustPrices({
      factorIdentityId: row.factorIdentityId,
      page: 1,
      pageSize: 50,
    })
    adjustHistoryRows.value = Array.isArray(page) ? page : page?.list || []
  } catch (error) {
    adjustHistoryRows.value = []
    ElMessage.error(error?.message || '获取调价历史失败')
  } finally {
    adjustHistoryLoading.value = false
  }
}

const openReferenceDrawer = async (row) => {
  if (!row?.factorIdentityId) {
    ElMessage.warning('该影响因素缺少身份 ID，无法反查引用联动价')
    return
  }
  referenceRow.value = row
  referenceDrawerVisible.value = true
  referenceLoading.value = true
  try {
    // 反查跟页面筛选保持一致，避免调价前看到其他月份或其他业务单元的联动价。
    const rows = await fetchFactorLinkedItems(row.factorIdentityId, {
      pricingMonth: filters.value.priceMonth,
      businessUnitType: filters.value.businessUnitType,
    })
    referenceRows.value = Array.isArray(rows) ? rows : []
  } catch (error) {
    referenceRows.value = []
    ElMessage.error(error?.message || '获取引用联动价失败')
  } finally {
    referenceLoading.value = false
  }
}

/** 涨跌幅显示文本 —— 委托给纯函数 */
const percentChangeText = (row) =>
  formatPercentChange(calcPercentChange(row.price, row.priceOriginal))

/** 涨跌幅配色：涨橙跌绿（国内财务习惯） */
const percentChangeClass = (row) => {
  const ratio = calcPercentChange(row.price, row.priceOriginal)
  if (ratio === null) return 'pct-flat'
  if (ratio > 0) return 'pct-up'
  if (ratio < 0) return 'pct-down'
  return 'pct-flat'
}

defineExpose({ calcPercentChange, shortBatchId })

onMounted(fetchList)
</script>

<style scoped>
.base-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.base-title,
.filter-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.history-hint {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.drawer-summary,
.adjust-form {
  margin-top: 14px;
}

.import-result {
  margin-top: 16px;
}

.drawer-summary {
  display: flex;
  gap: 10px;
  color: #4b5563;
  margin-bottom: 12px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.summary-strip {
  display: flex;
  gap: 24px;
  align-items: center;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.summary-label {
  color: #6b7280;
  font-size: 13px;
}

.summary-value {
  color: #1f2a37;
  font-size: 18px;
  font-weight: 600;
}

.base-title {
  margin-bottom: 12px;
}

.pct-up {
  color: #e6a23c;
}

.pct-down {
  color: #67c23a;
}

.pct-flat {
  color: #909399;
}

.batch-tag {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #606266;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
