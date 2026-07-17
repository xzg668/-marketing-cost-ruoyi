<template>
  <div class="finance-cu-page">
    <el-card shadow="never" class="hero-card">
      <div class="hero-content">
        <div>
          <div class="page-title">财务 Cu 报价基准</div>
          <div class="page-subtitle">
            按月维护财务报价使用的电解铜基准。页面统一使用元/吨，保存时由后端换算为元/公斤。
          </div>
        </div>
        <div class="hero-actions">
          <el-tag v-if="!canEdit" type="info" effect="plain">只读权限</el-tag>
          <el-button v-if="canEdit" type="primary" @click="openInitializeDialog">
            批量初始化
          </el-button>
          <el-button :loading="loading" @click="loadRows">刷新</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" label-width="90px">
        <el-form-item label="开始月份">
          <el-date-picker
            v-model="filters.startMonth"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            placeholder="选择开始月份"
          />
        </el-form-item>
        <el-form-item label="结束月份">
          <el-date-picker
            v-model="filters.endMonth"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            placeholder="选择结束月份"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="queryRows">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="summary-grid">
      <el-card shadow="never" class="summary-card">
        <span class="summary-label">当前业务单元</span>
        <strong>{{ currentBusinessUnit || '—' }}</strong>
      </el-card>
      <el-card shadow="never" class="summary-card">
        <span class="summary-label">已配置月份</span>
        <strong>{{ rows.length }}</strong>
      </el-card>
      <el-card shadow="never" class="summary-card">
        <span class="summary-label">默认基准</span>
        <strong>{{ formatPricePerTon(defaultPricePerTon) }} 元/吨</strong>
      </el-card>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        empty-text="当前月份范围暂无财务 Cu 基准"
      >
        <el-table-column prop="priceMonth" label="月份" width="120" />
        <el-table-column prop="businessUnitType" label="业务单元" min-width="140" />
        <el-table-column label="Cu基准（元/吨）" min-width="170" align="right">
          <template #default="{ row }">
            <span class="price-value">{{ formatPricePerTon(row.pricePerTon) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="数据状态" width="110">
          <template #default>
            <el-tag type="success" effect="light">已配置</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastModifiedBy" label="最近修改人" min-width="130">
          <template #default="{ row }">{{ row.lastModifiedBy || '—' }}</template>
        </el-table-column>
        <el-table-column label="最近修改时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.lastModifiedAt || row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastChangeReason" label="调整原因" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.lastChangeReason || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canEdit" type="primary" link @click="openAdjustDialog(row)">
              调整
            </el-button>
            <span v-else class="readonly-text">只读</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="initializeDialogVisible"
      title="批量初始化财务 Cu 基准"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="已存在月份会自动跳过，不会覆盖原有财务基准。"
        type="info"
        :closable="false"
        show-icon
        class="dialog-alert"
      />
      <el-form label-width="120px">
        <el-form-item label="开始月份" required>
          <el-date-picker
            v-model="initializeForm.monthFrom"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            placeholder="选择开始月份"
          />
        </el-form-item>
        <el-form-item label="结束月份" required>
          <el-date-picker
            v-model="initializeForm.monthTo"
            type="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            placeholder="选择结束月份"
          />
        </el-form-item>
        <el-form-item label="Cu基准（元/吨）" required>
          <el-input-number
            v-model="initializeForm.pricePerTon"
            :min="0.01"
            :max="maxPricePerTon"
            :step="1000"
            :precision="2"
            controls-position="right"
            class="price-input"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="initializeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="initializeSubmitting" @click="submitInitialize">
          确认初始化
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="adjustDialogVisible"
      title="调整单月财务 Cu 基准"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-descriptions v-if="adjustingRow" :column="1" border class="adjust-summary">
        <el-descriptions-item label="月份">{{ adjustingRow.priceMonth }}</el-descriptions-item>
        <el-descriptions-item label="业务单元">
          {{ adjustingRow.businessUnitType }}
        </el-descriptions-item>
        <el-descriptions-item label="当前基准">
          {{ formatPricePerTon(adjustingRow.pricePerTon) }} 元/吨
        </el-descriptions-item>
      </el-descriptions>
      <el-form label-width="120px">
        <el-form-item label="新基准（元/吨）" required>
          <el-input-number
            v-model="adjustForm.pricePerTon"
            :min="0.01"
            :max="maxPricePerTon"
            :step="1000"
            :precision="2"
            controls-position="right"
            class="price-input"
          />
        </el-form-item>
        <el-form-item label="调整原因" required>
          <el-input
            v-model="adjustForm.changeReason"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="请填写财务调整依据或原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitting" @click="submitAdjust">
          保存调整
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  adjustFinanceCuBasePrice,
  fetchFinanceCuBasePrices,
  initializeFinanceCuBasePrices,
} from '../api/financeQuoteBasePrice'
import { useUserStore } from '../store/modules/user'
import {
  FINANCE_CU_DEFAULT_PRICE_PER_TON,
  FINANCE_CU_MAX_PRICE_PER_TON,
  addMonths,
  currentMonthText,
  formatDateTime,
  formatPricePerTon,
  hasFinanceCuEditPermission,
  initializationResultMessage,
  validateChangeReason,
  validateMonthRange,
  validatePricePerTon,
} from './financeCuBasePriceUtils'

const userStore = useUserStore()
const defaultPricePerTon = FINANCE_CU_DEFAULT_PRICE_PER_TON
const maxPricePerTon = FINANCE_CU_MAX_PRICE_PER_TON
const currentMonth = currentMonthText()

const loading = ref(false)
const rows = ref([])
const filters = ref({
  startMonth: currentMonth,
  endMonth: addMonths(currentMonth, 11),
})

const initializeDialogVisible = ref(false)
const initializeSubmitting = ref(false)
const initializeForm = ref({
  monthFrom: currentMonth,
  monthTo: addMonths(currentMonth, 5),
  pricePerTon: defaultPricePerTon,
})

const adjustDialogVisible = ref(false)
const adjustSubmitting = ref(false)
const adjustingRow = ref(null)
const adjustForm = ref({ pricePerTon: defaultPricePerTon, changeReason: '' })

const canEdit = computed(() => hasFinanceCuEditPermission(userStore.permissions))
const currentBusinessUnit = computed(
  () => userStore.businessUnitType || rows.value[0]?.businessUnitType || '',
)

const loadRows = async () => {
  loading.value = true
  try {
    const data = await fetchFinanceCuBasePrices({
      startMonth: filters.value.startMonth,
      endMonth: filters.value.endMonth,
    })
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    rows.value = []
    ElMessage.error(error?.message || '获取财务 Cu 基准失败')
  } finally {
    loading.value = false
  }
}

const queryRows = () => {
  const error = validateMonthRange(filters.value.startMonth, filters.value.endMonth)
  if (error) {
    ElMessage.warning(error)
    return
  }
  loadRows()
}

const resetFilters = () => {
  filters.value = { startMonth: currentMonth, endMonth: addMonths(currentMonth, 11) }
  loadRows()
}

const openInitializeDialog = () => {
  initializeForm.value = {
    monthFrom: filters.value.startMonth || currentMonth,
    monthTo: addMonths(filters.value.startMonth || currentMonth, 5),
    pricePerTon: defaultPricePerTon,
  }
  initializeDialogVisible.value = true
}

const submitInitialize = async () => {
  const monthError = validateMonthRange(
    initializeForm.value.monthFrom,
    initializeForm.value.monthTo,
  )
  const priceError = validatePricePerTon(initializeForm.value.pricePerTon)
  if (monthError || priceError) {
    ElMessage.warning(monthError || priceError)
    return
  }
  initializeSubmitting.value = true
  try {
    const result = await initializeFinanceCuBasePrices(initializeForm.value)
    const message = initializationResultMessage(result)
    if (Number(result?.skippedCount || 0) > 0) {
      ElMessage.warning(message)
    } else {
      ElMessage.success(message)
    }
    initializeDialogVisible.value = false
    filters.value = {
      startMonth: initializeForm.value.monthFrom,
      endMonth: initializeForm.value.monthTo,
    }
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '批量初始化财务 Cu 基准失败')
  } finally {
    initializeSubmitting.value = false
  }
}

const openAdjustDialog = (row) => {
  adjustingRow.value = row
  adjustForm.value = {
    pricePerTon: Number(row.pricePerTon),
    changeReason: '',
  }
  adjustDialogVisible.value = true
}

const submitAdjust = async () => {
  if (!adjustingRow.value) return
  const priceError = validatePricePerTon(adjustForm.value.pricePerTon)
  const reasonError = validateChangeReason(adjustForm.value.changeReason)
  if (priceError || reasonError) {
    ElMessage.warning(priceError || reasonError)
    return
  }
  adjustSubmitting.value = true
  try {
    await adjustFinanceCuBasePrice(adjustingRow.value.id, adjustForm.value)
    ElMessage.success(`${adjustingRow.value.priceMonth}财务 Cu 基准调整成功`)
    adjustDialogVisible.value = false
    await loadRows()
  } catch (error) {
    ElMessage.error(error?.message || '调整财务 Cu 基准失败')
  } finally {
    adjustSubmitting.value = false
  }
}

onMounted(loadRows)
</script>

<style scoped>
.finance-cu-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.hero-card {
  border-top: 3px solid #c58a21;
}

.hero-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.page-title {
  color: #17233d;
  font-size: 22px;
  font-weight: 700;
}

.page-subtitle {
  margin-top: 8px;
  color: #667085;
  font-size: 14px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.filter-card :deep(.el-card__body) {
  padding-bottom: 2px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card strong {
  color: #17233d;
  font-size: 20px;
}

.summary-label,
.readonly-text {
  color: #667085;
  font-size: 13px;
}

.price-value {
  color: #9a6700;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.dialog-alert,
.adjust-summary {
  margin-bottom: 20px;
}

.price-input {
  width: 260px;
}

@media (max-width: 900px) {
  .hero-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
