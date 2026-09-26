<template>
  <section v-loading="loading" class="net-loss-form">
    <template v-if="workspace">
      <div v-if="workspace.applicableRate?.sourceType === 'PUBLIC' && workspace.applicableRate.status === 'AVAILABLE'">
        <el-alert title="重新核算优先使用公共净损失率。" type="success" :closable="false" />
        <p class="public-rate">当前公共净损失率：{{ netLossPercent(workspace.applicableRate.rate) }}%</p>
        <p v-if="workspace.content" class="hint">以下保留本次补录记录；已冻结核算结果不变。</p>
      </div>
      <el-alert v-else-if="workspace.publicSource && !['AVAILABLE', 'MISSING'].includes(workspace.publicSource.status)" :title="workspace.publicSource.message" type="error" :closable="false" />
      <p v-else-if="workspace.applicableRate?.sourceType === 'TECH_SUPPLEMENTAL'" class="hint">本产品无公共净损失率，采用已审批补录费率 {{ netLossPercent(workspace.applicableRate.rate) }}%。</p>
      <el-alert v-else-if="workspace.moduleStatus === 'NOT_REQUIRED' && workspace.publicSource?.status === 'MISSING'" title="当前已无可用公共净损失率，请重新复查资料。" type="warning" :closable="false" />
      <template v-if="workspace.content || workspace.moduleStatus !== 'NOT_REQUIRED'">
      <el-radio-group v-if="canEdit" v-model="mode" :disabled="busy" class="modes">
        <el-radio-button value="REFERENCE">参考</el-radio-button>
        <el-radio-button value="MANUAL">直接填写</el-radio-button>
      </el-radio-group>
      <p v-else class="hint">{{ mode === 'MANUAL' ? '直接填写' : '参考产品' }} · 只读</p>
      <template v-if="mode === 'REFERENCE'">
        <div v-if="canEdit" class="search-bar">
          <el-select v-model="searchBy" aria-label="查询方式" :disabled="busy"><el-option value="CODE" label="成品料号" /><el-option value="MODEL" label="型号" /></el-select>
          <el-input v-model="keyword" aria-label="参考查询条件" :placeholder="searchBy === 'MODEL' ? '输入型号' : '输入成品料号'" :disabled="busy" @keyup.enter="search" />
          <el-button :loading="searching" :disabled="busy && !searching" @click="search">查询</el-button>
        </div>
        <el-table v-if="searched && canEdit" :data="references" border class="net-loss-references">
          <el-table-column label="成品料号" min-width="150"><template #default="{ row }">{{ row.source.materialNo }}</template></el-table-column>
          <el-table-column label="名称" min-width="150"><template #default="{ row }">{{ row.source.name || '—' }}</template></el-table-column>
          <el-table-column label="型号" min-width="150"><template #default="{ row }">{{ row.source.model || '—' }}</template></el-table-column>
          <el-table-column label="操作" width="80"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="choose(row)">选择</el-button></template></el-table-column>
          <template #empty><el-empty description="未找到成品，请更换查询条件" /></template>
        </el-table>
        <el-alert v-if="referenceIssue" :title="referenceIssue" type="warning" :closable="false" />
        <dl v-if="reference" class="rate-summary">
          <dt>参考成品</dt><dd>{{ reference.source.materialNo }} {{ reference.source.name }}</dd>
          <dt>型号</dt><dd>{{ reference.source.model || '—' }}</dd>
          <dt>净损失率</dt><dd class="rate-value">{{ netLossPercent(reference.source.rate) }}%</dd>
        </dl>
        <p v-else-if="!referenceIssue" class="hint">{{ canEdit ? '查询后选择参考成品' : '暂无参考资料' }}</p>
      </template>
      <div v-else class="manual-field">
        <label for="net-loss-percent">净损失率<span v-if="canEdit" class="required"> *</span></label>
        <div v-if="canEdit" class="percent-input"><el-input id="net-loss-percent" v-model="percent" aria-label="净损失率" placeholder="填写百分数" :disabled="busy"><template #append>%</template></el-input></div>
        <p v-else class="rate-value">{{ percent === '' ? '尚未填写' : `${percent}%` }}</p>
        <small v-if="canEdit">可填 0，须小于 100%，最多三位小数。</small>
      </div>
      <el-alert v-if="workspace.issues.length" type="warning" :closable="false" :title="workspace.issues.join('；')" />
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataNetLoss, fetchTechnicalDataNetLossReferences, saveTechnicalDataNetLoss } from '../../api/technicalDataTasks'
import { netLossPercent, netLossPayload } from '../../utils/technicalDataNetLoss'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean, versionId: Number })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), mode = ref('REFERENCE'), percent = ref(''), reference = ref(null)
const searchBy = ref('CODE'), keyword = ref(''), references = ref([]), searched = ref(false), referenceIssue = ref('')
const loading = ref(false), searching = ref(false), saving = ref(false), original = ref('')
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || searching.value || saving.value)
const signature = computed(() => JSON.stringify({ mode: mode.value, value: mode.value === 'REFERENCE' ? reference.value?.fingerprint ?? null : percent.value }))
let disposed = false, generation = 0
watch(busy, value => emit('busy', value))
watch(signature, value => emit('dirty', value !== original.value))
watch([searchBy, keyword], () => {
  reference.value = null; references.value = []; searched.value = false; referenceIssue.value = ''
}, { flush: 'sync' })

function restore(data) {
  workspace.value = data
  mode.value = data.content?.entryMode === 'MANUAL' ? 'MANUAL' : 'REFERENCE'
  percent.value = mode.value === 'MANUAL' ? netLossPercent(data.content?.rate) : ''
  keyword.value = data.content?.reference?.source?.materialNo || ''
  reference.value = data.content?.reference || null
  original.value = signature.value
  emit('dirty', false)
}
watch(() => props.productId, async productId => {
  const current = ++generation
  loading.value = true
  try { const result = await fetchTechnicalDataNetLoss(productId, props.versionId); if (!disposed && current === generation) restore(result) }
  catch (error) { if (!disposed && current === generation) showErrorOnce(error, '净损失率加载失败') }
  finally { if (!disposed && current === generation) loading.value = false }
}, { immediate: true })

async function search() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入成品料号或型号')
  reference.value = null; referenceIssue.value = ''; references.value = []; searched.value = true; searching.value = true
  try { const result = await fetchTechnicalDataNetLossReferences(props.productId, searchBy.value, keyword.value.trim()); if (!disposed) references.value = result }
  catch (error) { showErrorOnce(error, '净损失率查询失败，请重试') }
  finally { if (!disposed) searching.value = false }
}
function choose(value) {
  reference.value = null
  referenceIssue.value = value.source.status === 'AVAILABLE' ? '' : `${value.source.message}，请更换成品或直接填写`
  if (!referenceIssue.value) reference.value = value
}
async function save(next) {
  saving.value = true
  try {
    const data = await saveTechnicalDataNetLoss(props.productId, netLossPayload(mode.value, reference.value, percent.value, workspace.value.expectedVersion))
    restore(data)
    ElMessage.success(data.issues.length ? '草稿已保存，请补齐净损失率后提交' : '净损失率已保存')
    emit('saved', { next: next && !data.issues.length })
  } catch (error) { showErrorOnce(error, '净损失率保存失败，本次输入已保留') }
  finally { saving.value = false }
}
onBeforeUnmount(() => { disposed = true; generation++ })

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !busy.value) })
</script>

<style scoped>
.net-loss-form{min-height:180px}.modes{margin-bottom:20px}.search-bar{display:flex;gap:12px;max-width:760px;margin-bottom:16px}.search-bar .el-select{width:140px;flex-shrink:0}.hint,small{color:#637085;font-size:13px;line-height:1.8}.rate-summary{display:grid;grid-template-columns:100px 1fr;gap:14px;padding:20px;background:#f5f7fa;border-radius:6px}.rate-summary dd{margin:0}.rate-summary dt{color:#637085}.rate-value{font-size:19px;font-weight:600;color:#2c5276}.manual-field{max-width:400px}.manual-field label{display:block;margin-bottom:12px}.required{color:#e24b4b}.manual-field small{display:block;margin-top:8px}.el-alert{margin-top:14px}
</style>
