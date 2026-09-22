<template>
  <section v-loading="loading" class="auxiliary-form">
    <template v-if="workspace">
      <el-radio-group v-if="canEdit" v-model="mode" :disabled="busy" class="modes">
        <el-radio-button value="REFERENCE">参考辅料</el-radio-button>
        <el-radio-button value="UPLOAD">上传辅料表</el-radio-button>
      </el-radio-group>
      <p v-else class="hint">{{ mode === 'UPLOAD' ? '上传辅料表' : '参考辅料' }} · 只读</p>

      <template v-if="mode === 'REFERENCE'">
        <div v-if="canEdit" class="search-bar">
          <el-input v-model="keyword" placeholder="成品料号 / 名称 / 型号 / 规格" @keyup.enter="search" />
          <el-button :loading="searching" :disabled="busy && !searching" @click="search">查询辅料</el-button>
        </div>
        <el-table v-if="searched && canEdit" :data="references" border class="auxiliary-references">
          <el-table-column prop="materialNo" label="成品料号" min-width="160" />
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="model" label="型号／图号" min-width="150" />
          <el-table-column label="辅料科目" width="100"><template #default="{ row }">{{ row.items.length }}</template></el-table-column>
          <el-table-column label="操作" width="80"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="selectReference(row)">选择</el-button></template></el-table-column>
          <template #empty><el-empty description="没有找到可用辅料，请更换成品或上传辅料表" /></template>
        </el-table>
        <p v-if="form.reference" class="source-note">参考成品：{{ form.reference.materialNo }} {{ form.reference.name }} {{ form.reference.model }}</p>
      </template>

      <template v-else>
        <div class="upload-actions">
          <el-button :disabled="busy" @click="download('template')">下载辅料模板</el-button>
          <el-button v-if="canEdit" :disabled="busy" :loading="uploading" @click="fileInput.click()">选择辅料表</el-button>
          <input ref="fileInput" type="file" accept=".xlsx" hidden @change="upload" />
          <el-button v-if="savedFile" :disabled="busy" @click="download('file')">下载已保存原表</el-button>
        </div>
        <p class="hint">按模板填写后上传，支持公式。原归类保留；二级科目名称可留空，由财务后续归类。</p>
        <p v-if="form.upload" class="source-note">文件：{{ form.upload.fileName }} · 工作表：{{ form.upload.sheetName }}</p>
        <el-alert v-if="uploadIssues.length" type="error" :closable="false" title="文件未通过检查，请修正后重新上传">
          <ul><li v-for="(issue, index) in uploadIssues" :key="index">{{ issue.sheetName || '工作表' }}{{ issue.row ? ` 第 ${issue.row} 行` : '' }}：{{ issue.message }}</li></ul>
        </el-alert>
      </template>

      <p class="hint">原金额供对照。本次金额可直接修改，单位：元／只。</p>
      <div class="table-scroll">
        <table class="auxiliary-items" :class="{ uploaded: mode === 'UPLOAD' }">
          <thead><tr>
            <template v-if="mode === 'REFERENCE'"><th>科目编码</th><th>科目名称</th><th>来源期间</th></template>
            <template v-else><th>序号</th><th>部件名称</th><th>工序名称</th><th>辅料料号</th><th>辅料名称</th><th>辅料价格（不含税）</th><th>体积／表面积</th><th>可加工数量（只）</th><th>原归类</th><th>二级科目名称</th><th>备注</th></template>
            <th>原金额（元／只）</th><th>本次金额（元／只）<em>*</em></th>
          </tr></thead>
          <tbody>
            <tr v-for="(row, index) in form.items" :key="row.itemKey" :data-item-key="row.itemKey">
              <template v-if="mode === 'REFERENCE'"><td>{{ row.source?.cms?.item.subjectCode || '未提供' }}</td><td>{{ row.name }}</td><td>{{ row.source?.cms?.item.sourcePeriod || '未提供' }}</td></template>
              <template v-else>
                <td>{{ row.source?.upload?.item.sequence }}</td><td>{{ row.source?.upload?.item.partName || '—' }}</td><td>{{ row.source?.upload?.item.processName || '—' }}</td>
                <td>{{ row.source?.upload?.item.materialNo || '—' }}</td><td>{{ row.name }}</td><td>{{ row.source?.upload?.item.priceExcludingTax ?? '—' }}</td>
                <td>{{ row.source?.upload?.item.volumeOrArea ?? '—' }}</td><td>{{ row.source?.upload?.item.processableQuantity ?? '—' }}</td><td>{{ row.source?.upload?.item.category || '—' }}</td>
                <td>{{ row.source?.upload?.item.secondarySubjectName || '待财务归类' }}</td><td>{{ row.source?.upload?.item.remark || '—' }}</td>
              </template>
              <td class="source-amount">{{ row.sourceAmount == null ? '未提供' : auxiliaryAmountText(row.sourceAmount) }}</td>
              <td><input v-model="row.amount" :aria-label="`第${index + 1}行本次金额`" type="number" min="0" step="any" :disabled="!canEdit || busy" placeholder="请填写" /></td>
            </tr>
            <tr v-if="!form.items.length"><td :colspan="mode === 'UPLOAD' ? 13 : 5" class="empty">请选择参考成品或上传辅料表</td></tr>
          </tbody>
        </table>
      </div>
      <p class="total">本次辅料合计：<strong>{{ auxiliaryTotal(form.items) }}</strong> 元／只</p>
      <el-alert v-if="workspace.issues.length" type="warning" :closable="false" :title="workspace.issues.join('；')" />
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTechnicalDataAuxiliary, fetchTechnicalDataAuxiliaryReferences, previewTechnicalDataAuxiliaryUpload, saveTechnicalDataAuxiliary, downloadTechnicalDataAuxiliary } from '../../api/technicalDataTasks'
import { emptyAuxiliary, auxiliaryAmountText, auxiliaryFromCms, auxiliaryFromUpload, auxiliaryPayload, auxiliaryTotal } from '../../utils/technicalDataAuxiliary'
import { showErrorOnce } from '../../utils/errorHandler'

const props = defineProps({ productId: { type: Number, required: true }, editable: Boolean })
const emit = defineEmits(['dirty', 'busy', 'saved'])
const workspace = ref(null), mode = ref('REFERENCE'), loading = ref(false), saving = ref(false), searching = ref(false), uploading = ref(false)
const keyword = ref(''), searched = ref(false), references = ref([]), fileInput = ref(null), uploadIssues = ref([])
const buffers = reactive({ REFERENCE: emptyAuxiliary(), UPLOAD: emptyAuxiliary() })
const originals = reactive({ REFERENCE: '', UPLOAD: '' })
const form = computed(() => buffers[mode.value])
const canEdit = computed(() => props.editable && workspace.value?.editable)
const busy = computed(() => loading.value || saving.value || searching.value || uploading.value)
const savedFile = computed(() => workspace.value?.items[0]?.source?.upload)
watch(busy, value => emit('busy', value))
watch([() => JSON.stringify(form.value), () => mode.value === 'UPLOAD' && uploadIssues.value.length > 0],
  ([value, invalidUpload]) => emit('dirty', value !== originals[mode.value] || invalidUpload))

function restore(data, initial = false) {
  workspace.value = data
  const savedMode = data.entryMode === 'UPLOAD' ? 'UPLOAD' : 'REFERENCE'
  if (initial) {
    mode.value = savedMode
    for (const name of ['REFERENCE', 'UPLOAD']) { buffers[name] = emptyAuxiliary(); originals[name] = JSON.stringify(buffers[name]) }
  }
  const source = data.items[0]?.source
  buffers[savedMode] = { reference: source?.cms ?? null, upload: source?.upload ?? null,
    items: data.items.map(row => ({ ...row, amount: auxiliaryAmountText(row.amount) })) }
  originals[savedMode] = JSON.stringify(buffers[savedMode])
  emit('dirty', JSON.stringify(form.value) !== originals[mode.value] || mode.value === 'UPLOAD' && uploadIssues.value.length > 0)
}
watch(() => props.productId, async () => {
  loading.value = true
  try { restore(await fetchTechnicalDataAuxiliary(props.productId), true) }
  catch (error) { showErrorOnce(error, '辅料资料加载失败') }
  finally { loading.value = false }
}, { immediate: true })

async function search() {
  if (!keyword.value.trim()) return ElMessage.warning('请输入参考成品查询条件')
  searching.value = true; references.value = []; searched.value = true
  try { references.value = await fetchTechnicalDataAuxiliaryReferences(props.productId, keyword.value.trim()) }
  catch (error) { showErrorOnce(error, '辅料查询失败') }
  finally { searching.value = false }
}
function selectReference(source) { buffers.REFERENCE = auxiliaryFromCms(source); searched.value = false }
async function upload(event) {
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true; uploadIssues.value = []
  try {
    const parsed = await previewTechnicalDataAuxiliaryUpload(props.productId, file)
    uploadIssues.value = parsed.issues
    if (!parsed.issues.length) buffers.UPLOAD = auxiliaryFromUpload(parsed)
  } catch (error) { uploadIssues.value = [{ message: error.message || '上传失败，请重新选择辅料表' }]; showErrorOnce(error, '辅料上传失败，原输入已保留') }
  finally { uploading.value = false; event.target.value = '' }
}
async function download(kind) {
  try { await downloadTechnicalDataAuxiliary(props.productId, kind, kind === 'template' ? '辅料模板_含二级科目.xlsx' : savedFile.value.fileName, kind === 'file' ? workspace.value.draftVersionId : null) }
  catch (error) { showErrorOnce(error, '辅料文件下载失败') }
}
async function save(next) {
  if (mode.value === 'UPLOAD' && uploadIssues.value.length) return ElMessage.warning('请先修正本次上传文件的错误')
  saving.value = true
  try {
    const data = await saveTechnicalDataAuxiliary(props.productId, auxiliaryPayload(mode.value, form.value, workspace.value.expectedVersion))
    restore(data)
    ElMessage.success(data.issues.length ? '草稿已保存，请补齐金额后提交' : '辅料资料已保存')
    emit('saved', { next: next && !data.issues.length })
  } catch (error) { showErrorOnce(error, '辅料保存失败，本次输入已保留') }
  finally { saving.value = false }
}

// The workbench owns the shared footer; validation and saving stay in this form.
defineExpose({ save, canSave: computed(() => canEdit.value && !busy.value) })
</script>

<style scoped>
.auxiliary-form{min-height:180px;color:#303b4b}.modes{margin-bottom:18px}.search-bar,.upload-actions{display:flex;gap:12px;margin-bottom:16px;max-width:820px}.hint{font-size:13px;color:#637085;line-height:1.7}.source-note{padding:14px;background:#f3f6fa;border-radius:6px}.table-scroll{overflow-x:auto;margin:16px 0}.auxiliary-items{width:100%;min-width:760px;border-collapse:collapse;font-size:14px}.auxiliary-items.uploaded{min-width:1740px}.auxiliary-items th,.auxiliary-items td{padding:12px;border:1px solid #e1e6ee;text-align:left;vertical-align:middle}.auxiliary-items th{background:#f4f6f9;color:#586579}.auxiliary-items input{width:155px;border:1px solid #cbd3df;border-radius:4px;padding:9px;font:inherit;box-sizing:border-box}.auxiliary-items input:disabled{background:#f5f7fa;color:#576173}.source-amount{color:#637085}.empty{text-align:center!important;color:#8792a5;padding:30px!important}.total{text-align:right}em{font-style:normal;color:#e05252}
.auxiliary-items.uploaded th:last-child,.auxiliary-items.uploaded td:last-child{position:sticky;right:0;min-width:180px;width:180px;box-sizing:border-box;background:#fff;box-shadow:-2px 0 3px #e1e6ee;z-index:1}.auxiliary-items.uploaded th:last-child{background:#f4f6f9;z-index:2}
</style>
