<template>
  <section class="manufacturing-form" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="state">
      <p>每个缺失的制造件补一种原材料。净长按单件填写，单位 mm；毛重按单件填写，单位 kg。</p>
      <el-alert v-if="state.source?.unavailableReason" :title="state.source.unavailableReason" type="warning" :closable="false" show-icon />
      <p v-if="state.historical" class="note">以下为本次提交时保存的原材料及图库重量，当前来源变化不会覆盖这些内容。</p>
      <div v-if="inherited.length" class="source-status">
        <b>已有下级关系 · {{ inherited.length }} 项，无需填写</b>
        <p v-for="row in inherited" :key="row.sourceNodeId">{{ row.name }}（{{ row.parentMaterialNo }}）：{{ row.message }}</p>
      </div>
      <div v-if="waiting.length" class="source-status warning">
        <b>待确认 · {{ waiting.length }} 项</b>
        <p v-for="row in waiting" :key="row.sourceNodeId">{{ row.name }}（图号 {{ row.drawingNo }}）：{{ row.message }}</p>
      </div>
      <el-table v-if="editableRows.length" :data="editableRows" border class="material-table">
        <el-table-column label="制造件／图号" min-width="170">
          <template #default="{ row }"><b>{{ row.name }}</b><p>{{ row.drawingNo }}</p><small>{{ row.parentMaterialNo }}</small><p v-if="row.specification">{{ row.specification }}</p></template>
        </el-table-column>
        <el-table-column prop="quantityPerParent" label="BOM 用量" width="100" />
        <el-table-column label="原材料料号" min-width="190">
          <template #default="{ row }">
            <el-input v-if="canEdit" v-model="draft[row.sourceNodeId].rawMaterialNo" :aria-label="`${row.name}原材料料号`" placeholder="填写采购原材料料号" @input="changed" @change="lookup(row)" />
            <span v-else>{{ draft[row.sourceNodeId]?.rawMaterialNo || '尚未填写' }}</span>
            <p v-if="options[row.sourceNodeId]" class="note">{{ options[row.sourceNodeId].name }}<br>图号：{{ options[row.sourceNodeId].drawingNo || '档案未提供' }}<br>{{ options[row.sourceNodeId].specification }} · {{ options[row.sourceNodeId].unit }}</p>
            <p v-if="lookupErrors[row.sourceNodeId]" class="error">{{ lookupErrors[row.sourceNodeId] }}</p>
          </template>
        </el-table-column>
        <el-table-column label="单件净长（mm）" min-width="145">
          <template #default="{ row }"><el-input v-if="canEdit" v-model="draft[row.sourceNodeId].netLengthMm" type="number" min="0" :aria-label="`${row.name}单件净长`" @input="changed" /><span v-else>{{ draft[row.sourceNodeId]?.netLengthMm ?? '尚未填写' }}</span></template>
        </el-table-column>
        <el-table-column label="图库单件净重 · 只读" min-width="150">
          <template #default="{ row }">{{ row.sourceNetWeight ?? '未提供' }} {{ row.sourceNetWeightUnit || '单位未记录' }}</template>
        </el-table-column>
        <el-table-column label="单件毛重（kg）" min-width="145">
          <template #default="{ row }"><el-input v-if="canEdit" v-model="draft[row.sourceNodeId].grossWeightKg" type="number" min="0" step="any" :aria-label="`${row.name}单件毛重`" @input="changed" /><span v-else>{{ draft[row.sourceNodeId]?.grossWeightKg ?? '尚未填写' }}</span></template>
        </el-table-column>
        <el-table-column v-if="canEdit" label="操作" width="75">
          <template #default="{ row }"><el-button link type="danger" @click="clear(row)">清除</el-button></template>
        </el-table-column>
      </el-table>
      <p v-if="!editableRows.length && !state.source?.unavailableReason && !waiting.length" class="note">当前没有需要填写的原材料关系。</p>
      <div v-if="state.saved?.items?.length" class="saved-relations">
        <b>已保存的原材料关系</b>
        <p v-for="row in state.saved.items" :key="row.itemKey">
          {{ row.evidence?.parentName || row.parentMaterialNo }} → {{ row.rawMaterialNo }}；单件原料用量 {{ row.quantityPerParent }} {{ row.unit }}，净长 {{ row.netLengthMm ?? '未记录' }} mm。
          <span v-if="row.evidence?.scrapStatus === 'MATCHED'">CMS 废料：{{ row.evidence.scrapMappings.map(item => item.materialNo).join('、') }}。</span>
          <span v-else-if="row.evidence?.scrapStatus === 'NO_SCRAP_CONFIRMED'">已有本月无废料确认。</span>
          <span v-else class="warning-text">CMS 废料{{ row.evidence?.scrapStatus === 'AMBIGUOUS' ? '对应多个料号' : '尚未确认' }}，需核实后才能完成核算。</span>
        </p>
      </div>
      <div v-if="state.priceRequirements?.length" class="price-status">
        <b>本次补录原料与废料价格检查</b>
        <p v-for="item in state.priceRequirements" :key="item.materialNo">
          {{ item.role === 'SCRAP' ? '废料' : '原材料' }} {{ item.materialNo }}：
          <span v-if="item.status === 'OK'">已有可用价，无需补价格。</span>
          <span v-else-if="item.status === 'MISSING_PRICE'" class="warning-text">缺少可用价，需在价格模块处理。</span>
          <span v-else class="warning-text">{{ item.status === 'ERROR' ? '取价检查失败，请重查。' : '价格来源尚未确认，需在价格模块核实。' }}</span>
        </p>
      </div>
      <el-alert v-for="message in state.issues || []" :key="message" :title="message" type="warning" :closable="false" />
      <el-alert v-if="state.bomMessage" :title="state.bomMessage" :type="state.bomComposed ? 'success' : 'info'" :closable="false" />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataManufacturing, fetchTechnicalDataRawMaterial, saveTechnicalDataManufacturing } from '../../api/technicalDataTasks'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean, versionId: Number })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const state = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const draft = reactive({})
const options = reactive({})
const lookupErrors = reactive({})
const canEdit = computed(() => props.editable && state.value?.editable && !state.value?.historical)
const inherited = computed(() => (state.value?.source?.nodes || []).filter(row => ['U9_READY', 'DRAWING_READY'].includes(row.state)))
const waiting = computed(() => (state.value?.source?.nodes || []).filter(row => ['WAIT_FINANCE', 'ERROR'].includes(row.state)))
const editableRows = computed(() => state.value?.historical
  ? (state.value.saved?.items || []).map(row => ({ sourceNodeId: row.parentSourceNodeId,
    name: row.evidence?.parentName || row.parentMaterialNo, drawingNo: row.evidence?.parentDrawingNo,
    parentMaterialNo: row.parentMaterialNo, quantityPerParent: row.evidence?.parentQuantity,
    sourceNetWeight: row.evidence?.sourceNetWeight, sourceNetWeightUnit: row.evidence?.sourceNetWeightUnit }))
  : (state.value?.source?.nodes || []).filter(row => row.state === 'MISSING_RAW'))

function install(value) {
  state.value = value
  Object.keys(draft).forEach(key => delete draft[key])
  Object.keys(options).forEach(key => delete options[key])
  Object.keys(lookupErrors).forEach(key => delete lookupErrors[key])
  const saved = new Map((value.saved?.items || []).map(row => [String(row.parentSourceNodeId), row]))
  for (const row of editableRows.value) {
    const previous = saved.get(String(row.sourceNodeId))
    draft[row.sourceNodeId] = { rawMaterialNo: previous?.rawMaterialNo || '',
      netLengthMm: previous?.netLengthMm ?? '', grossWeightKg: previous?.grossWeightKg ?? '' }
    if (previous) options[row.sourceNodeId] = { name: previous.evidence?.rawMaterialName,
      drawingNo: previous.rawMaterialDrawingNo, specification: previous.evidence?.rawMaterialSpec, unit: previous.unit }
  }
}
function changed() { emit('dirty', true) }
function clear(row) {
  draft[row.sourceNodeId] = { rawMaterialNo: '', netLengthMm: '', grossWeightKg: '' }
  delete options[row.sourceNodeId]
  delete lookupErrors[row.sourceNodeId]
  changed()
}
async function load() {
  loading.value = true
  emit('busy', true)
  try { install(await fetchTechnicalDataManufacturing(props.productId, props.versionId)) }
  catch (exception) { error.value = exception?.message || '制造件资料读取失败，请刷新重试' }
  finally { loading.value = false; emit('busy', false) }
}
async function lookup(row) {
  const code = draft[row.sourceNodeId].rawMaterialNo.trim()
  delete options[row.sourceNodeId]
  delete lookupErrors[row.sourceNodeId]
  if (!code) return
  try {
    const found = await fetchTechnicalDataRawMaterial(props.productId, code)
    if (draft[row.sourceNodeId]?.rawMaterialNo.trim() === code) options[row.sourceNodeId] = found
  } catch (exception) {
    if (draft[row.sourceNodeId]?.rawMaterialNo.trim() === code) lookupErrors[row.sourceNodeId] = exception?.message || '原材料料号查询失败'
  }
}
async function save(next) {
  const items = editableRows.value.filter(row => {
    const value = draft[row.sourceNodeId]
    return value.rawMaterialNo || value.netLengthMm !== '' || value.grossWeightKg !== ''
  }).map(row => ({ parentSourceNodeId: Number(row.sourceNodeId), ...draft[row.sourceNodeId] }))
  saving.value = true
  emit('busy', true)
  error.value = ''
  try {
    const result = await saveTechnicalDataManufacturing(props.productId, {
      expectedVersion: state.value.expectedVersion, sourceVersionId: state.value.source.sourceVersionId,
      sourceFingerprint: state.value.source.fingerprint, items,
    })
    install(result)
    emit('dirty', false)
    ElMessage.success(result.issues.length ? '已保存已填资料，请继续处理剩余问题' : '制造件原材料关系已保存')
    emit('saved', { next: next && !result.issues.length })
  } catch (exception) { error.value = exception?.message || '保存失败，当前输入已保留' }
  finally { saving.value = false; emit('busy', false) }
}
onMounted(load)

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !loading.value && !saving.value && Boolean(state.value?.source?.sourceVersionId)) })
</script>

<style scoped>
.source-status, .saved-relations { margin: 16px 0; padding: 14px 16px; border: 1px solid #dce6df; border-radius: 6px; background: #f6faf7; }
.source-status.warning { border-color: #eddfbe; background: #fffbf3; }
.material-table { margin: 16px 0; }
p { line-height: 1.6; }
.note, small { color: #667085; }
.error { color: #c03a35; }
.warning-text { color: #a96800; }
.el-alert { margin: 10px 0; }
</style>
