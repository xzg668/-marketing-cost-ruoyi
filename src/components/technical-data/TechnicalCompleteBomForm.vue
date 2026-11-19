<template>
  <section class="complete-bom">
    <el-alert v-if="!state.editable && state.source?.message" :title="state.source.message" type="info" :closable="false" />
    <div v-if="editable || preview" class="source-actions">
      <el-button :type="mode === 'REFERENCE' ? 'primary' : ''" :disabled="busy" @click="choose('REFERENCE')">参考成品BOM</el-button>
      <el-button :type="mode === 'UPLOAD' ? 'primary' : ''" :disabled="busy" @click="choose('UPLOAD')">上传BOM</el-button>
    </div>
    <p v-if="!mode" class="hint">本产品暂无电子图库明细，可参考已有成品的料号／型号修改，或按模板格式编制本产品完整BOM后上传。</p>
    <p v-if="preview" class="hint">{{ canPreviewInputs ? '输入参考成品料号或型号，查询后点击“查看BOM”核对技术员使用的填写内容；不会保存到本产品。' : '尚未提交BOM，以下展示需要填写的内容。可切换参考或上传方式查看，资料由负责技术员填写并提交。' }}</p>
    <template v-if="(editable || preview) && mode === 'REFERENCE'">
      <div class="reference-line"><label>参考成品料号／型号</label><el-input v-model="keyword" aria-label="参考成品料号／型号" placeholder="输入料号或型号" clearable :disabled="!canQueryReferences || busy" @keyup.enter="search" /><el-button :loading="busy" :disabled="!canQueryReferences || busy" @click="search">查询</el-button></div>
      <el-table v-if="searched" :data="matches" border size="small" class="reference-table">
        <el-table-column prop="code" label="成品料号" /><el-table-column prop="name" label="产品名称" />
        <el-table-column prop="model" label="产品型号" /><el-table-column prop="specification" label="产品规格" />
        <el-table-column label="操作" width="110"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="selectReference(row)">{{ preview ? '查看BOM' : '引用BOM' }}</el-button></template></el-table-column>
        <template #empty>未找到匹配的成品料号或型号，请更换条件查询</template>
      </el-table>
    </template>
    <template v-if="(editable || preview) && mode === 'UPLOAD'">
      <div class="upload-controls">
        <el-button type="primary" plain :disabled="!canFillInputs || busy" @click="templateVisible = true">下载填写模板（含示例）</el-button>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" :disabled="!canFillInputs || busy" :on-change="upload"><el-button :loading="busy" :disabled="!canFillInputs || busy">选择填写好的BOM文件</el-button></el-upload>
      </div>
      <p class="hint">参照“填写示例”的层级格式，在“BOM填写”表编制本产品的完整BOM，包括辅料和焊料。上传只读取填写表。</p>
    </template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="issues.length" type="warning" :closable="false" title="请修正以下内容后重新上传或选择参考BOM">
      <ul class="issues"><li v-for="(issue, index) in issues" :key="index">{{ issue.lineNo ? `第${issue.lineNo}行：` : '' }}{{ issue.message }}</li></ul>
    </el-alert>
    <template v-if="rows.length || preview">
      <div v-if="rows.length" class="bom-source"><b>{{ mode === 'REFERENCE' ? '参考来源' : '上传文件' }}：</b>
        <template v-if="mode === 'REFERENCE'">{{ reference?.productCode }} · {{ reference?.model }} · {{ reference?.versions?.join(' / ') }}</template>
        <template v-else>{{ file?.fileName }} <el-button v-if="saved && state.bom?.upload" link type="primary" :disabled="busy" @click="downloadOriginal">下载原表</el-button></template>
        <span v-if="saved"> · {{ state.historical ? '已提交版本' : '草稿已保存' }}</span>
      </div>
      <el-form label-position="top" class="product-inputs">
        <el-form-item v-for="[key, label] in productFields" :key="key" :label="label"><el-input :model-value="product?.[key] || ''" readonly :placeholder="key === 'code' ? '未提供料号' : '未提供'" /></el-form-item>
      </el-form>
      <p class="hint">用量相对于直接母件每1件；左右滚动可查看全部字段。{{ mode === 'UPLOAD' && canFillInputs ? '如需修改，请修改原表后重新上传。' : '' }}</p>
      <el-table :data="rows" border size="small" max-height="430" class="technical-bom-table" row-key="hierarchy">
        <template #empty>{{ preview ? '尚未填写BOM，补录后在此查看子件明细' : '暂无子件明细' }}</template>
        <el-table-column v-for="[key, label, width] in columns" :key="key" :label="label" :min-width="width" :fixed="key === 'hierarchy' ? 'left' : false">
          <template #default="{ row }">
            <el-input v-if="key === 'quantity' && mode === 'REFERENCE' && canFillInputs" v-model="row.quantity" inputmode="decimal" size="small" :disabled="busy" :aria-label="`层级${row.hierarchy}子件用量`" @input="changed" />
            <template v-else-if="key === 'materialCode' && mode === 'REFERENCE' && canFillInputs">
              <template v-if="replacementVisible && replacementRow?.hierarchy === row.hierarchy">
                <el-input v-model="replacementKeyword" placeholder="输入新料号或型号" size="small" :disabled="busy"
                  :aria-label="`层级${row.hierarchy}替换料号或型号`" @keyup.enter="searchReplacement" />
                <el-button link type="primary" :loading="busy" @click="searchReplacement">查询</el-button>
                <el-button link :disabled="busy" @click="replacementVisible = false">取消</el-button>
              </template>
              <template v-else>
                <span>{{ row.materialCode }}</span>
                <el-button link type="primary" :disabled="busy" @click="openReplacement(row)">换件</el-button>
              </template>
            </template>
            <span v-else>{{ row[key] ?? '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!preview" class="save-state">{{ saved ? state.historical ? '显示本次提交保存的完整BOM' : 'BOM草稿已保存，请按原流程提交' : '当前预览尚未保存' }}<span>共 {{ rows.length }} 条子件</span></div>
      <p v-else-if="rows.length" class="hint">填写预览 · 共 {{ rows.length }} 条子件 · 未保存到本产品</p>
      <el-button v-if="canPreviewInputs && mode === 'REFERENCE' && reference" type="primary" :loading="busy" @click="checkInputs">检查填写</el-button>
      <el-alert v-if="previewChecked && !issues.length" title="填写检查通过，未保存或提交资料" type="success" :closable="false" />
    </template>
    <el-dialog v-model="replacementSearched" title="选择替换物料" width="740px" append-to-body>
      <p v-if="replacementRow">层级 {{ replacementRow.hierarchy }} · {{ replacementRow.materialCode }} · {{ replacementRow.name }}</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-if="replacementSearched" :data="replacementMatches" size="small" border>
        <el-table-column prop="code" label="料号" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="model" label="型号" />
        <el-table-column prop="specification" label="规格" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="replaceMaterial(row)">选用</el-button></template>
        </el-table-column>
        <template #empty>未找到匹配物料</template>
      </el-table>
    </el-dialog>
    <el-dialog v-model="templateVisible" title="下载BOM填写模板（含真实成品示例）" width="860px" append-to-body :close-on-click-modal="false">
      <p class="hint">选择一个已有成品作为格式示例。下载后在空白的“BOM填写”表编制自己的完整BOM，示例不会导入。</p>
      <div class="reference-line"><el-input v-model="exampleKeyword" placeholder="样例成品料号／型号" clearable @keyup.enter="searchExamples" /><el-button :loading="busy" @click="searchExamples">查询成品</el-button></div>
      <el-table :data="examples" border size="small" class="reference-table"><el-table-column prop="code" label="成品料号" /><el-table-column prop="name" label="名称" /><el-table-column prop="model" label="型号" /><el-table-column label="操作" width="130"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="downloadTemplate(row)">下载填写模板</el-button></template></el-table-column></el-table>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { technicalBomQuantity } from '../../utils/technicalBomQuantity.js'
import { searchTechnicalBomReferences, fetchTechnicalBomReference, checkTechnicalBomReference, searchTechnicalBomReplacements, searchQuoteBomPreviewReplacements, searchQuoteBomPreviewReferences, fetchQuoteBomPreviewReference, checkQuoteBomPreviewReference, uploadQuoteBomPreview, downloadQuoteBomPreviewTemplate, previewTechnicalBomUpload, saveTechnicalBom, downloadTechnicalBom } from '../../api/technicalDataTasks'
const props = defineProps({ productId: Number, state: { type: Object, required: true }, allowed: Boolean, preview: Boolean, previewContext: Object })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const mode = ref(''), rows = ref([]), product = ref(null), reference = ref(null), file = ref(null), issues = ref([]), error = ref('')
const keyword = ref(''), matches = ref([]), searched = ref(false), busy = ref(false), saved = ref(false)
const templateVisible = ref(false), exampleKeyword = ref(''), examples = ref([])
const previewChecked = ref(false)
const replacements = ref({})
const replacementVisible = ref(false), replacementRow = ref(null), replacementKeyword = ref('')
const replacementMatches = ref([]), replacementSearched = ref(false)
let generation = 0
const editable = computed(() => !props.preview && props.allowed && props.state.editable)
const canPreviewInputs = computed(() => props.preview && !!props.previewContext?.itemId && !!props.previewContext?.accountingMonth)
const canQueryReferences = computed(() => editable.value || canPreviewInputs.value)
const canFillInputs = computed(() => editable.value || canPreviewInputs.value)
const productFields = [['code', '产品料号'], ['name', '产品名称'], ['model', '产品型号'], ['specification', '产品规格']]
const columns = [['hierarchy', '层级编号', 100], ['materialCode', '子件料号', 155], ['name', '子件名称', 155], ['model', '子件型号', 160], ['specification', '子件规格', 160], ['quantity', '子件用量', 130], ['unit', '子件单位', 100], ['attribute', '子件属性', 130], ['material', '子件材质', 130], ['netWeight', '子件单件净重', 140], ['netWeightUnit', '子件净重单位', 135]]
function changed() { saved.value = false; previewChecked.value = false; if (!props.preview) emit('dirty', true) }
function setBusy(value) { busy.value = value; emit('busy', value) }
watch(() => props.state, state => {
  generation++; setBusy(false); error.value = ''; issues.value = []; searched.value = false; matches.value = []; previewChecked.value = false
  const bom = state.bom; mode.value = bom?.entryMode || (props.preview ? 'REFERENCE' : ''); product.value = bom?.product || state.target
  rows.value = bom?.nodes?.map(node => ({ ...node.input, quantity: technicalBomQuantity(node.input.quantity) })) || []
  replacements.value = bom?.replacements || {}; replacementVisible.value = false; replacementSearched.value = false
  reference.value = bom?.reference || null; file.value = bom?.upload || null; saved.value = !!bom; emit('dirty', false)
}, { immediate: true })
async function allowDiscard() {
  if (props.preview || saved.value || !rows.value.length) return true
  try { await ElMessageBox.confirm('当前BOM修改尚未保存，是否放弃？', '未保存的BOM', { confirmButtonText: '放弃修改', cancelButtonText: '继续填写', type: 'warning' }); return true }
  catch { return false }
}
async function choose(next) {
  if (mode.value === next || !await allowDiscard()) return
  replacements.value = {}; replacementVisible.value = false; replacementSearched.value = false
  generation++; mode.value = next; rows.value = []; reference.value = null; file.value = null; error.value = ''; issues.value = []
  searched.value = false; saved.value = false; previewChecked.value = false; emit('dirty', false)
}
async function run(action) {
  if (busy.value) return
  const current = ++generation; setBusy(true); error.value = ''
  try { await action(() => current === generation) }
  catch (failure) { if (current === generation) error.value = failure?.message || 'BOM操作失败，请重试' }
  finally { if (current === generation) setBusy(false) }
}
async function search() {
  if (!canQueryReferences.value) return
  await run(async current => {
    const found = canPreviewInputs.value
      ? await searchQuoteBomPreviewReferences(props.previewContext.itemId, props.previewContext.accountingMonth, keyword.value)
      : await searchTechnicalBomReferences(props.productId, keyword.value)
    if (current()) { matches.value = found; searched.value = true }
  })
}
function applyPreview(value) {
  rows.value = value.rows.map(row => ({ ...row, quantity: technicalBomQuantity(row.quantity) })); product.value = value.product
  reference.value = value.reference; file.value = value.upload; issues.value = value.issues || []
  previewChecked.value = false
  if (!props.preview) changed()
}
async function selectReference(row) {
  if (!canQueryReferences.value || !await allowDiscard()) return
  await run(async current => {
    const result = canPreviewInputs.value
      ? await fetchQuoteBomPreviewReference(props.previewContext.itemId, props.previewContext.accountingMonth, row.code)
      : await fetchTechnicalBomReference(props.productId, row.code)
    if (current()) { replacements.value = {}; applyPreview(result) }
  })
}
async function upload(value) {
  if (!canFillInputs.value || !await allowDiscard()) return
  await run(async current => {
    const result = canPreviewInputs.value
      ? await uploadQuoteBomPreview(props.previewContext.itemId, props.previewContext.accountingMonth, value.raw)
      : await previewTechnicalBomUpload(props.productId, value.raw)
    if (current()) { applyPreview(result); previewChecked.value = props.preview }
  })
}
async function searchExamples() {
  if (!canQueryReferences.value) return
  await run(async current => {
    const found = canPreviewInputs.value
      ? await searchQuoteBomPreviewReferences(props.previewContext.itemId, props.previewContext.accountingMonth, exampleKeyword.value)
      : await searchTechnicalBomReferences(props.productId, exampleKeyword.value)
    if (current()) examples.value = found
  })
}
async function downloadTemplate(row) {
  if (!canFillInputs.value) return
  await run(async current => {
    if (canPreviewInputs.value) await downloadQuoteBomPreviewTemplate(props.previewContext.itemId, props.previewContext.accountingMonth, row.code)
    else await downloadTechnicalBom(props.productId, 'template', 'BOM填写模板.xlsx', { exampleCode: row.code })
    if (current()) templateVisible.value = false
  })
}
async function downloadOriginal() { await run(() => downloadTechnicalBom(props.productId, 'file', file.value.fileName, { versionId: props.state.versionId })) }
function referenceInputs() {
  if (rows.value.some(row => !/^(?:\d+\.?\d*|\.\d+)$/.test(String(row.quantity)))) throw new Error('每个子件用量须为非负数字')
  return { entryMode: 'REFERENCE', referenceCode: reference.value.productCode, referenceFingerprint: reference.value.fingerprint,
    quantities: Object.fromEntries(rows.value.map(row => [row.hierarchy, row.quantity])),
    ...(Object.keys(replacements.value).length ? { replacements: replacements.value } : {}) }
}
function openReplacement(row) {
  replacementRow.value = row
  replacementKeyword.value = ''
  replacementMatches.value = []
  replacementSearched.value = false
  error.value = ''
  replacementVisible.value = true
}
async function searchReplacement() {
  await run(async current => {
    const query = replacementKeyword.value.trim()
    const found = canPreviewInputs.value
      ? await searchQuoteBomPreviewReplacements(props.previewContext.itemId, props.previewContext.accountingMonth, query)
      : await searchTechnicalBomReplacements(props.productId, query)
    if (!current() || !replacementVisible.value) return
    const comparable = value => String(value || '').trim().toUpperCase()
    const byCode = found.filter(row => comparable(row.code) === comparable(query))
    const exact = byCode.length ? byCode : found.filter(row => comparable(row.model) === comparable(query))
    if (exact.length === 1) await applyReplacement(exact[0], current)
    else { replacementMatches.value = exact.length ? exact : found; replacementSearched.value = true }
  })
}
async function replaceMaterial(row) {
  await run(current => applyReplacement(row, current))
}
async function applyReplacement(row, current) {
  const selected = replacementRow.value
  if (selected.materialCode === row.code) { replacementVisible.value = false; replacementSearched.value = false; return }
  const key = selected.hierarchy
  const outsideBranch = path => !path.startsWith(`${key}.`)
  const body = referenceInputs()
  body.replacements = Object.fromEntries(Object.entries(body.replacements || {}).filter(([path]) => outsideBranch(path)))
  body.replacements[key] = row.code
  body.quantities = Object.fromEntries(Object.entries(body.quantities).filter(([path]) => outsideBranch(path)))
  const result = canPreviewInputs.value
    ? await checkQuoteBomPreviewReference(props.previewContext.itemId, props.previewContext.accountingMonth, body)
    : await checkTechnicalBomReference(props.productId, body)
  if (current() && replacementVisible.value) {
    replacements.value = body.replacements
    applyPreview(result)
    replacementVisible.value = false
    replacementSearched.value = false
  }
}
async function checkInputs() {
  if (!canPreviewInputs.value || mode.value !== 'REFERENCE' || !reference.value) return
  previewChecked.value = false
  await run(async current => {
    const result = await checkQuoteBomPreviewReference(props.previewContext.itemId, props.previewContext.accountingMonth, referenceInputs())
    if (current()) { issues.value = result.issues || []; previewChecked.value = true }
  })
}
const canSave = computed(() => editable.value && !busy.value && rows.value.length > 0 && !issues.value.length && (mode.value === 'REFERENCE' ? !!reference.value : !!file.value))
async function save(next = false) {
  if (!canSave.value) return false
  if (saved.value) { emit('saved', { ...props.state, next }); return true }
  let completed = false
  await run(async current => {
    const body = { expectedVersion: props.state.rowVersion, entryMode: mode.value }
    if (mode.value === 'REFERENCE') {
      Object.assign(body, referenceInputs())
    } else body.fileSha256 = file.value.sha256
    const result = await saveTechnicalBom(props.productId, body)
    if (current()) { saved.value = true; emit('dirty', false); emit('saved', { ...result, next }); ElMessage.success('BOM草稿已保存'); completed = true }
  })
  return completed
}
defineExpose({ save, canSave })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.source-actions,.upload-controls,.reference-line { display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0 16px; }
.source-actions .el-button { margin-left:0; }
.reference-line { padding:12px 16px;border:1px solid #dfe5ee;border-radius:5px; }
.reference-line .el-input { max-width:360px; }
.reference-table { margin-top:16px; }
.hint { color:#778396;font-size:13px;line-height:1.7; }
.bom-source { margin:20px 0 14px;font-size:13px;color:#536780; }
.product-inputs { display:grid;grid-template-columns:repeat(4,1fr);gap:16px; }
.product-inputs .el-form-item { margin-bottom:8px; }
.save-state { display:flex;justify-content:space-between;color:#748196;font-size:12px;margin-top:14px; }
.issues { max-height:180px;overflow:auto;padding-left:20px; }
.el-alert { margin:12px 0; }
@media(max-width:800px) { .product-inputs { grid-template-columns:repeat(2,1fr); } }
</style>
