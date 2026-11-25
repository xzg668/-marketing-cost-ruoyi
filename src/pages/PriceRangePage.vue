<template>
  <div class="range-page price-source-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">
          区间价
          <el-button v-if="returnToWorkbenchVisible" link @click="returnToWorkbench">返回核算工作台</el-button>
        </div>
        <div class="filter-actions">
          <el-button v-hasPermi="['price:range:import']" @click="openMaintenance('template')">下载模板数据</el-button>
          <el-button v-hasPermi="['price:range:import']" @click="openOriginalImport">导入</el-button>
          <el-button v-hasPermi="['price:range:add']" type="primary" @click="openMaintenance('add')">新增</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="auto" class="price-search-form" @submit.prevent="applyFilters">
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="请输入物料代码" />
        </el-form-item>
        <el-form-item label="型号"><el-input v-model="filters.model" placeholder="输入型号，支持部分匹配" clearable @keyup.enter="applyFilters" @clear="applyFilters" /></el-form-item>
        <el-form-item label="帐期">
          <el-date-picker
            v-model="filters.effectiveFrom"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            :clearable="false"
            placeholder="请选择帐期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button v-if="canManageImports" @click="historyOpen = true">导入记录</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="materialName" label="名称" min-width="140" />
        <el-table-column prop="materialCode" label="U9代码" width="160" />
        <el-table-column prop="supplierName" label="供应商" min-width="200" />
        <el-table-column prop="supplierCode" label="供应商代码" width="130" />
        <el-table-column prop="specModel" label="图号" width="160" />
        <el-table-column label="区间类型" width="120">
          <template #default="{ row }">
            {{ formatRangeType(row) }}
          </template>
        </el-table-column>
        <el-table-column label="区间" width="180">
          <template #default="{ row }">
            {{ formatRange(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="priceExclTax" label="原档未税价" width="120" />
        <el-table-column label="财务有效未税价" width="155">
          <template #default="{ row }">
            <template v-if="row.rangeBasis === 'FACTOR' && row.sourceCellRef">
              <el-tooltip v-if="effectivePrices[row.factorRuleId]?.message" :content="effectivePrices[row.factorRuleId].message">
                <span>{{ effectivePriceStatusLabel(effectivePrices[row.factorRuleId]?.status) }}</span>
              </el-tooltip>
              <span v-else>{{ priceText(effectivePrices[row.factorRuleId]?.unitPrice) }}</span>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="财务命中档" min-width="175"><template #default="{ row }">{{ rangeText(effectivePrices[row.factorRuleId]?.selectedBounds) }}</template></el-table-column>
        <el-table-column prop="priceInclTax" label="含税价" width="120" />
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            {{ formatCurrentStatus(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="178" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.rangeBasis === 'FACTOR' && row.sourceCellRef" link type="primary" @click="originalRuleId = row.factorRuleId">查看原稿</el-button>
            <span v-else-if="row.rangeBasis === 'FACTOR'">历史行情</span>
            <el-button v-if="row.rangeBasis !== 'FACTOR'" v-hasPermi="['price:range:edit']" type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button v-if="row.rangeBasis !== 'FACTOR'" v-hasPermi="['price:range:remove']" type="danger" link @click="removeRow(row)">
              删除
            </el-button>
            <PriceRowVoidButton v-if="canManageImports" :path="`/api/v1/price-range/items/rows/${row.id}/void`"
              :description="[row.materialCode, row.supplierName, formatRange(row)].filter(Boolean).join(' / ')"
              @withdrawn="fetchList" />
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <PriceImportHistory v-if="canManageImports && historyScope" v-model="historyOpen" :scope="historyScope" row-label="导入行数"
      :fetch="fetchRangeImports" :download="downloadRangeImport" :withdraw-batch="voidRangeImport"
      @withdrawn="fetchList" />
    <OriginalRangeImportDialog v-model="originalImportVisible" :initial-month="importMonth"
      :supplement-rule-id="supplementRuleId" @imported="refreshAfterImport" />
    <RangeBandDialog v-if="maintenanceMode" :mode="maintenanceMode" :month="maintenanceMonth"
      :initial-material-code="filters.materialCode" @close="maintenanceMode = null"
      @added="finishAddition" @downloaded="rememberTemplate" />
    <OriginalPriceDetailDialog kind="range" :pricing-month="filters.effectiveFrom" :rule-id="originalRuleId" @close="originalRuleId = null" />
    <el-dialog v-model="dialogVisible" title="编辑区间价" width="680px">
      <el-form :model="formModel" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="物料名称">
              <el-input v-model="formModel.materialName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物料代码">
              <el-input v-model="formModel.materialCode" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="规格型号">
              <el-input v-model="formModel.specModel" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="区间下限">
              <el-input v-model="formModel.rangeLow" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="区间上限">
              <el-input v-model="formModel.rangeHigh" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="不含税价">
              <el-input v-model="formModel.priceExclTax" placeholder="元/米" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="含税价">
              <el-input v-model="formModel.priceInclTax" placeholder="元/米" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生效日期">
              <el-date-picker
                v-model="formModel.effectiveFrom"
                type="date"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import PriceRowVoidButton from '../components/PriceRowVoidButton.vue'
import PriceImportHistory from '../components/PriceImportHistory.vue'
import { useUserStore } from '../store/modules/user'
import { fetchRangeImports, downloadRangeImport, voidRangeImport } from '../api/priceRangeItems'
import '../styles/priceSources.css'
import { fetchRangeEffectivePrices } from '../api/originalPriceTrials'
import { effectivePriceStatusLabel, priceText, rangeText } from '../components/originalPriceDisplay'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import OriginalRangeImportDialog from '../components/OriginalRangeImportDialog.vue'
import OriginalPriceDetailDialog from '../components/OriginalPriceDetailDialog.vue'
import RangeBandDialog from '../components/RangeBandDialog.vue'
import {
  fetchRangeItems,
  updateRangeItem,
  deleteRangeItem,
} from '../api/priceRangeItems'
import { formatCurrentStatus, formatRangeType, formatRange } from './priceRangeImportUtils'

const historyUser = useUserStore()
const historyOpen = ref(false)
const historyScope = computed(() => historyUser.userId && historyUser.businessUnitType ? `${historyUser.userId}/${historyUser.businessUnitType}` : '')
const canManageImports = computed(() => historyUser.permissions?.some(value => ['*:*:*', 'price:range:import'].includes(value)))
watch([historyScope, canManageImports], () => { historyOpen.value = false }, { flush: 'sync' })

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const originalImportVisible = ref(false)
const originalRuleId = ref(null)
const supplementRuleId = ref(null)
const importMonth = ref('')
const maintenanceMode = ref(null)
const maintenanceMonth = ref('')
const lastTemplate = ref(null)
const dialogVisible = ref(false)
const editingId = ref(null)

const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
const filters = ref({
  model: String(route.query.model || ''),
  materialCode: '',
  effectiveFrom: currentMonth(),
})
const returnToWorkbenchVisible = computed(() => Boolean(route.query.returnTo))

const returnToWorkbench = () => {
  const target = String(route.query.returnTo || '')
  if (!target) return
  router.push(target)
}

const applyRouteContext = () => {
  const materialCode = String(route.query.materialCode || '').trim()
  const pricingMonth = String(route.query.pricingMonth || route.query.periodMonth || '').trim()
  if (materialCode) filters.value.materialCode = materialCode
  if (pricingMonth) filters.value.effectiveFrom = pricingMonth
}

const formModel = ref({})

const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const buildParams = () => ({
  specModel: filters.value.model?.trim(),
  materialCode: filters.value.materialCode.trim(),
  effectiveFrom: filters.value.effectiveFrom || '',
  page: currentPage.value,
  pageSize: pageSize.value,
})

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const fullMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`
  }
  const ymMatch = text.match(/(\d{4})[-/.](\d{1,2})$/)
  if (ymMatch) {
    return `${ymMatch[1]}-${ymMatch[2].padStart(2, '0')}-01`
  }
  const yearMatch = text.match(/^(\d{4})$/)
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`
  }
  return text.replace(/\//g, '-')
}

const effectivePrices = ref({})
let listRequest = 0
const fetchList = async () => {
  const current = ++listRequest
  const pricingMonth = filters.value.effectiveFrom
  loading.value = true
  effectivePrices.value = {}
  try {
    const data = await fetchRangeItems(buildParams())
    if (current !== listRequest) return
    tableRows.value = data?.list || []
    total.value = data?.total || 0
    const ids = [...new Set(tableRows.value.filter(row => row.rangeBasis === 'FACTOR' && row.sourceCellRef).map(row => row.factorRuleId))]
    if (ids.length) {
      try {
        const prices = await fetchRangeEffectivePrices(ids, pricingMonth)
        if (current === listRequest) effectivePrices.value = Object.fromEntries(prices.map(row => [row.originalId, row]))
      } catch (error) {
        if (current === listRequest) effectivePrices.value = Object.fromEntries(ids.map(id => [id, { status: 'ERROR', message: error?.message || '有效价读取失败' }]))
      }
    }
  } catch (error) {
    if (current !== listRequest) return
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询失败')
  } finally {
    if (current === listRequest) loading.value = false
  }
}

watch(currentPage, () => fetchList())

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

const applyFilters = () => {
  router.replace({ path: route.path, query: { ...route.query, materialCode: filters.value.materialCode?.trim() || undefined, model: filters.value.model?.trim() || undefined } })
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
  model: '',
    materialCode: '',
    effectiveFrom: currentMonth(),
  }
  applyFilters()
}

const openOriginalImport = () => {
  importMonth.value = filters.value.effectiveFrom
  supplementRuleId.value = lastTemplate.value?.month === importMonth.value ? lastTemplate.value.id : null
  originalImportVisible.value = true
}

const openMaintenance = (mode) => {
  maintenanceMonth.value = filters.value.effectiveFrom
  maintenanceMode.value = mode
}

const rememberTemplate = (option) => {
  lastTemplate.value = option ? { id: option.id, month: maintenanceMonth.value } : null
  maintenanceMode.value = null
}

const finishAddition = () => {
  maintenanceMode.value = null
  refreshAfterImport()
}

const refreshAfterImport = () => {
  lastTemplate.value = null
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    materialName: row.materialName ?? '',
    materialCode: row.materialCode ?? '',
    specModel: row.specModel ?? '',
    rangeLow: row.rangeLow ?? '',
    rangeHigh: row.rangeHigh ?? '',
    priceExclTax: row.priceExclTax ?? '',
    priceInclTax: row.priceInclTax ?? '',
    effectiveFrom: row.effectiveFrom ?? '',
  }
  dialogVisible.value = true
}

const submitRow = async () => {
  const payload = {
    materialName: formModel.value.materialName.trim(),
    materialCode: formModel.value.materialCode.trim(),
    specModel: formModel.value.specModel.trim(),
    rangeLow: parseNumber(formModel.value.rangeLow),
    rangeHigh: parseNumber(formModel.value.rangeHigh),
    priceExclTax: parseNumber(formModel.value.priceExclTax),
    priceInclTax: parseNumber(formModel.value.priceInclTax),
    effectiveFrom: normalizeDate(formModel.value.effectiveFrom),
  }

  if (!payload.materialCode) {
    ElMessage.warning('物料代码必填')
    return
  }
  if (payload.rangeLow === null || payload.rangeHigh === null) {
    ElMessage.warning('区间上下限必填')
    return
  }
  if (payload.priceExclTax === null && payload.priceInclTax === null) {
    ElMessage.warning('不含税价和含税价至少填写一个')
    return
  }

  try {
    await updateRangeItem(editingId.value, payload)
    ElMessage.success('已更新')
    dialogVisible.value = false
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该条区间价记录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }

  try {
    await deleteRangeItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

onMounted(() => {
  applyRouteContext()
  fetchList()
})

</script>

<style scoped>
.range-page {
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
  align-items: center;
  margin-bottom: 12px;
}
.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}
.filter-actions {
  display: flex;
  gap: 8px;
}
</style>
