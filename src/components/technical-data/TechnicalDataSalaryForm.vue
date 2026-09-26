<template>
  <section v-loading="loading" class="salary-form">
    <template v-if="workspace">
      <el-alert v-if="workspace.moduleStatus === 'NOT_REQUIRED'" type="info" :closable="false"
        :title="workspace.items.length ? '本产品已有工资来源，无需补录；以下为之前保存的补录记录。' : '本产品已有工资来源，无需补录。'" />
      <template v-if="canEdit || workspace.items.length">
        <section v-for="type in ['DIRECT', 'INDIRECT']" :key="type" class="salary-card" :data-labor-type="type">
          <div class="card-heading">
            <h4>{{ type === 'DIRECT' ? '直接人工工资' : '辅助人员工资' }}</h4>
            <el-radio-group v-if="type === 'DIRECT' && canEdit" v-model="mode" :disabled="busy" size="small">
              <el-radio-button value="REFERENCE">参考料号</el-radio-button>
              <el-radio-button value="UPLOAD">上传工时表</el-radio-button>
            </el-radio-group>
            <strong>{{ salaryAmountText(line(type)?.amount) }} 元／只</strong>
          </div>
          <template v-if="type === 'DIRECT' && mode === 'UPLOAD'">
            <div class="upload-actions">
              <el-button v-if="canEdit" :disabled="busy" @click="download('template')">下载模板</el-button>
              <el-button v-if="canEdit" :loading="uploading" :disabled="busy && !uploading" @click="fileInput.click()">{{ form.upload ? '重新上传' : '选择 Excel' }}</el-button>
              <input ref="fileInputs" type="file" accept=".xlsx" hidden @change="upload" />
              <el-button v-if="savedFile && savedFile.fileSha256 === form.upload?.fileSha256" :disabled="busy" @click="download('file')">下载原文件</el-button>
            </div>
            <p v-if="form.upload" class="file-meta">{{ form.upload.fileName }} · {{ form.upload.items.length }} 条有效明细</p>
            <p class="hint">工时表单件工资按分计算，合计除以 100 后计入直接人工工资（元／只）。</p>
            <el-alert v-if="uploadIssues.length" type="error" :closable="false" title="文件未通过检查，请修正后重新上传">
              <ul><li v-for="(issue, index) in uploadIssues" :key="index">{{ issue.sheetName || '工作表' }}{{ issue.row ? ` 第 ${issue.row} 行` : '' }}：{{ issue.message }}</li></ul>
            </el-alert>
            <details v-if="form.upload"><summary>工时明细</summary>
              <table class="salary-upload-items"><thead><tr><th>原表行号</th><th>零部件名称</th><th>型号</th><th>加工设备</th><th>工序号</th><th>工序名称</th><th>人员配置</th><th>理论节拍</th><th>小时工资标准</th><th>理论班产</th><th>单件工时</th><th>单件工资（分）</th><th>计入金额（元）</th><th>备注</th></tr></thead>
                <tbody><tr v-for="row in form.upload.items" :key="row.itemKey"><td>{{ row.row }}</td><td>{{ row.partName || '—' }}</td><td>{{ row.partModel || '—' }}</td><td>{{ row.equipment || '—' }}</td><td>{{ row.processNo || '—' }}</td><td>{{ row.processName || '—' }}</td><td>{{ row.staffing }}</td><td>{{ row.cycleTime }}</td><td>{{ row.hourlyWage }}</td><td>{{ row.shiftOutput }}</td><td>{{ row.unitTime }}</td><td>{{ row.amountFen }}</td><td>{{ row.amountYuan }}</td><td>{{ row.remark || '—' }}</td></tr></tbody>
              </table>
            </details>
          </template>
          <template v-if="(type === 'DIRECT' && mode === 'REFERENCE') || (type === 'INDIRECT' && mode === 'UPLOAD')">
            <p v-if="canEdit" class="hint">{{ mode === 'REFERENCE' ? '选择一个参考成品，同时带出直接人工和辅助人员工资。' : '选择参考成品，带出辅助人员工资。' }}</p>
            <template v-if="canEdit && picking">
              <div class="search-bar">
                <el-input v-model="keyword" placeholder="输入参考产品料号或型号" @keyup.enter="search" />
                <el-button :loading="searching" :disabled="busy && !searching" @click="search">查询工资</el-button>
              </div>
              <el-table v-if="searched" :data="references" border class="salary-references">
                <el-table-column prop="materialNo" label="产品料号" min-width="150" />
                <el-table-column prop="model" label="型号" min-width="130" />
                <el-table-column v-if="mode === 'REFERENCE'" label="直接人工（元）" min-width="130"><template #default="{ row }">{{ salaryAmountText(row.direct?.amountYuan) }}</template></el-table-column>
                <el-table-column label="辅助人员（元）" min-width="130"><template #default="{ row }">{{ salaryAmountText(row.indirect?.amountYuan) }}</template></el-table-column>
                <el-table-column label="操作" min-width="150"><template #default="{ row }">
                  <el-button v-if="!row.issues.length" link type="primary" :disabled="busy" @click="select(row)">选择</el-button>
                  <small v-else class="invalid">{{ row.issues.join('；') }}</small>
                </template></el-table-column>
                <template #empty><el-empty description="未找到本年度、本业务单元的工资参考，请更换查询条件" /></template>
              </el-table>
            </template>
            <div v-if="selected" class="reference-meta"><b>{{ selected.materialNo }}</b><span>{{ selected.model }}</span>
              <el-button v-if="canEdit && !picking" link type="primary" :disabled="busy" @click="picking = true">更换参考产品</el-button>
            </div>
          </template>
          <p v-if="type === 'INDIRECT' && mode === 'REFERENCE'" class="hint">随直接人工参考，自动带出。</p>
          <details v-if="line(type)?.source"><summary>明细</summary>
            <table><thead><tr><th>参考料号</th><th>生效期间</th><th>科目</th><th>金额（元）</th></tr></thead>
              <tbody><tr><td>{{ selected?.materialNo }}</td><td>{{ line(type).source.sourcePeriod }}</td><td>{{ line(type).source.subjectCode }} / {{ line(type).source.subjectName }}</td><td>{{ salaryAmountText(line(type).amount) }}</td></tr></tbody>
            </table>
          </details>
        </section>
        <p class="total">工资合计：<strong>{{ salaryTotal(line('DIRECT')?.amount, line('INDIRECT')?.amount) }}</strong> 元／只</p>
        <el-alert v-if="workspace.issues.length && !selected" :title="workspace.issues.join('；')" type="warning" :closable="false" />
        </template>
      <el-empty v-else description="尚未保存工资补录资料" />
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataSalary, fetchTechnicalDataSalaryReferences, saveTechnicalDataSalary, previewTechnicalDataSalaryUpload, downloadTechnicalDataSalary } from '../../api/technicalDataTasks'
import { salaryAmountText, salaryReferencePayload, salaryUploadPayload, salaryTotal } from '../../utils/technicalDataSalary'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean, versionId: Number })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), mode = ref('REFERENCE'), originalKey = ref(''), keyword = ref(''), references = ref([])
const loading = ref(false), saving = ref(false), searching = ref(false), uploading = ref(false), downloading = ref(false)
const searched = ref(false), picking = ref(true), uploadIssues = ref([]), fileInputs = ref([])
const buffers = reactive({ REFERENCE: { reference: null, upload: null }, UPLOAD: { reference: null, upload: null } })
const form = computed(() => buffers[mode.value])
const selected = computed(() => form.value.reference)
const fileInput = computed(() => fileInputs.value[0])
let generation = 0
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || saving.value || searching.value || uploading.value || downloading.value)
const complete = computed(() => selected.value && (mode.value === 'REFERENCE' || (form.value.upload && !uploadIssues.value.length)))
const savedFile = computed(() => workspace.value?.items.find(row => row.laborType === 'DIRECT')?.source?.upload)
const currentKey = computed(() => JSON.stringify([mode.value, selected.value?.fingerprint, form.value.upload?.fileSha256]))
watch(busy, value => emit('busy', value))
watch([currentKey, () => mode.value === 'UPLOAD' && uploadIssues.value.length > 0],
  () => emit('dirty', currentKey.value !== originalKey.value || (mode.value === 'UPLOAD' && uploadIssues.value.length > 0)))
watch(mode, () => { generation++; references.value = []; searched.value = false; keyword.value = ''; picking.value = !selected.value })
onBeforeUnmount(() => { generation++ })
function line(type) {
  if (type === 'DIRECT' && mode.value === 'UPLOAD') return form.value.upload ? { amount: form.value.upload.amountYuan } : null
  const item = selected.value?.[type === 'DIRECT' ? 'direct' : 'indirect']
  if (item) return { amount: item.amountYuan, source: item }
  const saved = workspace.value?.entryMode === mode.value && workspace.value.items.find(row => row.laborType === type)
  return saved ? { amount: saved.amount, source: null } : null
}
function restore(data) {
  workspace.value = data
  const savedMode = data.entryMode === 'UPLOAD' ? 'UPLOAD' : 'REFERENCE'
  buffers.REFERENCE = { reference: null, upload: null }; buffers.UPLOAD = { reference: null, upload: null }
  buffers[savedMode] = { reference: data.items.find(row => row.laborType === 'INDIRECT')?.source?.reference ?? null,
    upload: data.items.find(row => row.laborType === 'DIRECT')?.source?.upload ?? null }
  mode.value = savedMode; picking.value = !selected.value; searched.value = false; uploadIssues.value = []
  originalKey.value = currentKey.value
  emit('dirty', false)
}
watch(() => props.productId, async productId => {
  const request = ++generation
  loading.value = true; workspace.value = null; references.value = []; keyword.value = ''
  try { const data = await fetchTechnicalDataSalary(productId, props.versionId); if (request === generation) restore(data) }
  catch (error) { if (request === generation) showErrorOnce(error, '工资资料加载失败') }
  finally { loading.value = false }
}, { immediate: true })
async function search() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入参考成品料号或型号')
  if (busy.value) return
  const request = generation
  searching.value = true; references.value = []; searched.value = true
  try { const data = await fetchTechnicalDataSalaryReferences(props.productId, keyword.value.trim(), mode.value); if (request === generation) references.value = data }
  catch (error) { if (request === generation) showErrorOnce(error, '工资查询失败') }
  finally { searching.value = false }
}
function select(row) { form.value.reference = row; picking.value = false; searched.value = false }
async function upload(event) {
  const file = event.target.files[0]
  if (!file || !canEdit.value || busy.value) return
  const request = generation
  uploading.value = true; uploadIssues.value = []
  try {
    const parsed = await previewTechnicalDataSalaryUpload(props.productId, file)
    if (request !== generation) return
    uploadIssues.value = parsed.issues
    if (!parsed.issues.length) form.value.upload = parsed
  } catch (error) {
    if (request === generation) { uploadIssues.value = [{ message: error.message || '工时表上传失败' }]; showErrorOnce(error, '工时表上传失败，原选择已保留') }
  } finally { uploading.value = false; event.target.value = '' }
}
async function download(kind) {
  if (busy.value) return
  downloading.value = true
  try { await downloadTechnicalDataSalary(props.productId, kind, kind === 'template' ? '工时模板2026第一版.xlsx' : savedFile.value.fileName, kind === 'file' ? workspace.value.draftVersionId : null) }
  catch (error) { showErrorOnce(error, '工时文件下载失败') }
  finally { downloading.value = false }
}
async function save(next) {
  if (!canEdit.value || busy.value) return
  if (mode.value === 'UPLOAD' && uploadIssues.value.length) return ElMessage.warning('请先修正本次上传文件的错误')
  const request = generation
  saving.value = true
  try {
    const body = mode.value === 'UPLOAD' ? salaryUploadPayload(form.value.upload, selected.value, workspace.value.expectedVersion)
      : salaryReferencePayload(selected.value, workspace.value.expectedVersion)
    const data = await saveTechnicalDataSalary(props.productId, body)
    if (request !== generation) return
    restore(data); saving.value = false
    ElMessage.success('工资资料已保存')
    emit('saved', { next })
  } catch (error) { if (request === generation) showErrorOnce(error, '工资保存失败，当前选择已保留') }
  finally { saving.value = false }
}

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && complete.value && !busy.value) })
</script>

<style scoped>
.salary-card { border: 1px solid var(--el-border-color); border-radius: 6px; padding: 18px; margin: 16px 0; }
.card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
h4 { margin: 0; font-size: 16px; }
.card-heading strong, .total strong { color: var(--el-color-primary); margin-left: auto; }
.hint { color: var(--el-text-color-secondary); font-size: 13px; }
.search-bar, .reference-meta, .upload-actions { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
.search-bar .el-input { max-width: 420px; }
.reference-meta, .upload-actions { flex-wrap: wrap; }
.file-meta { padding: 12px; background: var(--el-fill-color-light); border-radius: 4px; }
.invalid { color: var(--el-color-warning-dark-2); }
details { margin-top: 16px; overflow-x: auto; } summary { cursor: pointer; color: var(--el-color-primary); }
table { width: 100%; border-collapse: collapse; margin-top: 12px; } th, td { padding: 10px; text-align: left; border: 1px solid var(--el-border-color-lighter); }
.salary-upload-items { min-width: 1400px; }
th { background: var(--el-fill-color-light); } .total { text-align: right; font-size: 16px; }
</style>
