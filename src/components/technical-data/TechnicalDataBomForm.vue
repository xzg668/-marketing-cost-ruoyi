<template>
  <section class="bom-form">
    <el-skeleton v-if="loading" :rows="4" animated />
    <el-alert v-else-if="sourceError" :title="sourceError" type="error" :closable="false"><el-button link type="primary" @click="loadSource">重新读取</el-button></el-alert>
    <TechnicalCompleteBomForm v-else-if="technicalPath" ref="completeForm" :product-id="productId" :state="bomState" :allowed="drawingEditable"
      :preview="!drawingEditable && !historical && !bomState?.bom"
      :preview-context="previewContext"
      @dirty="setDirty('complete', $event)" @busy="setBusy('complete', $event)" @saved="completeSaved" />
    <template v-else-if="historical && !drawingVersionId">
      <el-alert title="本次提交未包含图库明细，以下仅显示本次提交保存的制造件资料。" type="info" :closable="false" />
      <TechnicalDataManufacturingForm v-if="manufacturingVersionId" :product-id="productId" :version-id="manufacturingVersionId" />
    </template>
    <template v-else>
    <el-alert v-if="bomState?.source?.state === 'UNCONFIRMED'" :title="bomState.source.message" type="warning" :closable="false" />
    <TechnicalDataDrawingForm ref="drawingForm" :product-id="productId" :oa-no="oaNo"
      :editable="drawingEditable && !activeNodeId" :version-id="drawingVersionId" integrated
      :expanded-node-id="activeNodeId" @loaded="drawingLoaded" @dirty="setDirty('drawing', $event)"
      @busy="setBusy('drawing', $event)" @saved="saved">
      <template #node-status="{ row }">
        <el-button v-if="expandable(row)" link type="primary" :disabled="busy" @click="toggle(row)">
          {{ String(activeNodeId) === String(row.sourceNodeId) ? '收起制造件明细' : manufacturingEditable ? '展开制造件补录' : '查看制造件明细' }}
        </el-button>
        <span v-else>{{ nodeMessage(row) }}</span>
      </template>
      <template #manufacturing="{ row }">
        <div class="manufacturing-node">
          <TechnicalDataManufacturingForm ref="manufacturingForm" :key="row.sourceNodeId" :product-id="productId"
            :source-node-id="row.sourceNodeId" :editable="manufacturingEditable" :version-id="manufacturingVersionId"
            :price-editable="priceEditable" @dirty="setDirty('manufacturing', $event)" @busy="setBusy('manufacturing', $event)"
            @saved="saved" @open-price="emit('open-price')" />
        </div>
      </template>
    </TechnicalDataDrawingForm>
    </template>
    <el-alert v-if="manufacturingError" :title="manufacturingError" type="warning" :closable="false" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchTechnicalDataManufacturing, fetchTechnicalBom } from '../../api/technicalDataTasks'
import TechnicalDataDrawingForm from './TechnicalDataDrawingForm.vue'
import TechnicalDataManufacturingForm from './TechnicalDataManufacturingForm.vue'
import TechnicalCompleteBomForm from './TechnicalCompleteBomForm.vue'

const props = defineProps({ productId: Number, oaNo: String, drawingEditable: Boolean, manufacturingEditable: Boolean,
  drawingVersionId: Number, manufacturingVersionId: Number, historical: Boolean, priceEditable: Boolean, previewContext: Object })
const emit = defineEmits(['dirty', 'busy', 'saved', 'open-price'])
const drawingForm = ref(null), manufacturingForm = ref(null), activeNodeId = ref(null)
const completeForm = ref(null), bomState = ref(null), loading = ref(false), sourceError = ref('')
const technicalPath = computed(() => !!bomState.value?.bom || bomState.value?.source?.state === 'MISSING')
const manufacturing = ref(null), manufacturingError = ref('')
const dirtyParts = reactive({ drawing: false, manufacturing: false, complete: false })
const busyParts = reactive({ drawing: false, manufacturing: false, source: false, complete: false, entry: false })
const busy = computed(() => Object.values(busyParts).some(Boolean))
let generation = 0
let entryGeneration = 0
async function loadSource() {
  const current = ++entryGeneration
  if (props.historical && !props.drawingVersionId) { bomState.value = null; return }
  loading.value = true; setBusy('entry', true); sourceError.value = ''
  try { const state = await fetchTechnicalBom(props.productId, props.drawingVersionId); if (current === entryGeneration) bomState.value = state }
  catch (error) { if (current === entryGeneration) sourceError.value = error?.message || 'BOM来源读取失败，请重试' }
  finally { if (current === entryGeneration) { loading.value = false; setBusy('entry', false) } }
}
watch(() => [props.productId, props.drawingVersionId, props.historical], loadSource, { immediate: true })
function setDirty(part, value) { dirtyParts[part] = value; emit('dirty', Object.values(dirtyParts).some(Boolean)) }
function setBusy(part, value) { busyParts[part] = value; emit('busy', busy.value) }
async function drawingLoaded(state) {
  const current = ++generation
  manufacturing.value = null; manufacturingError.value = ''
  setBusy('source', false)
  if (!state.drawing?.nodes?.length || props.historical && !props.manufacturingVersionId) return
  setBusy('source', true)
  try {
    const result = await fetchTechnicalDataManufacturing(props.productId, props.manufacturingVersionId)
    if (current !== generation) return
    if (String(result.historical ? result.saved?.evidence?.drawingSourceVersionId : result.source?.sourceVersionId) !== String(state.drawing.sourceVersionId)) {
      manufacturingError.value = '制造件与当前展示的图库版本不一致，请刷新核实来源。'
      return
    }
    manufacturing.value = result
  } catch (error) { if (current === generation) manufacturingError.value = error?.message || '制造件状态读取失败，请刷新重试' }
  finally { if (current === generation) setBusy('source', false) }
}
function sourceNode(row) { return manufacturing.value?.source?.nodes?.find(node => String(node.sourceNodeId) === String(row.sourceNodeId)) }
function expandable(row) {
  if (!manufacturing.value) return false
  if (manufacturing.value.historical) return manufacturing.value.saved?.items?.some(item => String(item.parentSourceNodeId) === String(row.sourceNodeId))
  return sourceNode(row)?.state === 'MISSING_RAW'
}
function nodeMessage(row) {
  if (busyParts.source) return '检查中'
  const node = sourceNode(row)
  if (['U9_READY', 'DRAWING_READY'].includes(node?.state)) return '已有下级关系'
  if (node?.message) return node.message
  return ({ PURCHASE: '沿用采购资料', EXCLUDED: '无需补录', WAIT_FINANCE: '待财务确认', ERROR: '来源待核实' })[row.processingState] || '查看图库明细'
}
async function toggle(row) {
  if (busy.value) return
  if (dirtyParts.drawing) { ElMessage.warning('请先保存图库检查，或刷新放弃当前修改'); return }
  if (dirtyParts.manufacturing) {
    try { await ElMessageBox.confirm('当前节点或图库修改尚未保存，是否放弃修改？', '未保存的资料', { confirmButtonText: '放弃修改', cancelButtonText: '继续填写', type: 'warning' }) }
    catch { return }
  }
  setDirty('manufacturing', false)
  activeNodeId.value = String(activeNodeId.value) === String(row.sourceNodeId) ? null : row.sourceNodeId
}
async function saved(result) { setDirty('drawing', false); setDirty('manufacturing', false); await drawingForm.value?.refresh(); emit('saved', result) }
function completeSaved(result) { bomState.value = result; setDirty('complete', false); emit('saved', result) }
const activeForm = computed(() => technicalPath.value ? completeForm.value : activeNodeId.value == null ? drawingForm.value : manufacturingForm.value)
defineExpose({ save: next => activeForm.value?.save(next), canSave: computed(() => !busy.value && activeForm.value?.canSave) })
onBeforeUnmount(() => { generation++; entryGeneration++ })
</script>

<style scoped>
.manufacturing-node { padding: 12px 20px; background: #fff; }
</style>
