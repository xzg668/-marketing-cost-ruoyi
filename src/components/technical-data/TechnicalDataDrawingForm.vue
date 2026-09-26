<template>
  <div v-loading="loading" class="drawing-form">
    <template v-if="state">
      <div class="drawing-status" aria-label="图库处理状态">
        <el-tag :type="state.acquired ? 'success' : 'warning'">{{ state.acquired ? '明细已取得' : '明细待检查' }}</el-tag>
        <el-tag :type="state.materialsMatched ? 'success' : 'info'">{{ state.materialsMatched ? '物料已匹配' : '物料待财务确认' }}</el-tag>
        <el-tag :type="state.bomPublished ? 'success' : 'info'">{{ state.bomPublished ? 'BOM 已就绪' : state.bomComposed ? 'BOM 已组好，待审批确认' : 'BOM 尚未就绪' }}</el-tag>
      </div>
      <el-alert v-if="state.message" :title="state.message" :type="state.acquired ? 'success' : 'warning'" :closable="false" show-icon />
      <el-alert v-if="state.sourceChanged" title="当前图库来源已有变化。下表保留本次保存或提交的明细，重新检查后才能采用新来源。" type="warning" :closable="false" />
      <div v-if="canEdit" class="recheck-controls">
        <p>先在电子图库维护本产品明细，再勾选并重新检查。系统取得有效明细后，可继续下一项。</p>
        <el-select v-if="drawingOptions.length > 1" v-model="drawingNo" aria-label="本产品图号" placeholder="选择料品档案查到的图号" @change="changed">
          <el-option v-for="option in drawingOptions" :key="option.drawingNo" :value="option.drawingNo" :label="`${option.drawingNo} · ${option.materialNo || option.name || 'OA 提供'}`" />
        </el-select>
        <p v-else-if="drawingOptions.length">本次检查图号：<b>{{ drawingOptions[0].drawingNo }}</b></p>
        <el-alert v-else title="OA 未提供图号，料品档案也未查到本产品图号，请先核实来源资料。" type="warning" :closable="false" />
        <div class="recheck-actions">
          <el-checkbox v-model="maintained" :disabled="busy" @change="changed">已在电子图库维护本产品明细</el-checkbox>
        </div>
      </div>
      <div v-if="state.drawing?.nodes?.length" class="drawing-details">
        <p>图号 {{ state.drawing.evidence?.drawingNo || '—' }} · 核算月份 {{ state.accountingMonth }} · 取得时间 {{ state.drawing.evidence?.acquiredAt?.replace('T', ' ') || '—' }}</p>
        <el-table :data="rows" row-key="itemKey" border size="small">
          <el-table-column label="序号" width="70"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
          <el-table-column prop="drawingNo" label="图号" min-width="150" />
          <el-table-column prop="name" label="名称" min-width="135" />
          <el-table-column prop="sourceMaterial" label="材质" width="90" />
          <el-table-column prop="quantityPerParent" label="母件用量" width="95" />
          <el-table-column label="图库重量" width="110"><template #default="{ row }">{{ row.sourceWeight == null ? '未提供' : `${row.sourceWeight} ${row.sourceWeightUnit || '单位未注明'}` }}</template></el-table-column>
          <el-table-column label="U9 料号" min-width="160"><template #default="{ row }"><span v-if="row.currentMaterialNo">{{ row.currentMaterialNo }}</span><el-tag v-else type="warning" size="small">待财务确认</el-tag></template></el-table-column>
        </el-table>
        <p class="hint">图库重量保留来源单位；补录毛重为 kg，净长为毫米。未匹配的 U9 料号由财务确认，不影响技术完成本项。</p>
        <el-button v-if="state.canResolveMaterials && !state.bomPublished && !state.sourceChanged" @click="resolveMaterials">{{ state.materialsMatched ? '查看 U9 料号与 BOM' : '财务确认 U9 料号' }}</el-button>
      </div>
      <el-empty v-else description="尚未保存本产品的有效图库明细" :image-size="60" />
    </template>
    <el-empty v-else-if="!loading" description="图库资料读取失败，请刷新重试" :image-size="60" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { fetchTechnicalDataDrawing, recheckTechnicalDataDrawing } from '../../api/technicalDataTasks'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean, versionId: Number, oaNo: String })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const router = useRouter()
const loading = ref(false)
const busy = ref(false)
const state = ref(null)
const maintained = ref(false)
const drawingNo = ref('')
let generation = 0
const canEdit = computed(() => props.editable && state.value?.editable)
const drawingOptions = computed(() => [...new Map((state.value?.drawingOptions || []).map(option => [option.drawingNo, option])).values()])
const rows = computed(() => {
  const resolutions = new Map((state.value?.resolutions || []).map(row => [row.sourceNodeId, row]))
  return (state.value?.drawing?.nodes || []).map(row => ({ ...row, currentMaterialNo: resolutions.get(row.sourceNodeId)?.materialNo || row.materialNo }))
})
function changed() { emit('dirty', maintained.value || Boolean(drawingNo.value && drawingOptions.value.length > 1)) }
async function load() {
  const request = ++generation
  loading.value = true
  try {
    const result = await fetchTechnicalDataDrawing(props.productId, props.versionId)
    if (request !== generation) return
    state.value = result
    const selected = result.drawing?.evidence?.drawingNo
    drawingNo.value = drawingOptions.value.some(option => option.drawingNo === selected) ? selected
      : drawingOptions.value.length === 1 ? drawingOptions.value[0].drawingNo : ''
  } catch (error) { if (request === generation) showErrorOnce(error, '图库资料读取失败') }
  finally { if (request === generation) loading.value = false }
}
async function recheck(next = false) {
  if (!canEdit.value || !maintained.value || busy.value) return
  busy.value = true
  emit('busy', true)
  try {
    state.value = await recheckTechnicalDataDrawing(props.productId, {
      expectedVersion: state.value.expectedVersion, maintained: maintained.value, drawingNo: drawingNo.value,
    })
    maintained.value = false
    emit('dirty', false)
    emit('saved', { next: next && state.value.acquired })
    if (state.value.acquired) ElMessage.success('图库明细已取得并保存，可以继续下一项')
    else ElMessage.warning(state.value.message || '本次未取得有效明细，请查看原因后重试')
  } catch (error) { showErrorOnce(error, '图库复查未完成') }
  finally { busy.value = false; emit('busy', false) }
}
function resolveMaterials() {
  router.push({ name: 'electronic-drawing-material-resolution', params: { oaNo: props.oaNo, itemId: state.value.workflowId, taskId: state.value.workflowId },
    query: { accountingMonth: state.value.accountingMonth } })
}
watch(() => props.productId, () => { state.value = null; maintained.value = false; drawingNo.value = ''; load() }, { immediate: true })
onBeforeUnmount(() => { generation++ })
defineExpose({ save: recheck, canSave: computed(() => canEdit.value && !loading.value && !busy.value && maintained.value && Boolean(drawingNo.value)) })
</script>

<style scoped>
.drawing-status, .recheck-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.drawing-form .el-alert { margin-bottom: 12px; }
.recheck-controls { padding: 12px 16px; border: 1px solid #dfe5ee; border-radius: 5px; margin: 16px 0; }
.recheck-controls .el-select { width: 100%; margin-bottom: 12px; }
.drawing-details p, .recheck-controls p { line-height: 1.7; }
.hint { color: #778396; font-size: 13px; }
</style>
