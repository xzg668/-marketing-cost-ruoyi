<template>
  <section v-loading="loading" class="order-material-shapes">
    <p>在本单选择物料形态和价格源，所有涉及产品按各自 BOM 用量核算。本单选择不修改公共价格表的分类；供应商沿原供货规则确定。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="view.problems.length" type="warning" :closable="false" :title="`${view.problems.length} 个产品的 BOM 尚未齐全，暂未计入汇总；补齐后沿用本单选择并校验`">
      <div v-for="problem in view.problems" :key="problem.itemId">{{ problem.productCode || problem.itemId }}：{{ problem.message }}</div>
    </el-alert>
    <div class="shape-actions">
      <el-input v-model="search" placeholder="筛选料号或名称" clearable style="width:230px" />
      <el-button :disabled="saving" @click="load">刷新物料来源</el-button>
      <template v-if="canEdit">
        <span>已勾选 {{ selected.length }} 个物料</span>
        <el-select v-model="batchShape" placeholder="批量选择形态" style="width:170px" :disabled="saving">
          <el-option v-for="(label, shape) in labels" :key="shape" :label="label" :value="shape"
            :disabled="shape !== 'DEFAULT' && selected.some(row => !row.allowedShapes.includes(shape))" />
        </el-select>
        <el-select v-if="view.sourceSelectionSupported" v-model="batchSource" placeholder="批量选用价格源" clearable style="width:180px" :disabled="saving || !commonSources.length">
          <el-option v-for="source in commonSources" :key="source.sourceType" :label="source.sourceLabel" :value="source.sourceType" />
        </el-select>
        <el-button :disabled="saving || !selected.length || !batchShape" @click="applyBatch">应用到勾选物料</el-button>
        <el-button :loading="saving" :disabled="!changes.length || incomplete || busy" @click="save(false)">保存选择</el-button>
        <el-button type="primary" :loading="saving" :disabled="!changes.length || incomplete || busy" @click="save(true)">保存并整单核算</el-button>
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
      <el-table-column label="本单选用价格源" min-width="220" fixed="right"><template #default="{ row }">
        <el-select v-if="canEdit && view.sourceSelectionSupported && row.allowedShapes.length"
          :model-value="currentSource(row)" :aria-label="`${row.materialCode} 本单选用价格源`"
          :disabled="saving || busy || currentShape(row) === 'DEFAULT' || currentShape(row) === 'MANUFACTURE'"
          :placeholder="currentShape(row) === 'DEFAULT' ? '先选择本单采用形态' : '请选择价格源'" @change="value => setSource(row, value)">
          <el-option v-for="source in sourceOptions(row, currentShape(row))" :key="source.sourceType"
            :label="sourceSummary(source)" :value="source.sourceType" />
        </el-select>
        <span v-else>{{ row.sources.find(source => source.sourceType === row.selectedSourceType)?.sourceLabel || '按原取价规则' }}</span>
      </template></el-table-column>
      <template #empty><el-empty :description="error ? '读取失败，请重试' : '本单没有符合条件的多源物料'" /></template>
    </el-table>
  </section>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { prepareQuoteOrderMaterialShapes, saveQuoteOrderMaterialShapes } from '../../api/quoteRequests'
const props = defineProps({ oaNo: { type: String, required: true }, active: Boolean, readonly: Boolean, busy: Boolean, materialCode: String })
const emit = defineEmits(['saved', 'cost'])
const user = useUserStore()
const permitted = permission => user.permissions.includes('*:*:*') || user.permissions.includes(permission)
const canEdit = computed(() => !props.readonly && user.roles.some(role => ['admin', 'bu_director', 'finance_reviewer'].includes(role)) &&
  (permitted('price:material-sources:edit') || permitted('quote:costing:bom:alternative-select')))
const labels = { MANUFACTURE: '自制件', PURCHASE: '采购件', OUTSOURCE: '委外加工件', DEFAULT: '沿用各产品BOM默认形态' }
const view = ref({ rows: [], problems: [], fingerprint: null })
const loading = ref(false), saving = ref(false), error = ref(''), selected = ref([]), batchShape = ref(''), batchSource = ref('')
const search = ref(props.materialCode || ''), drafts = reactive({}), sourceDrafts = reactive({})
const rowKey = row => `${row.periodMonth}:${row.organization}:${row.materialCode}`
const filteredRows = computed(() => view.value.rows.filter(row => `${row.materialCode} ${row.materialName || ''}`.includes(search.value.trim())))
const changes = computed(() => view.value.rows.filter(row => drafts[rowKey(row)] !== undefined || sourceDrafts[rowKey(row)] !== undefined).map(row => ({
  periodMonth: row.periodMonth, organization: row.organization, materialCode: row.materialCode,
  selectedShape: (drafts[rowKey(row)] ?? row.selectedShape ?? 'DEFAULT') === 'DEFAULT' ? null : (drafts[rowKey(row)] ?? row.selectedShape), expectedVersion: row.version,
  selectedSourceType: (drafts[rowKey(row)] ?? row.selectedShape ?? 'DEFAULT') === 'DEFAULT' ? null
    : (sourceDrafts[rowKey(row)] !== undefined ? sourceDrafts[rowKey(row)] : row.selectedSourceType) || null,
})))
const incomplete = computed(() => view.value.sourceSelectionSupported && changes.value.some(row => row.selectedShape && !row.selectedSourceType))
const commonSources = computed(() => {
  if (!selected.value.length) return []
  return sourceOptions(selected.value[0], batchShape.value || currentShape(selected.value[0])).filter(source =>
    selected.value.every(row => sourceOptions(row, batchShape.value || currentShape(row)).some(option => option.sourceType === source.sourceType)))
})
let generation = 0
function clearDrafts() { Object.keys(drafts).forEach(key => delete drafts[key]); Object.keys(sourceDrafts).forEach(key => delete sourceDrafts[key]); selected.value = []; batchSource.value = '' }
function currentShape(row) { return drafts[rowKey(row)] ?? row.selectedShape ?? 'DEFAULT' }
function currentSource(row) { return sourceDrafts[rowKey(row)] !== undefined ? sourceDrafts[rowKey(row)] : row.selectedSourceType || null }
function sourceOptions(row, shape) {
  if (!shape || shape === 'DEFAULT') return []
  return (row.sources || []).filter(source => shape === 'MANUFACTURE' ? source.sourceType === 'MAKE' : source.sourceType !== 'MAKE')
}
function priceText(price) {
  if (price.value == null) return '待算价'
  return `${price.value} ${price.currency || 'CNY'}/${price.unit || '单位未注明'}${price.taxBasis === 'INCLUDED' ? ' 含税' : price.taxBasis === 'EXCLUDED' ? ' 不含税' : ''}`
}
function sourceSummary(source) {
  const prices = [...new Set((source.prices || []).filter(price => price.value != null).map(priceText))]
  return `${source.sourceLabel} · ${prices.length ? prices.slice(0, 2).join(' / ') + (prices.length > 2 ? ' 等报价' : '') : source.sourceType === 'MAKE' ? '自制计算' : '待算价'}`
}
async function load() {
  if (!props.oaNo || saving.value) return
  const current = ++generation, oaNo = props.oaNo
  loading.value = true; error.value = ''
  try {
    const result = await prepareQuoteOrderMaterialShapes(oaNo)
    if (current !== generation || oaNo !== props.oaNo) return
    view.value = result; clearDrafts()
  } catch (failure) { if (current === generation) { error.value = failure?.message || '多源物料读取失败'; view.value = { rows: [], problems: [], fingerprint: null }; clearDrafts() } }
  finally { if (current === generation) loading.value = false }
}
function setShape(row, shape) {
  if (!canEdit.value || saving.value || props.busy || (shape !== 'DEFAULT' && !row.allowedShapes.includes(shape))) return
  if (!row.legacySelection && (row.selectedShape || 'DEFAULT') === shape) delete drafts[rowKey(row)]
  else drafts[rowKey(row)] = shape
  if (view.value.sourceSelectionSupported) {
    const options = sourceOptions(row, shape), candidates = [currentSource(row), row.selectedSourceType]
    const chosen = candidates.find(value => options.some(source => source.sourceType === value)) || (options.length === 1 ? options[0].sourceType : null)
    stageSource(row, chosen)
  }
}
function stageSource(row, source) {
  if ((row.selectedSourceType || null) === source) delete sourceDrafts[rowKey(row)]
  else sourceDrafts[rowKey(row)] = source
}
function setSource(row, source) {
  if (!canEdit.value || saving.value || props.busy || !sourceOptions(row, currentShape(row)).some(option => option.sourceType === source)) return
  stageSource(row, source)
}
function applyBatch() {
  selected.value.forEach(row => { setShape(row, batchShape.value); if (batchSource.value) setSource(row, batchSource.value) })
}
async function save(cost) {
  if (!canEdit.value || saving.value || props.busy || !changes.value.length) return
  if (incomplete.value) { error.value = '请为调整的物料选择本单价格源'; return }
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
watch(() => [props.oaNo, props.active], () => { generation++; saving.value = false; loading.value = false; clearDrafts(); if (props.active) load() }, { immediate: true })
watch(() => props.materialCode, value => { search.value = value || '' })
onScopeDispose(() => { generation++ })
</script>
<style scoped>
.order-material-shapes > p { color: #606266; margin: 0 0 16px; }
.shape-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
.legacy-note { color: #b88230; font-size: 12px; margin-top: 6px; }
</style>
