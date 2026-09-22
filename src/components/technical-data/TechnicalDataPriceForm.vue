<template>
  <section v-loading="loading" class="price-form">
    <template v-if="workspace">
      <p class="hint">先查公共价，没有可用公共价才使用已确认可用的补录价。同一料号只补一次，可跨产品、报价和月份复用。</p>
      <el-alert v-if="workspace.requirements?.issues.length" type="warning" :closable="false" :title="workspace.requirements.issues.join('；')" />
      <div class="price-layout">
      <aside class="price-materials" aria-label="本次取价物料">
        <b>本次取价物料 · {{ rows.length }} 项</b>
        <el-input v-model="materialKeyword" clearable placeholder="查找料号 / 名称" size="small" />
        <div class="price-material-list">
        <button v-for="row in filteredRows" :key="row.itemKey" type="button" :class="{ active: selectedKey === row.itemKey }" @click="select(row)">
          <b>{{ row.materialNo }}</b><span>{{ row.name || '未提供名称' }}</span>
          <small>{{ row.status === 'AVAILABLE' ? `已有价格 ${row.unitPrice}` : row.status === 'ERROR' ? row.message : ownerLabel(row) }}</small>
          <em v-if="drafts[row.itemKey] && row.status === 'MISSING'">{{ PRICE_MODES[drafts[row.itemKey].entryMode] }}</em>
        </button>
        <el-empty v-if="!filteredRows.length" :description="rows.length ? '没有匹配的料件' : '当前没有需处理的料件'" :image-size="50" />
        </div>
      </aside>
      <div v-if="selected && draft" class="price-editor">
        <h3>{{ selected.materialNo }} · {{ selected.name || '价格资料' }}</h3>
        <el-alert v-if="publication" :type="publication.status === 'AVAILABLE' ? 'success' : 'warning'" :closable="false" :title="publication.message" />
        <el-button v-if="publication && ['FAILED','UNPUBLISHED'].includes(publication.status)" :disabled="busy" @click="recheck">重新检查补录价格</el-button>
        <p>不含税价格 · {{ selected.unit }} · {{ selected.organizationCode }}</p>
        <template v-if="selected.status === 'AVAILABLE'">
          <h3>已有不含税单价：{{ selected.unitPrice }} 元/{{ selected.unit }}</h3>
          <el-alert type="success" :closable="false" title="已有可用价格，本项无需补录" />
          <p class="hint">{{ selected.message }}</p>
        </template>
        <el-alert v-else-if="selected.status === 'ERROR'" type="error" :closable="false" :title="selected.message || '取价失败，请重新检查价格来源'" />
        <template v-else>
        <el-radio-group :model-value="draft.entryMode" :disabled="!itemEditable || busy" @change="changeMode">
          <el-radio-button v-for="(label, mode) in PRICE_MODES" :key="mode" :value="mode">{{ label }}</el-radio-button>
        </el-radio-group>
        <template v-if="draft.entryMode === 'FIXED'">
          <label>不含税单价（元/{{ selected.unit }}）</label>
          <el-input v-model="draft.unitPrice" aria-label="固定不含税单价" :disabled="!itemEditable || busy" placeholder="大于 0" />
        </template>
        <template v-else>
          <div v-if="draft.entryMode === 'REFERENCE'" class="reference-selection">
            <el-button v-if="itemEditable" :disabled="busy" @click="referenceOpen = true">选择参考公式</el-button>
            <p v-if="draft.reference">参考：{{ draft.reference.materialNo }} {{ draft.reference.name }} · {{ draft.reference.month }}<br>原供应商：{{ draft.reference.supplierName || '未提供' }}（仅供核对）</p>
            <p v-else class="hint">请选择参考公式，本次参数可以修改。</p>
          </div>
          <label>联动公式</label>
          <el-input v-model="draft.formula" type="textarea" :rows="3" aria-label="联动公式" :disabled="!itemEditable || busy || draft.entryMode === 'REFERENCE'" />
          <p v-if="draft.entryMode === 'MANUAL'" class="hint">自行公式通过技术审批后，仍需报价员修正、导入并通过取价检查。</p>
          <div class="parameters">
            <div v-for="(label, key) in parameterLabels" :key="key"><label>{{ label }}</label><el-input v-model="draft.parameters[key]" :aria-label="label" :disabled="!itemEditable || busy" /></div>
            <div><label>重量单位</label><el-select v-model="draft.parameters.weightUnit" aria-label="重量单位" :disabled="!itemEditable || busy"><el-option v-for="unit in ['克','千克']" :key="unit" :value="unit" :label="unit" /></el-select></div>
            <div><label>费用单位</label><el-select v-model="draft.parameters.feeUnit" aria-label="费用单位" :disabled="!itemEditable || busy"><el-option v-for="unit in ['元/只','元/件','元/千克']" :key="unit" :value="unit" :label="unit" /></el-select></div>
          </div>
        </template>
        <label>取价说明</label><el-input v-model="draft.notes" aria-label="取价说明" type="textarea" :disabled="!itemEditable || busy" />
        </template>
      </div>
      </div>
      <el-alert v-if="workspace.issues.length" type="warning" :closable="false" :title="workspace.issues.join('；')" />
      <el-dialog v-model="referenceOpen" title="参考联动公式" width="1000px" append-to-body>
        <div class="search-bar"><el-select v-model="searchBy" aria-label="查询方式"><el-option value="CODE" label="料号" /><el-option value="MODEL" label="型号" /></el-select><el-input v-model="keyword" aria-label="参考查询条件" placeholder="输入料号或型号" @keyup.enter="search" /><el-button :loading="searching" @click="search">查询</el-button></div>
        <el-table :data="references" border><el-table-column prop="materialNo" label="料号" min-width="130" /><el-table-column prop="model" label="型号" min-width="130" /><el-table-column prop="supplierName" label="原供应商" min-width="140" /><el-table-column prop="formulaText" label="公式" min-width="200" /><el-table-column label="操作" width="75"><template #default="{ row }"><el-button link type="primary" @click="choose(row)">选择</el-button></template></el-table-column></el-table>
      </el-dialog>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataPrice, fetchTechnicalDataPriceReferences, saveTechnicalDataPrice, recheckTechnicalDataPrice } from '../../api/technicalDataTasks'
import { PRICE_MODES, priceDraft, pricePayload, switchPriceDraft } from '../../utils/technicalDataPrice'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), drafts = ref({}), selectedKey = ref(''), original = ref('')
const modeDrafts = ref({})
const loading = ref(false), saving = ref(false), searching = ref(false), referenceOpen = ref(false)
const materialKeyword = ref('')
const filteredRows = computed(() => rows.value.filter(row => `${row.materialNo} ${row.name || ''}`.toLowerCase().includes(materialKeyword.value.trim().toLowerCase())))
const searchBy = ref('CODE'), keyword = ref(''), references = ref([])
const parameterLabels = { blankWeight: '下料重', netWeight: '净重', processFee: '加工费', agentFee: '代理费' }
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || saving.value || searching.value)
const rows = computed(() => workspace.value?.historical ? (workspace.value.content?.items || []).map(row => ({ ...row, status: 'RECORDED' })) : workspace.value?.requirements?.items || [])
const selected = computed(() => rows.value.find(row => row.itemKey === selectedKey.value))
const draft = computed(() => drafts.value[selectedKey.value])
const publication = computed(() => workspace.value?.publications?.find(row => row.itemKey === selectedKey.value))
const owner = row => workspace.value?.owners.find(value => value.materialNo === row.materialNo)
const itemEditable = computed(() => canEdit.value && selected.value?.status === 'MISSING' && (!owner(selected.value) || owner(selected.value).productId === props.productId))
const signature = computed(() => JSON.stringify(drafts.value))
let disposed = false, generation = 0
watch(busy, value => emit('busy', value))
watch(signature, value => emit('dirty', value !== original.value))
const ownerLabel = row => row.status === 'RECORDED' ? '已提交资料' : owner(row) ? `${owner(row).assigneeName || '原技术员'}办理 · ${owner(row).moduleStatus === 'APPROVED' ? '已审批，待可用性检查' : '等待原资料完成'}` : '需要补价'

function restore(data) {
  workspace.value = data
  modeDrafts.value = {}
  const saved = Object.fromEntries((data.content?.items || []).map(row => [row.itemKey, row]))
  drafts.value = Object.fromEntries(rows.value.map(row => [row.itemKey, priceDraft(saved[row.itemKey])]))
  if (!rows.value.some(row => row.itemKey === selectedKey.value)) selectedKey.value = rows.value.find(row => row.status === 'MISSING')?.itemKey || rows.value[0]?.itemKey || ''
  original.value = signature.value
  emit('dirty', false)
}
watch(() => props.productId, async id => {
  const current = ++generation
  loading.value = true
  workspace.value = null; referenceOpen.value = false; references.value = []; searching.value = false
  try { const data = await fetchTechnicalDataPrice(id); if (!disposed && generation === current) restore(data) }
  catch (error) { if (!disposed && generation === current) showErrorOnce(error, '价格资料加载失败') }
  finally { if (!disposed && generation === current) loading.value = false }
}, { immediate: true })
function select(row) { selectedKey.value = row.itemKey }
function changeMode(mode) {
  const buffers = modeDrafts.value[selectedKey.value] ||= {}
  drafts.value[selectedKey.value] = switchPriceDraft(draft.value, mode, buffers)
}
async function search() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入料号或型号')
  const current = generation
  searching.value = true; references.value = []
  try { const data = await fetchTechnicalDataPriceReferences(props.productId, searchBy.value, keyword.value.trim()); if (!disposed && generation === current) references.value = data }
  catch (error) { if (!disposed && generation === current) showErrorOnce(error, '参考公式查询失败') }
  finally { if (!disposed && generation === current) searching.value = false }
}
function choose(reference) {
  if (!itemEditable.value) return
  drafts.value[selectedKey.value] = priceDraft({ entryMode: 'REFERENCE', formula: reference.formula, parameters: reference.parameters, reference })
  referenceOpen.value = false
}
async function save(next) {
  const current = generation
  saving.value = true
  try {
    const payload = pricePayload(drafts.value, rows.value, workspace.value.expectedVersion, workspace.value.requirements.fingerprint)
    const data = await saveTechnicalDataPrice(props.productId, payload)
    if (disposed || generation !== current) return
    restore(data); ElMessage.success(data.issues.length ? '草稿已保存，请补齐缺价项后提交' : '价格已保存')
    emit('saved', { next: next && !data.issues.length })
  } catch (error) { showErrorOnce(error, '价格保存失败，本次输入已保留') }
  finally { saving.value = false }
}
async function recheck() {
  saving.value = true
  try { restore(await recheckTechnicalDataPrice(props.productId)) }
  catch (error) { showErrorOnce(error, '补录价格检查失败') }
  finally { saving.value = false }
}
onBeforeUnmount(() => { disposed = true; generation++ })

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !busy.value) })
</script>

<style scoped>
.hint{color:#637085;font-size:13px;line-height:1.8}.price-editor{padding:0 0 0 22px;min-width:0}.price-editor label{display:block;margin:16px 0 8px}.parameters{display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:0 20px}.search-bar{display:flex;gap:12px;margin-bottom:16px}.search-bar .el-select{width:120px;flex-shrink:0}.el-alert{margin:12px 0}.reference-selection{margin-top:16px}
.price-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:0;margin-top:18px}.price-materials{border-right:1px solid #e1e7ef;padding-right:18px}.price-materials>.el-input{margin:12px 0}.price-material-list{max-height:440px;overflow:auto;padding-right:4px}.price-material-list>button{display:flex;flex-direction:column;gap:7px;width:100%;padding:13px;margin:8px 0;background:white;border:1px solid #e2e7ef;border-radius:5px;text-align:left;color:#53647a;cursor:pointer}.price-material-list>button.active{background:#f1f7ff;border-color:#409eff}.price-material-list small{color:#8793a6;line-height:1.5}.price-material-list em{font-style:normal;color:#4287c7;font-size:12px}.price-editor h3{margin-top:0;font-size:16px}@media(max-width:800px){.price-layout{grid-template-columns:1fr}.price-materials{border-right:0}.price-editor{padding:18px 0}.parameters{grid-template-columns:1fr 1fr}}
</style>
