<template>
  <section v-loading="loading" class="order-bom-alternatives">
    <p>这里只列出本单有替代料的物料。选择标准件或替代料后统一保存，所有相关产品同时采用该选择，对应下级一并切换，各产品仍按自己的 BOM 用量核算。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="view.enabled === false" title="标准／替代料选择功能当前已关闭" type="info" :closable="false" />
    <el-alert v-if="blockingProblems.length" type="warning" :closable="false" title="部分产品的 BOM 尚未加载完整，补齐后才能统一保存，避免漏改产品。">
      <div v-for="problem in blockingProblems" :key="problem.itemId">{{ problem.productCode || problem.itemId }}：{{ problem.message }}</div>
    </el-alert>
    <el-alert v-if="unavailableProducts.length" type="info" :closable="false" :title="`${unavailableProducts.length} 个产品本月已确认无 BOM，不影响下方已有替代关系的统一选择。技术补齐后请重新核对。`" />
    <div class="alternative-actions">
      <el-input v-model="search" placeholder="搜索标准料、替代料或产品" clearable style="width: 270px" />
      <el-button :disabled="loading || saving" @click="load()">刷新清单</el-button>
      <el-button v-if="canEdit && view.problems.some(problem => problem.preparable)" :disabled="loading || saving || busy || hasDrafts" @click="load(true, true)">加载缺少的 BOM</el-button>
      <el-button v-if="refreshRequired" :disabled="loading || saving" @click="load(true)">重新加载并清除未保存选择</el-button>
      <template v-if="canEdit">
        <span class="selection-summary">已调整 {{ changes.length }} 组，涉及 {{ affectedProducts }} 个产品</span>
        <el-button :loading="saving" :disabled="saveBlocked" @click="save(false)">统一保存</el-button>
        <el-button type="primary" :loading="saving" :disabled="saveBlocked" @click="save(true)">保存并整单核算</el-button>
      </template>
    </div>
    <el-table :data="filteredRows" row-key="key" border max-height="620">
      <el-table-column prop="periodMonth" label="核算月份" width="110" />
      <el-table-column prop="organization" label="组织" width="75" />
      <el-table-column prop="standardMaterialCode" label="标准件料号" min-width="165" />
      <el-table-column prop="materialName" label="名称" min-width="130" />
      <el-table-column prop="materialSpec" label="规格" min-width="180" show-overflow-tooltip />
      <el-table-column label="可选替代料" min-width="230"><template #default="{ row }">
        <div v-for="candidate in row.candidates.filter(item => item.childType === 'ALTERNATIVE')" :key="candidate.materialCode">
          {{ candidate.materialCode }} · {{ candidate.materialSpec || candidate.materialName }}
        </div>
      </template></el-table-column>
      <el-table-column label="影响产品" width="115"><template #default="{ row }">
        <el-popover trigger="click" width="480"><template #reference><el-button link type="primary">{{ productCount(row) }} 个产品</el-button></template>
          <div v-for="occurrence in row.occurrences" :key="`${occurrence.itemId}:${occurrence.group.alternativeGroupKey}`" class="occurrence">
            <b>{{ occurrence.productCode }}</b> · {{ occurrence.productName }}
            <div>父件 {{ occurrence.group.parentMaterialCode }} · 当前位置采用 {{ occurrence.group.selectedMaterialCode }}</div>
          </div>
        </el-popover>
      </template></el-table-column>
      <el-table-column label="本单统一采用" min-width="310" fixed="right"><template #default="{ row }">
        <el-select v-if="canEdit" :model-value="currentSelection(row)" :aria-label="`${row.standardMaterialCode} 本单标准或替代料`"
          :placeholder="row.mixedSelection ? '各产品选择不一致，请统一选择' : '请选择标准件或替代料'"
          :disabled="loading || saving || busy || refreshRequired || !!blockingProblems.length" @change="value => choose(row, value)">
          <el-option v-for="candidate in row.candidates" :key="candidate.materialCode" :value="candidate.materialCode" :label="candidateLabel(candidate)" />
        </el-select>
        <span v-else>{{ row.mixedSelection ? '各产品选择不一致' : selectedLabel(row) }}</span>
        <div v-if="row.reviewRequired" class="review-note">BOM 关系已变化，请重新选择并保存</div>
      </template></el-table-column>
      <template #empty><p class="table-empty-message" role="status">{{ blockingProblems.length ? '请先加载完整 BOM' : error ? '清单读取失败，请重试' : '本单没有可选择的替代料' }}</p></template>
    </el-table>
  </section>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../../store/modules/user'
import { fetchQuoteOrderBomAlternatives, prepareQuoteOrderBomAlternatives, saveQuoteOrderBomAlternatives } from '../../api/quoteRequests'
const props = defineProps({ oaNo: { type: String, required: true }, active: Boolean, readonly: Boolean, busy: Boolean })
const emit = defineEmits(['saved', 'cost'])
const user = useUserStore()
const permitted = permission => user.permissions?.includes('*:*:*') || user.permissions?.includes(permission)
const view = ref({ rows: [], problems: [], fingerprint: null, enabled: true })
const blockingProblems = computed(() => view.value.problems.filter(problem => problem.blocking !== false))
const unavailableProducts = computed(() => view.value.problems.filter(problem => problem.blocking === false))
const canEdit = computed(() => !props.readonly && view.value.enabled && (user.roles?.some(role => ['admin', 'bu_director', 'bu_staff'].includes(role)) ||
  permitted('quote:costing:bom:alternative-select') || (user.roles?.includes('finance_reviewer') && permitted('price:material-sources:edit'))))
const loading = ref(false), saving = ref(false), error = ref(''), refreshRequired = ref(false), search = ref('')
const drafts = reactive({})
const hasDrafts = computed(() => Object.keys(drafts).length > 0)
const changes = computed(() => view.value.rows.filter(row => drafts[row.key] !== undefined)
  .map(row => ({ key: row.key, selectedMaterialCode: drafts[row.key] })))
const affectedProducts = computed(() => new Set(view.value.rows.filter(row => drafts[row.key] !== undefined)
  .flatMap(row => row.occurrences.map(occurrence => occurrence.itemId))).size)
const saveBlocked = computed(() => !canEdit.value || loading.value || saving.value || props.busy || refreshRequired.value || !!blockingProblems.value.length || !changes.value.length)
const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return view.value.rows.filter(row => [row.standardMaterialCode, row.materialName, row.materialSpec,
    ...row.candidates.flatMap(candidate => [candidate.materialCode, candidate.materialName, candidate.materialSpec]),
    ...row.occurrences.flatMap(occurrence => [occurrence.productCode, occurrence.productName])].join(' ').toLowerCase().includes(term))
})
const productCount = row => new Set(row.occurrences.map(occurrence => occurrence.itemId)).size
const candidateLabel = candidate => `${candidate.childType === 'STANDARD' ? '标准件' : '替代料'} · ${candidate.materialCode} · ${candidate.materialSpec || candidate.materialName || ''}`
const selectedLabel = row => {
  const candidate = row.candidates.find(candidate => candidate.materialCode === row.selectedMaterialCode)
  return candidate ? candidateLabel(candidate) : row.selectedMaterialCode
}
const currentSelection = row => drafts[row.key] ?? row.selectedMaterialCode
let generation = 0
const identity = () => JSON.stringify([props.oaNo, user.userId, user.businessUnitType])
function clearDrafts() { Object.keys(drafts).forEach(key => delete drafts[key]) }
function choose(row, code) {
  if (!canEdit.value || loading.value || saving.value || props.busy || refreshRequired.value || blockingProblems.value.length || !row.candidates.some(c => c.materialCode === code)) return
  if (!row.mixedSelection && !row.reviewRequired && row.selectedMaterialCode === code) delete drafts[row.key]
  else drafts[row.key] = code
}
async function load(discard = false, prepare = false) {
  if (!props.oaNo || saving.value || loading.value || (prepare && (!canEdit.value || props.busy || hasDrafts.value))) return
  const current = ++generation, scope = identity(), oaNo = props.oaNo
  if (discard) { clearDrafts(); refreshRequired.value = false }
  loading.value = true; error.value = ''
  try {
    const result = await (prepare ? prepareQuoteOrderBomAlternatives(oaNo) : fetchQuoteOrderBomAlternatives(oaNo))
    if (current !== generation || scope !== identity()) return
    if (hasDrafts.value && result.fingerprint !== view.value.fingerprint) {
      refreshRequired.value = true; error.value = '本单BOM或选择已变化，请重新加载后再统一保存'; return
    }
    view.value = result
  } catch (failure) {
    if (current === generation && scope === identity()) { error.value = failure?.message || '标准／替代料清单读取失败'; refreshRequired.value = true }
  } finally { if (current === generation && scope === identity()) loading.value = false }
}
async function save(cost) {
  if (saveBlocked.value) return
  const current = generation, scope = identity(), oaNo = props.oaNo
  saving.value = true; error.value = ''
  try {
    const result = await saveQuoteOrderBomAlternatives(oaNo, { expectedFingerprint: view.value.fingerprint, selections: changes.value })
    if (current !== generation || scope !== identity()) return
    clearDrafts(); ElMessage.success(`已统一保存 ${result.changedMaterials} 组，涉及 ${result.affectedItemIds.length} 个产品，重新核算后更新成本`)
    emit('saved', result)
    if (cost && canEdit.value && props.active) emit('cost')
  } catch (failure) {
    if (current === generation && scope === identity()) { error.value = failure?.message || '保存结果未确认，请刷新清单核对后再操作'; refreshRequired.value = true }
  } finally {
    if (current === generation && scope === identity()) { saving.value = false; if (!error.value) await load() }
  }
}
watch(() => [identity(), props.active, props.readonly, JSON.stringify(user.roles), JSON.stringify(user.permissions)], (current, previous) => {
  generation++; loading.value = false; saving.value = false
  if (current[0] !== previous?.[0]) {
    view.value = { rows: [], problems: [], fingerprint: null, enabled: true }; clearDrafts(); error.value = ''; refreshRequired.value = false
  }
  if (props.active) load()
}, { immediate: true, flush: 'sync' })
onScopeDispose(() => { generation++ })
</script>
<style scoped>
.order-bom-alternatives { color: #344054; font-size: 14px; line-height: 1.5; }
.order-bom-alternatives > p { color: #697386; font-size: 13px; line-height: 1.6; margin: 0 0 12px; }
.alternative-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.alternative-actions :deep(.el-button) { margin-left: 0; }
.selection-summary { color: #697386; font-size: 13px; font-variant-numeric: tabular-nums; }
.order-bom-alternatives :deep(th.el-table__cell) { color: #475467; font-weight: 600; background: #f8fafc; }
.order-bom-alternatives :deep(td.el-table__cell) { padding: 9px 0; }
.order-bom-alternatives :deep(.el-table__empty-text) { width: 100%; }
.table-empty-message { margin: 0; padding: 24px 16px; color: #697386; font-size: 14px; line-height: 1.6; }
.occurrence { margin-bottom: 10px; }
.review-note { color: #b88230; font-size: 12px; margin-top: 6px; }
</style>
