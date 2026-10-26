<template>
  <el-dialog v-model="visible" title="导入家用询价来源" width="1080px" :close-on-click-modal="false" :before-close="close" destroy-on-close>
    <el-alert title="只读取「10月线圈询价」的料号、原报价成本P和两项费用率H。其他列保留为财务参考；发布来源不会改写已采用的月价。" type="info" :closable="false" />
    <el-form label-width="125px" class="source-form" :disabled="state.busy || locked" @submit.prevent="inspect">
      <el-form-item label="来源年月"><el-date-picker v-model="form.sourceMonth" type="month" value-format="YYYY-MM" placeholder="明确选择来源年月" /></el-form-item>
      <div class="context-fields">
        <el-form-item label="来源计价单位"><el-input v-model="form.unit" placeholder="财务确认的单位" /></el-form-item>
        <el-form-item label="来源币种"><el-input v-model="form.currency" placeholder="如 CNY" maxlength="3" /></el-form-item>
        <el-form-item label="来源税口径"><el-select v-model="form.taxBasis" placeholder="明确选择税口径" style="width:145px"><el-option label="不含税" value="EXCLUDED" /><el-option label="含税" value="INCLUDED" /></el-select></el-form-item>
      </div>
      <el-form-item label="询价原件"><input aria-label="家用询价原件" type="file" accept=".xls,.xlsx" :disabled="state.busy || locked" @change="selectFile" /><span v-if="file" class="file-name">{{ file.name }}</span></el-form-item>
    </el-form>
    <p class="hint">来源年月仅用于来源追溯，不决定核算月份；文件页签中的“10月”不能证明年份。单位、币种和税口径须依据财务说明填写。</p>
    <el-alert v-if="state.error || localError" :title="localError || state.error" type="error" :closable="false" role="alert" />
    <el-alert v-if="state.phase === 'UNCERTAIN'" :title="state.preview?.status === 'PUBLISHED' ? '原请求已发布，请读取当时的发布回执；当前来源请在列表重新查询。' : '发布结果尚未确认。原请求已保留，可关闭后继续核验；核验不会创建替代请求。'" type="warning" :closable="false" />
    <el-alert v-if="expired && state.phase !== 'UNCERTAIN' && state.phase !== 'DONE'" title="预览已过期，请重新预览后发布。" type="warning" :closable="false" />
    <section v-if="state.preview && state.phase !== 'DONE'" aria-label="家用询价导入预览" class="preview-section">
      <p>原件：{{ state.preview.content.workbook.fileName }}；来源 {{ state.preview.content.sourceMonth }}；{{ state.preview.content.priceContext.unit }} / {{ state.preview.content.priceContext.currency }} / {{ inquiryTaxLabel(state.preview.content.priceContext.taxBasis) }}</p>
      <p>有效料号 {{ state.preview.content.rows.length }} 个，合并重复 {{ state.preview.content.workbook.duplicates.length }} 行；{{ actionSummary }}。</p>
      <el-alert v-for="warning in state.preview.content.warnings" :key="warning" :title="warning" type="warning" :closable="false" />
      <el-table v-if="state.preview.content.workbook.errors.length" :data="state.preview.content.workbook.errors" border max-height="180" aria-label="询价导入错误">
        <el-table-column prop="excelRow" label="原表行号" width="110" /><el-table-column prop="column" label="列" width="80" /><el-table-column prop="message" label="错误原因" />
      </el-table>
      <el-table :data="state.preview.content.rows" border max-height="300" aria-label="询价来源预览行">
        <el-table-column prop="source.materialCode" label="料号" min-width="145" />
        <el-table-column prop="source.materialName" label="名称" min-width="100" />
        <el-table-column prop="source.specification" label="规格" min-width="160" show-overflow-tooltip />
        <el-table-column label="原报价成本P" min-width="150"><template #default="{ row }">{{ inquiryDecimal(row.source.unitPrice) }}</template></el-table-column>
        <el-table-column label="两项费用率H" min-width="130"><template #default="{ row }">{{ inquiryPercent(row.source.householdRate) }}</template></el-table-column>
        <el-table-column label="来源行" width="85"><template #default="{ row }">{{ row.source.sourceRows.join('、') }}</template></el-table-column>
        <el-table-column label="发布动作" min-width="170"><template #default="{ row }">{{ inquiryActionLabel(row.action) }}<el-tag v-if="row.historicalValue" type="warning" size="small">回到历史值，新增版本</el-tag><span v-else-if="row.action === 'NEW_VERSION' && !row.priceChanged">（仅参考/元数据）</span></template></el-table-column>
      </el-table>
    </section>
    <section v-if="state.result" aria-label="家用询价发布回执" class="result-section">
      <el-alert :title="`来源发布完成：新增${state.result.newVersions}个版本，合并重复${state.result.mergedDuplicateRows}行。已采用月价保持原记录。`" type="success" :closable="false" />
      <p>以下是本次请求的保存结果；这些版本可能已成为历史，当前来源以列表查询为准。</p>
      <el-button v-if="canDownload" @click="downloadOriginal">下载本次原件</el-button>
      <el-table :data="state.result.rows" border max-height="300">
        <el-table-column prop="materialCode" label="料号" min-width="150" />
        <el-table-column label="保存版本" width="120"><template #default="{ row }">V{{ row.revisionNo }}</template></el-table-column>
        <el-table-column label="动作"><template #default="{ row }">{{ inquiryActionLabel(row.action) }}</template></el-table-column>
      </el-table>
    </section>
    <template #footer>
      <el-button :disabled="state.busy" @click="close">{{ state.phase === 'UNCERTAIN' ? '关闭，稍后核验' : state.phase === 'DONE' ? '关闭' : '取消预览' }}</el-button>
      <el-button v-if="state.preview && !['UNCERTAIN', 'DONE', 'PUBLISHING'].includes(state.phase)" :disabled="state.busy" @click="reset">修正文件／重新预览</el-button>
      <el-button v-if="!state.preview && state.phase !== 'UNCERTAIN'" :disabled="!file || state.busy" @click="inspect">预览原件</el-button>
      <el-button v-if="state.phase !== 'DONE'" type="primary" :disabled="!canPublish" :loading="state.busy" @click="publish">{{ state.phase === 'UNCERTAIN' ? '核验原请求' : '发布来源版本' }}</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { householdImportApi, downloadHouseholdImportOriginal } from '../../api/householdInquiries'
import { createInquiryImportSession } from '../../pages/householdInquirySession'
import { inquiryDecimal, inquiryPercent, inquiryActionLabel, inquiryTaxLabel, inquiryMessage } from '../../pages/householdInquiryUtils'
const visible = defineModel({ type: Boolean })
const props = defineProps({ scope: { type: String, required: true }, canDownload: Boolean })
const emit = defineEmits(['imported'])
const session = shallowRef(null), file = shallowRef(null), localError = ref('')
let alive = true, downloadSequence = 0
watch(() => props.canDownload, () => { downloadSequence++ }, { flush: 'sync' })
const form = ref({ sourceMonth: '', unit: '', currency: '', taxBasis: '' })
const empty = { phase: 'EMPTY', preview: null, result: null, error: '', busy: false }
const state = computed(() => session.value?.state || empty)
const locked = computed(() => Boolean(state.value.preview) || ['UNCERTAIN', 'PUBLISHING'].includes(state.value.phase))
const canPublish = computed(() => session.value?.canPublish() || false)
const expired = computed(() => Boolean(state.value.preview) && session.value.expired())
const actionSummary = computed(() => ['CREATE', 'NEW_VERSION', 'UNCHANGED'].map(action => `${inquiryActionLabel(action)}${state.value.preview?.content.rows.filter(row => row.action === action).length || 0}个`).join('，'))
watch([visible, () => props.scope], async ([open, scope]) => {
  session.value?.dispose(); session.value = null
  if (!open || !scope) return
  file.value = null; localError.value = ''; form.value = { sourceMonth: '', unit: '', currency: '', taxBasis: '' }
  const current = createInquiryImportSession({ api: householdImportApi, storage: sessionStorage, scope })
  session.value = current; await current.resume()
  if (session.value !== current) return
  const content = current.state.preview?.content
  if (content) form.value = { sourceMonth: content.sourceMonth, ...content.priceContext }
}, { immediate: true })
function selectFile(event) { file.value = event.target.files?.[0] || null; localError.value = '' }
async function inspect() { localError.value = ''; await session.value.inspect(file.value, form.value) }
async function publish() { localError.value = ''; const result = await session.value.publish(); if (result) emit('imported', result) }
async function downloadOriginal() {
  if (!props.canDownload || !state.value.result || !state.value.preview) return
  const scope = props.scope, current = session.value, batchId = state.value.result.batchId, ticket = ++downloadSequence
  const isCurrent = () => alive && visible.value && props.canDownload && ticket === downloadSequence && scope === props.scope && current === session.value && state.value.result?.batchId === batchId
  try { await downloadHouseholdImportOriginal(batchId, state.value.preview.content.workbook.fileName, { isCurrent }) } catch (failure) { if (isCurrent()) localError.value = inquiryMessage(failure) }
}
async function reset() { localError.value = ''; try { await session.value.reset() } catch (error) { localError.value = inquiryMessage(error) } }
async function close() {
  if (state.value.busy) return
  if (state.value.phase !== 'UNCERTAIN' && state.value.phase !== 'DONE') {
    try { if (session.value && !await session.value.reset()) return } catch { ElMessage.warning('原预览暂未取消，原请求已保留；重新打开可继续处理。') }
  }
  visible.value = false
}
onBeforeUnmount(() => { alive = false; session.value?.dispose() })
</script>
<style scoped>
.source-form { margin-top: 18px; }.context-fields { display: flex; flex-wrap: wrap; }.context-fields .el-form-item { width: 31%; margin-right: 2%; }.hint, .file-name, section p { color: #606266; font-size: 13px; }.file-name { margin-left: 12px; }.preview-section, .result-section { margin-top: 16px; }.el-alert { margin-bottom: 12px; }
</style>
