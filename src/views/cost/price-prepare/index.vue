<template>
  <div class="price-prepare-page">
    <section class="page-toolbar">
      <div class="page-title">
        <h1>价格准备</h1>
        <p>查询准备记录和缺口；价格准备请进入报价单的单产品核算工作台</p>
      </div>
      <div class="toolbar-actions">
        <el-button :icon="RefreshRight" :loading="loadingAny" @click="refreshAll">刷新</el-button>
        <el-button type="primary" :disabled="!selectedCandidate" @click="openQuotation">
          打开报价单
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
          <el-input v-model="candidateFilters.calcStatus" clearable placeholder="全部状态" />
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
      </div>
      <el-table
        :data="candidateRows"
        border
        stripe
        highlight-current-row
        v-loading="candidateLoading"
        row-key="candidateKey"
        class="prepare-table"
        @row-click="selectCandidate"
      >
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
                <el-tag size="small" :type="displayGapTypeTag(row)">{{ displayGapTypeLabel(row) }}</el-tag>
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
            <el-table-column label="建议处理" width="230" fixed="right">
              <template #default="{ row }">
                <div v-if="isMissingScrapMappingGap(row)" class="gap-action-buttons">
                  <el-button
                    link
                    type="primary"
                    :icon="Search"
                    @click.stop="goSupplementScrapMapping(row)"
                  >
                    补充废料映射
                  </el-button>
                  <el-button
                    v-if="canConfirmNoScrap(row)"
                    link
                    type="warning"
                    :icon="Operation"
                    @click.stop="openNoScrapConfirmDialog(row)"
                  >
                    确认无废料，按0处理
                  </el-button>
                  <el-button
                    v-if="canRevokeNoScrap(row)"
                    link
                    type="danger"
                    :icon="RefreshLeft"
                    @click.stop="openNoScrapRevokeDialog(row)"
                  >
                    撤销确认
                  </el-button>
                </div>
                <span v-else class="muted-text">按缺口说明处理</span>
              </template>
            </el-table-column>
            <el-table-column label="确认状态" min-width="210">
              <template #default="{ row }">
                <div v-if="isMissingScrapMappingGap(row)" class="confirmation-cell">
                  <el-tag size="small" :type="noScrapConfirmationTag(row)">
                    {{ noScrapConfirmationLabel(row) }}
                  </el-tag>
                  <div v-if="isNoScrapConfirmed(row)" class="confirmation-detail">
                    {{ noScrapConfirmedBy(row) }} / {{ formatDateTime(noScrapConfirmedAt(row)) }}
                  </div>
                  <div v-if="isNoScrapConfirmed(row) && noScrapConfirmReason(row)" class="confirmation-reason">
                    {{ noScrapConfirmReason(row) }}
                  </div>
                </div>
                <span v-else class="muted-text">-</span>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty :description="selectedCandidate ? '暂无价格准备缺口' : '请先选择候选行'" />
            </template>
          </el-table>
          <BasePagination v-model:current-page="gapPage" v-model:page-size="gapPageSize" :total="gapTotal" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="noScrapConfirmDialogVisible" title="确认无废料，按0处理" width="560px">
      <el-alert
        class="no-scrap-impact-alert"
        type="warning"
        show-icon
        :closable="false"
        title="确认后该料号废料抵扣按 0 处理，需重新生成价格准备后生效。"
      />
      <el-descriptions :column="1" border class="no-scrap-context">
        <el-descriptions-item label="OA单号">{{ noScrapConfirmContext.oaNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="顶层产品">{{ noScrapConfirmContext.topProductCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="子项料号">{{ noScrapConfirmContext.materialNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="价格月份">{{ noScrapConfirmContext.periodMonth || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="noScrapConfirmForm" label-width="86px">
        <el-form-item label="确认原因" required>
          <el-input
            v-model="noScrapConfirmForm.confirmReason"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入确认原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noScrapConfirmDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="noScrapConfirming" @click="submitNoScrapConfirm">确认按0处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="noScrapRevokeDialogVisible" title="撤销无废料确认" width="520px">
      <el-alert
        class="no-scrap-impact-alert"
        type="warning"
        show-icon
        :closable="false"
        title="撤销后重新生成价格准备，该料号会重新进入缺废料映射缺口，除非已补充 CMS 废料映射。"
      />
      <el-descriptions :column="1" border class="no-scrap-context">
        <el-descriptions-item label="确认ID">{{ noScrapRevokeContext.confirmationId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="OA单号">{{ noScrapRevokeContext.oaNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="料号">{{ noScrapRevokeContext.materialNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="确认原因">{{ noScrapRevokeContext.confirmReason || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="noScrapRevokeForm" label-width="86px">
        <el-form-item label="撤销原因" required>
          <el-input
            v-model="noScrapRevokeForm.revokeReason"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入撤销原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="noScrapRevokeDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="noScrapRevoking" @click="submitNoScrapRevoke">撤销确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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
  confirmPricePrepareNoScrap,
  revokePricePrepareNoScrap,
  normalizePricePreparePage,
} from '../../../api/pricePrepare.js'
import { useUserStore } from '../../../store/modules/user'

const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('items')
const candidateRows = ref([])
const selectedCandidate = ref(null)
const itemRows = ref([])
const gapRows = ref([])

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
const itemLoading = ref(false)
const gapLoading = ref(false)
const noScrapConfirmDialogVisible = ref(false)
const noScrapConfirming = ref(false)
const noScrapRevokeDialogVisible = ref(false)
const noScrapRevoking = ref(false)
const currentNoScrapGap = ref(null)
const currentNoScrapRevokeGap = ref(null)

const hasPermission = (permission) => {
  const permissions = Array.isArray(userStore.permissions) ? userStore.permissions : []
  return permissions.includes('*:*:*') || permissions.includes(permission)
}
const defaultOwnerScope = () => (hasPermission('cost:price-prepare:list-all') ? 'ALL' : 'MINE')

const candidateFilters = reactive({
  keyword: '',
  ownerScope: defaultOwnerScope(),
  calcStatus: '',
  prepareStatus: '',
  onlyPending: true,
})
const itemFilters = reactive({ materialCode: '', itemType: '', status: '' })
const gapFilters = reactive({ materialCode: '', gapMaterialCode: '', itemType: '', gapType: '' })
const noScrapConfirmForm = reactive({ confirmReason: '' })
const noScrapRevokeForm = reactive({ revokeReason: '' })
const noScrapConfirmContext = reactive({
  oaNo: '',
  topProductCode: '',
  materialNo: '',
  materialName: '',
  periodMonth: '',
})
const noScrapRevokeContext = reactive({
  confirmationId: '',
  oaNo: '',
  materialNo: '',
  confirmReason: '',
})

const loadingAny = computed(() => candidateLoading.value || itemLoading.value || gapLoading.value)
const canConfirmNoScrapPermission = computed(() => hasPermission('cost:price-prepare:no-scrap-confirm'))
const canRevokeNoScrapPermission = computed(() => hasPermission('cost:price-prepare:no-scrap-revoke'))
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

const currentMonthText = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const candidateKey = (row) => `${row?.oaNo || ''}__${row?.topProductCode || ''}`
const enrichCandidate = (row) => ({ ...row, candidateKey: candidateKey(row) })
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

const GAP_TYPE_MISSING_SCRAP_MAPPING = 'MISSING_SCRAP_MAPPING'
const ACTION_SUPPLEMENT_SCRAP_MAPPING = 'SUPPLEMENT_SCRAP_MAPPING'
const ACTION_CONFIRM_NO_SCRAP = 'CONFIRM_NO_SCRAP'
const NO_SCRAP_STATUS_ACTIVE = 'ACTIVE'
const NO_SCRAP_STATUS_REVOKED = 'REVOKED'

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

const isScrapMappingSource = (row) => row?.sourceTable === 'lp_material_scrap_ref'
const isMissingScrapMappingGap = (row) =>
  row?.gapType === GAP_TYPE_MISSING_SCRAP_MAPPING ||
  row?.actionType === ACTION_SUPPLEMENT_SCRAP_MAPPING ||
  row?.actionType === ACTION_CONFIRM_NO_SCRAP ||
  row?.canConfirmNoScrap === true ||
  isScrapMappingSource(row)

const displayGapTypeLabel = (row) =>
  isMissingScrapMappingGap(row) ? '缺废料映射' : gapTypeLabel(row?.gapType)

const displayGapTypeTag = (row) =>
  isMissingScrapMappingGap(row) ? 'warning' : gapTypeTag(row?.gapType)

const actionMaterialNo = (row) =>
  row?.actionMaterialNo || row?.materialNo || row?.gapMaterialCode || row?.materialCode || ''

const actionPeriodMonth = (row) =>
  row?.periodMonth || row?.priceMonth || row?.effectiveFromMonth || selectedCandidate.value?.periodMonth || currentMonthText()

const noScrapConfirmation = (row) => row?.noScrapConfirmation || {}
const noScrapConfirmationStatus = (row) =>
  row?.noScrapConfirmationStatus ||
  row?.confirmationStatus ||
  row?.noScrapStatus ||
  noScrapConfirmation(row).status ||
  (row?.noScrapConfirmationId ? NO_SCRAP_STATUS_ACTIVE : '')

const isNoScrapConfirmed = (row) => noScrapConfirmationStatus(row) === NO_SCRAP_STATUS_ACTIVE
const canConfirmNoScrap = (row) =>
  isMissingScrapMappingGap(row) &&
  canConfirmNoScrapPermission.value &&
  row?.canConfirmNoScrap !== false &&
  !isNoScrapConfirmed(row)

const noScrapConfirmationId = (row) =>
  row?.noScrapConfirmationId || noScrapConfirmation(row).id || ''

const canRevokeNoScrap = (row) =>
  isMissingScrapMappingGap(row) &&
  canRevokeNoScrapPermission.value &&
  isNoScrapConfirmed(row) &&
  Boolean(noScrapConfirmationId(row))

const noScrapConfirmationLabel = (row) => {
  const status = noScrapConfirmationStatus(row)
  if (status === NO_SCRAP_STATUS_ACTIVE) return '已确认'
  if (status === NO_SCRAP_STATUS_REVOKED) return '已撤销'
  return '未确认'
}

const noScrapConfirmationTag = (row) => {
  const status = noScrapConfirmationStatus(row)
  if (status === NO_SCRAP_STATUS_ACTIVE) return 'success'
  if (status === NO_SCRAP_STATUS_REVOKED) return 'info'
  return 'warning'
}

const noScrapConfirmedBy = (row) =>
  row?.confirmedBy || noScrapConfirmation(row).confirmedBy || '-'

const noScrapConfirmedAt = (row) =>
  row?.confirmedAt || noScrapConfirmation(row).confirmedAt || ''

const noScrapConfirmReason = (row) =>
  row?.confirmReason || noScrapConfirmation(row).confirmReason || ''

const noScrapSourceOaNo = (row) =>
  row?.sourceOaNo || noScrapConfirmation(row).sourceOaNo || row?.oaNo || selectedCandidate.value?.oaNo || ''

const priceSourceLabel = (value) => {
  if (!value) return '-'
  if (value === 'SCRAP_PRICE') return '废料价格'
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

const goSupplementScrapMapping = (row) => {
  const materialCode = actionMaterialNo(row)
  router.push({
    path: '/base/cms-cost/material-scrap-refs',
    query: materialCode ? { materialCode } : {},
  })
}

const openNoScrapConfirmDialog = (row) => {
  currentNoScrapGap.value = row
  Object.assign(noScrapConfirmContext, {
    oaNo: row?.oaNo || selectedCandidate.value?.oaNo || '',
    topProductCode: row?.topProductCode || selectedCandidate.value?.topProductCode || '',
    materialNo: actionMaterialNo(row),
    materialName: row?.materialName || row?.gapMaterialName || '',
    periodMonth: actionPeriodMonth(row),
  })
  noScrapConfirmForm.confirmReason = ''
  noScrapConfirmDialogVisible.value = true
}

const mergeNoScrapConfirmation = (row, response) => {
  if (!row || !response) return
  row.noScrapConfirmationId = response.id
  row.noScrapConfirmationStatus = response.status || NO_SCRAP_STATUS_ACTIVE
  row.noScrapConfirmation = response
  row.confirmedBy = response.confirmedBy
  row.confirmedAt = response.confirmedAt
  row.confirmReason = response.confirmReason
  row.revokedBy = response.revokedBy
  row.revokedAt = response.revokedAt
  row.revokeReason = response.revokeReason
}

const submitNoScrapConfirm = async () => {
  const reason = noScrapConfirmForm.confirmReason.trim()
  if (!reason) {
    ElMessage.warning('请输入确认原因')
    return
  }
  const row = currentNoScrapGap.value
  noScrapConfirming.value = true
  try {
    const response = await confirmPricePrepareNoScrap({
      businessUnitType: row?.businessUnitType || userStore.businessUnitType || '',
      materialNo: noScrapConfirmContext.materialNo,
      materialName: noScrapConfirmContext.materialName,
      effectiveFromMonth: noScrapConfirmContext.periodMonth,
      confirmReason: reason,
      sourceOaNo: noScrapConfirmContext.oaNo,
      sourceGapId: row?.id,
    })
    mergeNoScrapConfirmation(row, response)
    noScrapConfirmDialogVisible.value = false
    ElMessage.success('确认完成，需重新生成价格准备后生效')
  } catch (error) {
    ElMessage.error(error?.message || '确认无废料失败')
  } finally {
    noScrapConfirming.value = false
  }
}

const openNoScrapRevokeDialog = (row) => {
  currentNoScrapRevokeGap.value = row
  Object.assign(noScrapRevokeContext, {
    confirmationId: noScrapConfirmationId(row),
    oaNo: noScrapSourceOaNo(row),
    materialNo: actionMaterialNo(row),
    confirmReason: noScrapConfirmReason(row),
  })
  noScrapRevokeForm.revokeReason = ''
  noScrapRevokeDialogVisible.value = true
}

const submitNoScrapRevoke = async () => {
  const reason = noScrapRevokeForm.revokeReason.trim()
  if (!reason) {
    ElMessage.warning('请输入撤销原因')
    return
  }
  const row = currentNoScrapRevokeGap.value
  const confirmationId = noScrapConfirmationId(row)
  if (!confirmationId) {
    ElMessage.warning('缺少确认记录ID')
    return
  }
  noScrapRevoking.value = true
  try {
    const response = await revokePricePrepareNoScrap(confirmationId, {
      revokeReason: reason,
    })
    mergeNoScrapConfirmation(row, response)
    noScrapRevokeDialogVisible.value = false
    ElMessage.success('撤销完成，重新生成价格准备后缺口会按最新状态刷新')
  } catch (error) {
    ElMessage.error(error?.message || '撤销无废料确认失败')
  } finally {
    noScrapRevoking.value = false
  }
}

const buildCandidateParams = () => ({
  ...candidateFilters,
  periodMonth: currentMonthText(),
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

const buildItemParams = () => ({
  ...itemFilters,
  oaNo: selectedCandidate.value?.oaNo,
  periodMonth: selectedCandidate.value?.periodMonth || currentMonthText(),
  topProductCode: selectedCandidate.value?.topProductCode,
  page: itemPage.value,
  pageSize: itemPageSize.value,
})

const buildGapParams = () => ({
  ...gapFilters,
  oaNo: selectedCandidate.value?.oaNo,
  periodMonth: selectedCandidate.value?.periodMonth || currentMonthText(),
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

const selectCandidate = async (row) => {
  selectedCandidate.value = row
  itemPage.value = 1
  gapPage.value = 1
  await Promise.all([fetchItems(), fetchGaps()])
}

const applyCandidateFilters = async () => {
  candidatePage.value = 1
  selectedCandidate.value = null
  itemRows.value = []
  gapRows.value = []
  await fetchCandidates()
}

const resetCandidateFilters = async () => {
  Object.assign(candidateFilters, {
    keyword: '',
    ownerScope: defaultOwnerScope(),
    calcStatus: '',
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

const openQuotation = () => {
  const oaNo = selectedCandidate.value?.oaNo
  if (!oaNo) return
  router.push({ name: 'ingest-quote-request-detail', params: { oaNo } })
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

.gap-action-buttons {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
}

.confirmation-cell {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.confirmation-detail,
.confirmation-reason,
.muted-text {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
}

.confirmation-reason {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.no-scrap-impact-alert,
.no-scrap-context {
  margin-bottom: 14px;
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

@media (max-width: 600px) {
  .price-prepare-page {
    padding: 8px;
  }

  .page-toolbar,
  .query-panel,
  .table-panel {
    border-radius: 6px;
  }

  .page-toolbar {
    padding: 14px;
  }

  .toolbar-actions,
  .tab-filter-row {
    width: 100%;
  }

  .toolbar-actions :deep(.el-button),
  .tab-filter-row :deep(.el-button) {
    flex: none;
    width: 100%;
    min-width: 0;
  }

  .query-panel {
    padding: 12px 12px 0;
  }

  .query-form {
    display: block;
  }

  .query-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
  }

  .query-form :deep(.el-form-item__label) {
    display: block;
    width: auto !important;
    margin-bottom: 6px;
    text-align: left;
  }

  .query-form :deep(.el-form-item__content),
  .query-form :deep(.el-input),
  .query-form :deep(.el-select),
  .query-form :deep(.el-date-editor),
  .tab-filter-row :deep(.el-input),
  .tab-filter-row :deep(.el-select) {
    width: 100%;
  }

  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .tab-filter-row {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
