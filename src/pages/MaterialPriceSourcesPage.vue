<template>
  <div class="base-page">
    <el-card shadow="never">
      <div class="heading"><h2>物料多形态属性价格表</h2><div><el-button :loading="exporting" :disabled="loading || refreshing" @click="exportSources">导出 Excel</el-button><el-button v-if="canRefresh" type="primary" :loading="refreshing" @click="refreshSources">更新</el-button></div></div>
      <el-form :inline="true" @submit.prevent="search">
        <el-form-item label="价格月份"><el-date-picker v-model="filter.month" type="month" value-format="YYYY-MM" placeholder="最新资料月份" /></el-form-item>
        <el-form-item label="料号"><el-input v-model="filter.materialCode" placeholder="输入料号" clearable /></el-form-item>
        <el-form-item label="组织"><el-select v-model="filter.organization" clearable placeholder="全部组织" style="width:135px"><el-option label="210 商用" value="210" /><el-option label="220 板换" value="220" /></el-select></el-form-item>
        <el-form-item label="料号属性"><el-select v-model="filter.materialAttribute" clearable placeholder="全部属性" style="width:150px"><el-option v-for="item in attributeFilterOptions" :key="item.value" :label="item.label" :value="item.value" /><el-option label="未选择" value="EMPTY" /></el-select></el-form-item>
        <el-form-item><el-button type="primary" native-type="submit" :loading="loading">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <p class="hint">每天北京时间凌晨4点按资料所属月份更新；财务可点击“更新”读取最新导入资料。更新保留各月份已选属性。</p>
      <p class="hint" aria-label="清单更新时间">{{ refreshState?.refreshedAt ? `本月表最近更新：${formatTime(refreshState.refreshedAt)}，${refreshState.materialCount}个物料、${refreshState.sourceCount}条来源` : '该月份尚未生成清单，可由财务点击“更新”。' }}</p>
    </el-card>
    <el-card shadow="never">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
      <div v-if="canEdit" class="heading" style="margin-bottom:12px">
        <span>已选 {{ selectedRows.length }} 条来源</span>
        <div><el-select v-model="batchAttribute" placeholder="批量设置料号属性" style="width:190px" :disabled="batchSaving"><el-option v-for="item in attributeOptions" :key="item.value" :label="item.label" :value="item.value" /><el-option label="清除属性" value="CLEAR" /></el-select>
        <el-button type="primary" :loading="batchSaving" :disabled="!selectedRows.length || !batchAttribute || loading || refreshing" @click="saveBatch">批量保存</el-button></div>
      </div>
      <el-table v-loading="loading" :data="rows" :row-key="rowKey" stripe border aria-label="物料价格来源汇总" @selection-change="value => selectedRows = value">
        <el-table-column v-if="canEdit" type="selection" width="48" :selectable="row => !row.automatic && !batchSaving" />
        <el-table-column prop="materialCode" label="料号" min-width="165" fixed />
        <el-table-column prop="materialModel" label="型号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="materialSpec" label="规格" min-width="140" show-overflow-tooltip />
        <el-table-column prop="materialName" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="organization" label="组织" width="80" />
        <el-table-column prop="organizationName" label="组织名称" min-width="210" show-overflow-tooltip />
        <el-table-column prop="sourceLabel" label="来源地方" width="115" />
        <el-table-column label="价格" min-width="250"><template #default="{ row }">
          <div v-for="(price, index) in row.prices.slice(0, 2)" :key="index" class="price">
            <strong>{{ price.value ?? (row.sourceType === 'MAKE' ? '自制缺价' : '待生成') }}</strong><span v-if="price.value != null"> {{ price.currency || '' }} · {{ taxLabel(price.taxBasis) }}</span>
            <div v-if="price.supplierName" class="hint">{{ price.supplierName }}</div>
          </div>
          <span v-if="!row.prices.length">待生成</span>
          <el-button v-if="row.prices.length" link type="primary" @click="priceDetail = row">价格明细{{ row.prices.length > 1 ? `（${row.prices.length}条）` : '' }}</el-button>
        </template></el-table-column>
        <el-table-column label="单位" width="110"><template #default="{ row }">{{ [...new Set(row.prices.map(price => price.unit).filter(Boolean))].join('／') || '未注明' }}</template></el-table-column>
        <el-table-column label="料号属性" min-width="175" fixed="right"><template #default="{ row }">
          <el-tag v-if="row.automatic" type="success">自制件</el-tag>
          <el-select v-else-if="canEdit" :model-value="row.materialAttribute || ''" clearable placeholder="请选择" style="width:150px"
            :disabled="batchSaving || loading || refreshing || saving.has(rowKey(row))" :aria-label="`${row.materialCode} ${row.sourceLabel} 料号属性`" @change="value => save(row, value)">
            <el-option v-for="item in attributeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <span v-else>{{ attributeLabel(row.materialAttribute) }}</span>
          <div v-if="row.automatic" class="hint">由计价BOM带入</div>
        </template></el-table-column>
        <template #empty><el-empty :description="error ? '查询失败，请重试' : '当前条件下没有已生成的多来源记录'" /></template>
      </el-table>
      <BasePagination v-model:current-page="filter.page" v-model:page-size="filter.size" :total="total" />
    </el-card>
    <el-dialog :model-value="!!priceDetail" title="来源价格明细" width="min(1100px, 95vw)" @close="priceDetail = null">
      <p v-if="priceDetail">{{ priceDetail.materialCode }} · {{ priceDetail.sourceLabel }} · {{ displayedMonth }}</p>
      <el-table :data="priceDetail?.prices || []" border>
        <el-table-column label="价格" min-width="170"><template #default="{ row }">{{ row.value ?? '待生成' }}</template></el-table-column>
        <el-table-column prop="unit" label="单位" width="90" /><el-table-column prop="currency" label="币种" width="80" />
        <el-table-column label="税口径" width="110"><template #default="{ row }">{{ taxLabel(row.taxBasis) }}</template></el-table-column>
        <el-table-column prop="supplierCode" label="供应商编码" min-width="130" /><el-table-column prop="supplierName" label="供应商名称" min-width="180" />
        <el-table-column prop="condition" label="适用条件／依据" min-width="200" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import { useUserStore } from '../store/modules/user'
import { fetchMaterialPriceSources, updateMaterialPriceAttribute, updateMaterialPriceAttributes, refreshMaterialPriceSources } from '../api/materialPriceSources'
import { downloadAuthenticatedBlob } from '../utils/auxiliaryClassification'

const user = useUserStore()
const financeRole = computed(() => user.roles.some(role => ['admin', 'bu_director', 'finance_reviewer'].includes(role)))
const allowed = permission => financeRole.value && (user.permissions.includes('*:*:*') || user.permissions.includes(permission))
const hasPermission = permission => user.permissions.includes('*:*:*') || user.permissions.includes(permission)
const canEdit = computed(() => allowed('price:material-sources:edit') ||
  (hasPermission('price:material-sources:list') && hasPermission('quote:costing:bom:alternative-select')))
const canRefresh = computed(() => allowed('price:material-sources:refresh'))
const attributeOptions = [{ value: 'PURCHASE', label: '采购件' }, { value: 'OUTSOURCE', label: '委外加工件' }]
const attributeFilterOptions = [{ value: 'MANUFACTURE', label: '自制件' }, ...attributeOptions]
const defaults = () => ({ month: '', materialCode: '', organization: '', materialAttribute: '', page: 1, size: 20 })
const filter = reactive(defaults())
const rows = ref([]), total = ref(0), loading = ref(false), error = ref(''), refreshState = ref(null), refreshing = ref(false), priceDetail = ref(null)
const selectedRows = ref([]), batchAttribute = ref(''), batchSaving = ref(false)
const exporting = ref(false)
const saving = reactive(new Set())
const rowKey = row => `${row.organization}:${row.materialCode}:${row.sourceType}`
const attributeLabel = value => attributeFilterOptions.find(item => item.value === value)?.label || ''
const taxLabel = value => ({ INCLUDED: '含税', EXCLUDED: '不含税' }[value] || '税口径未注明')
const formatTime = value => String(value).replace('T', ' ').slice(0, 19)
let requestVersion = 0
let displayedMonth = ''

async function load() {
  const version = ++requestVersion
  const params = { ...filter }
  loading.value = true; error.value = ''; priceDetail.value = null; selectedRows.value = []
  try {
    const result = await fetchMaterialPriceSources(params)
    if (version !== requestVersion) return
    rows.value = result.rows; total.value = result.total; refreshState.value = result.refresh
    displayedMonth = result.month || params.month
    filter.month = displayedMonth
  } catch (cause) {
    if (version !== requestVersion) return
    rows.value = []; total.value = 0; error.value = cause?.message || '价格来源查询失败，请重试'
  } finally { if (version === requestVersion) loading.value = false }
}
async function saveBatch() {
  if (batchSaving.value || !selectedRows.value.length || !batchAttribute.value) return
  batchSaving.value = true
  try {
    await updateMaterialPriceAttributes(selectedRows.value.map(row => ({ month: displayedMonth,
      organization: row.organization, materialCode: row.materialCode, sourceType: row.sourceType,
      materialAttribute: batchAttribute.value === 'CLEAR' ? null : batchAttribute.value, expectedVersion: row.version })))
    ElMessage.success('所选来源的料号属性已保存')
    await load()
  } catch (cause) { ElMessage.error(cause?.message || '批量保存失败，请刷新后重试'); await load() }
  finally { batchSaving.value = false }
}
function search() { if (filter.page === 1) load(); else filter.page = 1 }
function reset() { Object.assign(filter, defaults()); search() }
async function exportSources() {
  if (exporting.value) return
  exporting.value = true
  try {
    const params = new URLSearchParams({ month: filter.month || displayedMonth || '', materialCode: filter.materialCode,
      organization: filter.organization, materialAttribute: filter.materialAttribute })
    await downloadAuthenticatedBlob(`/api/v1/material-price-sources/export?${params}`, `物料多形态属性价格表_${filter.month || displayedMonth || '全部'}.xlsx`)
  } catch (cause) { ElMessage.error(cause?.message || '导出失败，请重试') }
  finally { exporting.value = false }
}
async function refreshSources() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const result = await refreshMaterialPriceSources()
    ElMessage.success(`已更新${result.months}个月份，共${result.sourceRows}条来源`)
    await load()
  } catch (cause) { ElMessage.error(cause?.message || '更新失败，原清单保留') }
  finally { refreshing.value = false }
}
async function save(row, value) {
  const key = rowKey(row)
  if (saving.has(key)) return
  saving.add(key)
  const version = requestVersion
  try {
    const updated = await updateMaterialPriceAttribute({ month: displayedMonth, organization: row.organization, materialCode: row.materialCode,
      sourceType: row.sourceType, materialAttribute: value || null, expectedVersion: row.version })
    if (version === requestVersion) Object.assign(row, updated)
    ElMessage.success('料号属性已保存')
    if (filter.materialAttribute) await load()
  } catch (cause) { ElMessage.error(cause?.message || '保存失败，请重试'); await load() }
  finally { saving.delete(key) }
}
watch(() => [filter.page, filter.size], load)
watch(() => user.businessUnitType, () => { rows.value = []; filter.month = ''; search() })
onMounted(load)
</script>

<style scoped>
h2 { margin: 0; font-size: 20px; }
.heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.hint { margin: 5px 0; color: #64748b; font-size: 12px; line-height: 1.6; }
.price { margin: 5px 0; font-size: 12px; }
</style>
