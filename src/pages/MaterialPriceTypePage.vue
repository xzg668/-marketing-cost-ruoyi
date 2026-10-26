<template>
  <div class="base-page">
    <el-card shadow="never">
      <div class="page-heading">
        <h2>物料价格类型对照</h2>
        <el-button v-if="returnToWorkbenchVisible" @click="returnToWorkbench">返回核算工作台</el-button>
      </div>
      <el-form :inline="true" @submit.prevent="applyFilters">
        <el-form-item label="月份">
          <el-date-picker v-model="filters.period" type="month" value-format="YYYY-MM" :clearable="false" />
        </el-form-item>
        <el-form-item label="取价组织">
          <el-input v-model="filters.priceOrgCode" placeholder="全部组织" clearable />
        </el-form-item>
        <el-form-item label="料号">
          <el-input v-model="filters.materialCode" placeholder="输入料号" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
      <p class="hint">未指定时按系统顺序自动取价；财务指定后仅使用该类型。已有适用月价继续复用。</p>
    </el-card>

    <el-card shadow="never">
      <el-alert v-if="listError" :title="listError" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="tableRows" row-key="id" stripe>
        <el-table-column label="料号" min-width="140">
          <template #default="{ row }">{{ row.configuration.scope.materialCode }}</template>
        </el-table-column>
        <el-table-column prop="materialName" label="名称" min-width="140" />
        <el-table-column label="组织" width="85">
          <template #default="{ row }">{{ row.configuration.scope.priceOrgCode }}</template>
        </el-table-column>
        <el-table-column label="月份" width="100">
          <template #default="{ row }">{{ row.configuration.scope.period }}</template>
        </el-table-column>
        <el-table-column label="取价方式" min-width="330">
          <template #default="{ row }">
            <div v-if="row.configuration.manual">财务指定：{{ priceTypeLabel(row.configuration.order[0].type) }}</div>
            <div v-else>{{ row.configuration.order.map(item => priceTypeLabel(item.type)).join(' → ') }} → 订单价 → 阶梯价 → 补录固定价</div>
            <span class="hint">{{ row.configuration.manual ? '仅按指定类型取价' : '系统自动取价' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近取价" min-width="190">
          <template #default="{ row }">
            <template v-if="row.latestPriceSource">
              <div>{{ priceTypeLabel(row.latestPriceSource) }}</div>
              <div class="hint">{{ row.latestOaNo }} · {{ formatTime(row.latestResolvedAt) }}</div>
              <el-tag v-if="!row.currentPriorityApplied" size="small" type="warning">需重新准备</el-tag>
            </template>
            <span v-else class="hint">尚未取价</span>
          </template>
        </el-table-column>
        <el-table-column v-if="canEdit" label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :disabled="saving" @click="openEdit(row)">指定类型</el-button>
            <el-button link :disabled="saving || !row.configuration.manual" @click="restoreDefault(row)">恢复自动</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="listError ? '查询失败，请重试' : '暂无对照，报价准备后生成'" />
        </template>
      </el-table>
      <BasePagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
    </el-card>

    <el-dialog v-model="dialogVisible" title="指定价格类型" width="520px" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <p v-if="editingRow" class="scope-label">
        {{ editingRow.configuration.scope.materialCode }} · {{ editingRow.configuration.scope.priceOrgCode }} · {{ editingRow.configuration.scope.period }}
      </p>
      <el-alert v-if="editError" :title="editError" type="error" :closable="false" show-icon />
      <el-select v-model="selectedType" placeholder="请选择价格类型" :disabled="saving || conflict" style="width: 100%">
        <el-option v-for="option in priceTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <p class="hint">指定类型没有适用价格时提示缺价，不自动改用其他类型。</p>
      <template #footer>
        <el-button :disabled="saving" @click="dialogVisible = false">取消</el-button>
        <el-button v-if="conflict" type="primary" @click="refreshConfiguration">刷新配置</el-button>
        <el-button v-else type="primary" :loading="saving" @click="saveType">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import { useUserStore } from '../store/modules/user'
import { fetchMaterialPriceTypes, updateMaterialPricePriority } from '../api/materialPriceTypes'
import { businessPricingMonth, financePriceOrder, priceTypeOptions, priceTypeLabel } from './materialPricePriorityUtils'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const canEdit = computed(() => user.permissions.includes('*:*:*') || user.permissions.includes('base:material-price-type:edit'))
const returnTarget = computed(() => String(route.query.returnTo || ''))
const returnToWorkbenchVisible = computed(() => returnTarget.value.startsWith('/') && !returnTarget.value.startsWith('//'))
const returnToWorkbench = () => { if (returnToWorkbenchVisible.value) router.push(returnTarget.value) }
const defaultFilters = () => ({ period: businessPricingMonth(), priceOrgCode: '', materialCode: '' })
const filters = ref(defaultFilters())
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const listError = ref('')
const dialogVisible = ref(false)
const editingRow = ref(null)
const selectedType = ref('')
const editError = ref('')
const saving = ref(false)
const conflict = ref(false)
let querySequence = 0

const formatTime = value => String(value || '').replace('T', ' ').slice(0, 16)
const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')

function applyRouteMaterialCode() {
  filters.value.materialCode = String(route.query.materialCode || '').trim()
  filters.value.priceOrgCode = String(route.query.priceOrgCode || '').trim()
  const period = String(route.query.periodMonth || route.query.period || '')
  filters.value.period = validMonth(period) ? period : businessPricingMonth()
}

async function fetchList() {
  const sequence = ++querySequence
  listError.value = ''
  if (!validMonth(filters.value.period)) {
    tableRows.value = []
    total.value = 0
    loading.value = false
    listError.value = '请选择有效月份'
    return
  }
  loading.value = true
  try {
    const data = await fetchMaterialPriceTypes({
      period: filters.value.period,
      priceOrgCode: filters.value.priceOrgCode.trim(),
      materialCode: filters.value.materialCode.trim(),
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    if (sequence !== querySequence) return
    tableRows.value = data.list
    total.value = data.total
  } catch (error) {
    if (sequence !== querySequence) return
    tableRows.value = []
    total.value = 0
    listError.value = error?.message || '查询失败，请重试'
  } finally {
    if (sequence === querySequence) loading.value = false
  }
}

function applyFilters() {
  if (currentPage.value === 1) fetchList()
  else currentPage.value = 1
}

function resetFilters() {
  filters.value = defaultFilters()
  applyFilters()
}

function openEdit(row) {
  editingRow.value = row
  selectedType.value = row.configuration.order[0].type
  editError.value = ''
  conflict.value = false
  dialogVisible.value = true
}

async function saveType() {
  if (saving.value || conflict.value || !editingRow.value) return
  let order
  try { order = financePriceOrder(selectedType.value); editError.value = '' }
  catch (error) { editError.value = error.message; return }
  saving.value = true
  try {
    await updateMaterialPricePriority(editingRow.value.id, {
      expectedRevision: editingRow.value.configuration.revision,
      order,
    })
    dialogVisible.value = false
    ElMessage.success('指定价格类型已保存，相关报价需重新准备价格')
    await fetchList()
  } catch (error) {
    conflict.value = Number(error?.resultCode) === 409
    editError.value = conflict.value ? '配置已被其他人修改，请刷新后重新调整' : (error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function refreshConfiguration() {
  dialogVisible.value = false
  fetchList()
}

async function restoreDefault(row) {
  if (saving.value) return
  saving.value = true
  try {
    await updateMaterialPricePriority(row.id, {
      expectedRevision: row.configuration.revision,
      restoreDefault: true,
    })
    ElMessage.success('已恢复自动取价，相关报价需重新准备价格')
    await fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '恢复默认失败')
    if (Number(error?.resultCode) === 409) await fetchList()
  } finally {
    saving.value = false
  }
}

watch(currentPage, fetchList)
watch(pageSize, applyFilters)
watch(() => route.query, () => { applyRouteMaterialCode(); applyFilters() })
onMounted(() => { applyRouteMaterialCode(); fetchList() })
</script>

<style scoped>
.base-page { display: grid; gap: 16px; }
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.hint { color: #64748b; font-size: 12px; line-height: 1.7; }
p.hint { margin: 0; }
.scope-label { color: #475569; }
.el-alert { margin-bottom: 12px; }
</style>
