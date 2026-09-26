<template>
  <section v-loading="loading" class="solder-form">
    <template v-if="workspace">
      <el-radio-group v-if="canEdit" v-model="mode" :disabled="busy" class="modes">
        <el-radio-button value="REFERENCE">参考焊料</el-radio-button>
        <el-radio-button value="MANUAL">新增焊料</el-radio-button>
      </el-radio-group>
      <p v-else class="hint">{{ mode === 'MANUAL' ? '新增焊料' : '参考焊料' }} · 只读</p>
      <template v-if="mode === 'REFERENCE'">
        <div v-if="canEdit" class="search-bar">
          <el-input v-model="keyword" placeholder="参考成品料号 / 型号" :disabled="busy" @keyup.enter="search" />
          <el-button :loading="searching" :disabled="busy && !searching" @click="search">查询焊料</el-button>
        </div>
        <el-table v-if="searched && canEdit" :data="references" border class="solder-references">
          <el-table-column label="成品料号" min-width="160"><template #default="{ row }">{{ row.evidence.materialNo }}</template></el-table-column>
          <el-table-column label="名称" min-width="150"><template #default="{ row }">{{ row.evidence.name || '—' }}</template></el-table-column>
          <el-table-column label="型号" min-width="160"><template #default="{ row }">{{ row.evidence.model || '—' }}</template></el-table-column>
          <el-table-column label="焊料明细" width="100"><template #default="{ row }">{{ row.items.length }} 条</template></el-table-column>
          <el-table-column label="操作" width="80"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="selectReference(row)">选择</el-button></template></el-table-column>
          <template #empty><el-empty description="没有找到可参考的焊料，请更换成品或新增焊料" /></template>
        </el-table>
        <p v-if="form.reference" class="source-note">参考成品：{{ form.reference.materialNo }} {{ form.reference.name }} {{ form.reference.model }}</p>
      </template>
      <template v-if="mode === 'MANUAL' || form.reference || form.items.length">
        <div class="detail-heading"><b>本次焊料明细</b><el-button v-if="canEdit && mode === 'MANUAL'" :disabled="busy || form.items.length >= 500" @click="addRow">＋ 新增焊料</el-button></div>
        <p class="hint">{{ mode === 'REFERENCE' ? '已带出参考成品的全部适用焊料，可修改用量或删除。' : '输入焊料料号，从料品档案自动带出名称和图号。' }}</p>
        <el-table :data="form.items" row-key="uiId" border class="solder-items">
          <el-table-column label="焊料料号 *" min-width="210"><template #default="{ row }">
            <el-input v-if="canEdit && mode === 'MANUAL'" :model-value="row.materialNo" aria-label="焊料料号" placeholder="如 311990182" :disabled="busy" @update:model-value="changeMaterial(row, $event)" />
            <span v-else>{{ row.materialNo }}</span><small>{{ row.name || '—' }}</small>
          </template></el-table-column>
          <el-table-column label="图号" min-width="205"><template #default="{ row }">
            <span class="drawing-number">{{ row.drawingNo || '—' }}</span>
            <small role="status" :class="{ error: ['ERROR', 'NOT_FOUND', 'NOT_SOLDER', 'UNIT_UNSUPPORTED'].includes(row.lookupStatus) }">{{ row.lookupMessage }}</small>
            <el-button v-if="canEdit && mode === 'MANUAL' && row.lookupStatus === 'ERROR'" link type="primary" :disabled="busy" @click="lookup(row)">重试</el-button>
          </template></el-table-column>
          <el-table-column label="用量 / 单件产品 *" min-width="210"><template #default="{ row, $index }">
            <input v-model="row.quantityPerProduct" :aria-label="`第${$index + 1}行焊料用量`" type="number" min="0" step="any" placeholder="如 0.0001" :disabled="!canEdit || busy" />
            <small v-if="row.evidence?.sourceQuantityKg != null">参考用量：{{ solderQuantityText(row.evidence.sourceQuantityKg) }} kg</small>
          </template></el-table-column>
          <el-table-column label="计量单位" width="120"><template #default>公斤（kg）</template></el-table-column>
          <el-table-column v-if="canEdit" label="操作" width="80"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="removeRow(row)">删除</el-button></template></el-table-column>
          <template #empty><el-empty description="请添加焊料明细" /></template>
        </el-table>
      </template>
      <el-empty v-else description="选中参考成品后，自动带出焊料明细、图号及用量" />
      <p v-if="workspace.priceRequirements.some(row => row.status === 'OK')" class="hint">已有可用价格的焊料无需重复补价。</p>
      <el-alert v-if="priceMessage" type="warning" :closable="false" :title="priceMessage" />
      <el-alert v-if="workspace.issues.length" type="warning" :closable="false" :title="workspace.issues.join('；')" />
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataSolder, fetchTechnicalDataSolderReferences, fetchTechnicalDataSolderMaterial, saveTechnicalDataSolder } from '../../api/technicalDataTasks'
import { emptySolder, solderRow, solderPayload, solderQuantityText } from '../../utils/technicalDataSolder'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean, versionId: Number })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), mode = ref('REFERENCE'), loading = ref(false), searching = ref(false), saving = ref(false)
const keyword = ref(''), searched = ref(false), references = ref([])
const buffers = reactive({ REFERENCE: emptySolder(), MANUAL: emptySolder() })
const originals = reactive({ REFERENCE: '', MANUAL: '' })
const timers = new Map(), generations = new Map()
let disposed = false, loadGeneration = 0
const form = computed(() => buffers[mode.value])
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || searching.value || saving.value)
const priceMessage = computed(() => {
  const requirements = workspace.value?.priceRequirements || []
  const errors = requirements.filter(row => row.status === 'ERROR').map(row => row.materialNo)
  if (errors.length) return `取价查询失败，请重新检查：${errors.join('、')}`
  const missing = requirements.filter(row => row.status !== 'OK').map(row => row.materialNo)
  return missing.length ? `以下焊料暂无可用价格，需在价格模块处理：${missing.join('、')}` : ''
})
watch(busy, value => emit('busy', value))
watch(() => JSON.stringify(form.value), value => emit('dirty', value !== originals[mode.value]))
watch(mode, value => {
  if (value === 'MANUAL') buffers.MANUAL.items.filter(row => row.materialNo && row.lookupStatus === 'PENDING').forEach(row => lookup(row))
})

function restore(data, initial = false) {
  workspace.value = data
  const savedMode = data.content?.entryMode === 'MANUAL' ? 'MANUAL' : 'REFERENCE'
  if (initial) {
    mode.value = savedMode
    buffers.REFERENCE = emptySolder(); buffers.MANUAL = { reference: null, items: [solderRow()] }
    for (const value of ['REFERENCE', 'MANUAL']) originals[value] = JSON.stringify(buffers[value])
  }
  if (data.content) {
    buffers[savedMode] = { reference: data.content.reference ?? null, items: data.content.items.map(solderRow) }
    originals[savedMode] = JSON.stringify(buffers[savedMode])
  }
  emit('dirty', JSON.stringify(form.value) !== originals[mode.value])
}
watch(() => props.productId, async () => {
  const generation = ++loadGeneration
  loading.value = true
  try { const data = await fetchTechnicalDataSolder(props.productId, props.versionId); if (!disposed && generation === loadGeneration) restore(data, true) }
  catch (error) { if (!disposed && generation === loadGeneration) showErrorOnce(error, '焊料资料加载失败') }
  finally { if (!disposed && generation === loadGeneration) loading.value = false }
}, { immediate: true })

async function search() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入参考成品料号或型号')
  searching.value = true; references.value = []; searched.value = true
  try { references.value = await fetchTechnicalDataSolderReferences(props.productId, keyword.value.trim()) }
  catch (error) { showErrorOnce(error, '焊料参考查询失败') }
  finally { searching.value = false }
}
function selectReference(source) {
  if (buffers.REFERENCE.reference?.fingerprint !== source.evidence.fingerprint) {
    buffers.REFERENCE = { reference: source.evidence, items: source.items.map(solderRow) }
  }
  searched.value = false
}
function addRow() { buffers.MANUAL.items.push(solderRow()) }
function removeRow(row) {
  clearTimeout(timers.get(row.uiId)); timers.delete(row.uiId); generations.delete(row.uiId)
  form.value.items.splice(form.value.items.indexOf(row), 1)
}
function changeMaterial(row, value) {
  clearTimeout(timers.get(row.uiId))
  generations.set(row.uiId, (generations.get(row.uiId) || 0) + 1)
  Object.assign(row, { materialNo: value, name: '', drawingNo: '', evidence: null, materialFingerprint: null,
    lookupStatus: value.trim() ? 'PENDING' : 'EMPTY', lookupMessage: value.trim() ? '正在查询料品档案…' : '输入料号后自动带出' })
  if (value.trim()) timers.set(row.uiId, setTimeout(() => lookup(row), 220))
}
async function lookup(row) {
  clearTimeout(timers.get(row.uiId)); timers.delete(row.uiId)
  const code = row.materialNo.trim(), productId = props.productId
  if (!code || mode.value !== 'MANUAL') return
  const generation = (generations.get(row.uiId) || 0) + 1
  generations.set(row.uiId, generation)
  row.lookupStatus = 'PENDING'; row.lookupMessage = '正在查询料品档案…'
  const current = () => !disposed && productId === props.productId && mode.value === 'MANUAL'
    && buffers.MANUAL.items.includes(row) && row.materialNo.trim() === code && generations.get(row.uiId) === generation
  try {
    const result = await fetchTechnicalDataSolderMaterial(productId, code)
    if (!current()) return
    const valid = ['FOUND', 'NO_DRAWING'].includes(result.status)
    Object.assign(row, { lookupStatus: result.status, lookupMessage: result.message,
      name: result.material?.name || '', drawingNo: valid ? result.material?.drawingNo || '' : '',
      materialFingerprint: valid ? result.material.fingerprint : null,
      evidence: valid ? { material: result.material, bom: null, sourceQuantityKg: null } : null })
    if (valid) row.materialNo = result.material.materialNo
  } catch {
    if (current()) Object.assign(row, { lookupStatus: 'ERROR', lookupMessage: '料品档案查询失败，请重试', drawingNo: '', materialFingerprint: null, evidence: null })
  }
}
async function save(next) {
  saving.value = true
  try {
    if (mode.value === 'MANUAL') await Promise.all(form.value.items.filter(row => row.lookupStatus === 'PENDING').map(lookup))
    const data = await saveTechnicalDataSolder(props.productId, solderPayload(mode.value, form.value, workspace.value.expectedVersion))
    restore(data)
    ElMessage.success(data.issues.length ? '草稿已保存，请补齐焊料用量后提交' : '焊料资料已保存')
    emit('saved', { next: next && !data.issues.length })
  } catch (error) { showErrorOnce(error, '焊料保存失败，本次输入已保留') }
  finally { saving.value = false }
}
onBeforeUnmount(() => { disposed = true; timers.forEach(clearTimeout); timers.clear(); generations.clear() })

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !busy.value) })
</script>

<style scoped>
.solder-form{min-height:180px}.modes{margin-bottom:18px}.search-bar{display:flex;gap:12px;max-width:720px;margin-bottom:16px}.source-note{padding:14px;background:#f3f6fa;border-radius:6px}.detail-heading{display:flex;gap:16px;align-items:center;margin:18px 0 10px}.hint,small{font-size:13px;color:#637085;line-height:1.7}small{display:block;margin-top:6px}.error{color:#c7463c}.solder-items input{width:100%;box-sizing:border-box;padding:9px;font:inherit;border:1px solid #cbd3df;border-radius:4px}.solder-items input:disabled{background:#f5f7fa;color:#576173}.el-alert{margin-top:12px}
</style>
