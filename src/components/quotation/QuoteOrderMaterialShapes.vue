<template>
  <section v-loading="loading" class="order-material-shapes">
    <p>本单只选择物料采用形态，所有涉及产品按各自 BOM 用量核算。价格来源的形态属性由财务在“物料多形态属性价格表”维护；沿用 BOM 默认形态的物料按原规则取价。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="view.problems.length" type="warning" :closable="false" :title="`${view.problems.length} 个产品的 BOM 尚未齐全，暂未计入汇总；补齐后沿用本单选择并校验`">
      <div v-for="problem in view.problems" :key="problem.itemId">{{ problem.productCode || problem.itemId }}：{{ problem.message }}</div>
    </el-alert>
    <div class="shape-actions">
      <el-input v-model="search" placeholder="筛选料号或名称" clearable style="width:230px" />
      <el-button :disabled="saving || refreshing" @click="load">刷新物料来源</el-button>
      <span v-if="refreshing" role="status" class="refresh-note">正在更新物料来源…</span>
      <el-button v-if="refreshRequired && !refreshing" :disabled="saving" @click="clearDrafts(); load()">重新加载并清除未保存选择</el-button>
      <template v-if="canEdit">
        <span class="selection-summary">已勾选 {{ selected.length }} 个物料</span>
        <el-select v-model="batchShape" placeholder="批量选择形态" style="width:170px" :disabled="saving">
          <el-option v-for="(label, shape) in labels" :key="shape" :label="label" :value="shape"
            :disabled="shape !== 'DEFAULT' && selected.some(row => !row.allowedShapes.includes(shape))" />
        </el-select>
        <el-button :disabled="saving || !selected.length || !batchShape" @click="applyBatch">应用到勾选物料</el-button>
        <el-button :loading="saving" :disabled="!changes.length || busy || refreshing || refreshRequired" @click="save(false)">保存选择</el-button>
        <el-button type="primary" :loading="saving" :disabled="!changes.length || busy || refreshing || refreshRequired" @click="save(true)">保存并整单核算</el-button>
      </template>
    </div>
    <el-table :data="filteredRows" :row-key="rowKey" border max-height="620" @selection-change="selected = $event">
      <el-table-column v-if="canEdit" type="selection" width="48" :selectable="row => !saving && !!row.allowedShapes.length" />
      <el-table-column prop="periodMonth" label="价格月份" width="105" />
      <el-table-column prop="organization" label="组织" width="75" />
      <el-table-column prop="materialCode" label="料号" min-width="165" />
      <el-table-column prop="materialName" label="名称" min-width="135" />
      <el-table-column prop="materialSpec" label="规格" min-width="135" show-overflow-tooltip />
      <el-table-column label="价格来源" min-width="240"><template #default="{ row }">
        <div v-for="source in row.sources" :key="source.sourceType">
          <el-tag size="small" :type="source.materialAttribute === currentShape(row) ? 'success' : 'info'">{{ labels[source.materialAttribute] || '财务未分类' }}</el-tag>
          <el-tooltip :content="source.prices.map(price => [price.supplierName || price.supplierCode, priceText(price), price.condition].filter(Boolean).join(' · ')).join('；') || '价格按实际核算条件取得'">
            <span>{{ sourceSummary(source) }}</span>
          </el-tooltip>
          <el-tooltip v-if="!source.prices.some(price => price.value != null)" :content="source.prices.map(price => price.condition).filter(Boolean).join('；') || '请按所选形态检查价格资料'">
            <el-tag size="small" type="warning">{{ source.sourceType === 'MAKE' ? '自制缺价' : '待算价' }}</el-tag>
          </el-tooltip>
        </div>
      </template></el-table-column>
      <el-table-column label="影响产品" width="105"><template #default="{ row }">
        <el-popover trigger="click" width="430"><template #reference><el-button link type="primary">{{ new Set(row.products.map(p => p.itemId)).size }} 个产品</el-button></template>
          <div v-for="product in row.products" :key="`${product.itemId}:${product.originalShape}`">{{ product.productCode }} · {{ product.productName }} · 原{{ labels[product.originalShape] || '未知形态' }}</div>
        </el-popover>
      </template></el-table-column>
      <el-table-column label="本单采用形态" min-width="190" fixed="right"><template #default="{ row }">
        <el-select v-if="canEdit && row.allowedShapes.length" :model-value="currentShape(row)"
          :aria-label="`${row.materialCode} 本单采用形态`" :disabled="saving || busy" @change="value => setShape(row, value)">
          <el-option v-for="shape in row.allowedShapes" :key="shape" :label="labels[shape]" :value="shape" />
          <el-option value="DEFAULT" label="沿用各产品BOM默认形态" />
        </el-select>
        <span v-else>{{ labels[row.selectedShape || 'DEFAULT'] }}</span>
        <div v-if="row.legacySelection" class="legacy-note">存在原单品选择，请在此统一维护</div>
      </template></el-table-column>
      <template #empty><p class="table-empty-message" role="status">{{ refreshing ? '正在查找多源物料…' : error ? '读取失败，请重试' : '本单没有符合条件的多源物料' }}</p></template>
    </el-table>
  </section>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { fetchQuoteOrderMaterialShapes, prepareQuoteOrderMaterialShapes, saveQuoteOrderMaterialShapes } from '../../api/quoteRequests'
const props = defineProps({ oaNo: { type: String, required: true }, active: Boolean, readonly: Boolean, busy: Boolean, materialCode: String })
const emit = defineEmits(['saved', 'cost'])
const user = useUserStore()
const permitted = permission => user.permissions.includes('*:*:*') || user.permissions.includes(permission)
const canEdit = computed(() => !props.readonly && (user.roles.some(role => ['admin', 'bu_director', 'bu_staff'].includes(role)) ||
  permitted('quote:costing:bom:alternative-select') ||
  (user.roles.includes('finance_reviewer') && permitted('price:material-sources:edit'))))
const labels = { MANUFACTURE: '自制件', PURCHASE: '采购件', OUTSOURCE: '委外加工件', DEFAULT: '沿用各产品BOM默认形态' }
const view = ref({ rows: [], problems: [], fingerprint: null })
const loading = ref(false), saving = ref(false), error = ref(''), selected = ref([]), batchShape = ref('')
const refreshing = ref(false), refreshRequired = ref(false), hasView = ref(false)
const search = ref(props.materialCode || ''), drafts = reactive({})
const rowKey = row => `${row.periodMonth}:${row.organization}:${row.materialCode}`
const filteredRows = computed(() => view.value.rows.filter(row => `${row.materialCode} ${row.materialName || ''}`.includes(search.value.trim())))
const changes = computed(() => view.value.rows.filter(row => drafts[rowKey(row)] !== undefined).map(row => ({
  periodMonth: row.periodMonth, organization: row.organization, materialCode: row.materialCode,
  selectedShape: drafts[rowKey(row)] === 'DEFAULT' ? null : drafts[rowKey(row)], expectedVersion: row.version,
})))
let generation = 0
function clearDrafts() { Object.keys(drafts).forEach(key => delete drafts[key]); selected.value = [] }
function currentShape(row) { return drafts[rowKey(row)] ?? row.selectedShape ?? 'DEFAULT' }
function priceText(price) {
  if (price.value == null) return '待算价'
  return `${price.value} ${price.currency || 'CNY'}/${price.unit || '单位未注明'}${price.taxBasis === 'INCLUDED' ? ' 含税' : price.taxBasis === 'EXCLUDED' ? ' 不含税' : ''}`
}
function sourceSummary(source) {
  const prices = [...new Set((source.prices || []).filter(price => price.value != null).map(priceText))]
  return `${source.sourceLabel} · ${prices.length ? prices.slice(0, 2).join(' / ') + (prices.length > 2 ? ' 等报价' : '') : source.sourceType === 'MAKE' ? '自制计算' : '待算价'}`
}
async function load() {
  if (!props.oaNo || saving.value || refreshing.value) return
  const current = ++generation, oaNo = props.oaNo
  const isCurrent = () => current === generation && oaNo === props.oaNo
  loading.value = !hasView.value; refreshing.value = true; error.value = ''
  try {
    // Show saved sources promptly, but always discover missing sources/BOMs as well.
    try {
      const existing = await fetchQuoteOrderMaterialShapes(oaNo)
      if (!isCurrent()) return
      installView(existing); hasView.value = true; loading.value = false
    } catch { /* The discovery request can still supply the complete view. */ }
    if (!isCurrent()) return
    const result = await prepareQuoteOrderMaterialShapes(oaNo)
    if (!isCurrent()) return
    installView(result); hasView.value = true
  } catch (failure) {
    if (isCurrent()) {
      refreshRequired.value = true
      error.value = hasView.value ? '更新物料来源失败，已保留清单和未保存选择，请刷新后再保存' : failure?.message || '多源物料读取失败'
    }
  } finally { if (isCurrent()) { loading.value = false; refreshing.value = false } }
}
function installView(result) {
  if (Object.keys(drafts).length && view.value.fingerprint !== result.fingerprint) {
    refreshRequired.value = true
    error.value = '物料或财务属性已更新，未保存选择已保留；请重新加载后再选择'
    return
  }
  view.value = result; refreshRequired.value = false; error.value = ''
}
function setShape(row, shape) {
  if (!canEdit.value || saving.value || props.busy || (shape !== 'DEFAULT' && !row.allowedShapes.includes(shape))) return
  if (!row.legacySelection && (row.selectedShape || 'DEFAULT') === shape) delete drafts[rowKey(row)]
  else drafts[rowKey(row)] = shape
}
function applyBatch() {
  selected.value.forEach(row => setShape(row, batchShape.value))
}
async function save(cost) {
  if (!canEdit.value || saving.value || refreshing.value || refreshRequired.value || props.busy || !changes.value.length) return
  const current = generation, oaNo = props.oaNo
  saving.value = true; error.value = ''
  try {
    const result = await saveQuoteOrderMaterialShapes(oaNo, { expectedFingerprint: view.value.fingerprint, selections: changes.value })
    if (current !== generation || oaNo !== props.oaNo) return
    clearDrafts(); ElMessage.success(`已保存 ${result.changedMaterials} 个物料，涉及 ${result.affectedItemIds.length} 个产品，重新核算后更新成本`)
    emit('saved', result)
    if (cost) emit('cost')
  } catch (failure) { if (current === generation) error.value = failure?.message || '保存失败，请刷新后重试' }
  finally { if (current === generation) { saving.value = false; if (!error.value) await load() } }
}
watch(() => [props.oaNo, props.active], ([number], previous) => {
  generation++; saving.value = false; loading.value = false; refreshing.value = false
  if (number !== previous?.[0]) {
    view.value = { rows: [], problems: [], fingerprint: null }
    hasView.value = false; refreshRequired.value = false; error.value = ''; clearDrafts()
  }
  if (props.active) load()
}, { immediate: true, flush: 'sync' })
watch(() => props.materialCode, value => { search.value = value || '' })
onScopeDispose(() => { generation++ })
</script>
<style scoped>
.order-material-shapes { color: #344054; font-size: 14px; line-height: 1.5; }
.order-material-shapes > p { color: #697386; font-size: 13px; line-height: 1.6; margin: 0 0 12px; }
.shape-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.shape-actions :deep(.el-button) { margin-left: 0; }
.selection-summary { color: #697386; font-size: 13px; font-variant-numeric: tabular-nums; }
.order-material-shapes :deep(th.el-table__cell) { color: #475467; font-weight: 600; background: #f8fafc; }
.order-material-shapes :deep(td.el-table__cell) { padding: 9px 0; }
.order-material-shapes :deep(.el-table__empty-text) { width: 100%; }
.table-empty-message { margin: 0; padding: 24px 16px; color: #697386; font-size: 14px; line-height: 1.6; }
.legacy-note { color: #b88230; font-size: 12px; margin-top: 6px; }
.refresh-note { color: #606266; font-size: 13px; }
</style>
