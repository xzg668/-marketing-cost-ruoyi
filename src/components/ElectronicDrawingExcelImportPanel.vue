<template>
  <el-card shadow="never" class="excel-import-card" v-loading="loading || acting">
    <template #header>
      <div class="panel-heading">
        <div>
          <strong>电子图库正式 Excel</strong>
          <p>当前先上传接口下载的原始 .xlsx；接口接入后仍复用同一套料号确认、结构校验和审核。</p>
        </div>
        <el-tag v-if="confirmed" type="success" effect="plain">已确认并检查价格</el-tag>
        <el-tag v-else-if="result?.structureReady" type="success" effect="plain">待确认</el-tag>
        <el-tag v-else-if="result?.parsed" type="warning" effect="plain">待处理</el-tag>
        <el-tag v-else effect="plain">可选入口</el-tag>
      </div>
    </template>

    <div class="upload-row">
      <el-upload
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="selectFile"
      >
        <el-button>选择正式 Excel</el-button>
      </el-upload>
      <div class="file-choice">
        <strong>{{ pendingFile?.name || result?.sourceFileName || '尚未选择文件' }}</strong>
        <span>只接收电子图库接口原样下载的 .xlsx，最大 10 MB</span>
      </div>
      <el-button type="primary" :disabled="!pendingFile" @click="uploadFile">解析并保存</el-button>
    </div>

    <template v-if="showResult">
      <el-divider />
      <div v-if="result?.parsed" class="source-line">
        <span>工作表：{{ result.sourceSheetName || '-' }}</span>
        <span>文件指纹：{{ shortHash(result.fileSha256) }}</span>
        <span>来源节点：{{ result.sourceNodeCount }}</span>
      </div>

      <div v-if="result?.parsed" class="stat-grid">
        <div><span>自动匹配</span><strong class="success">{{ result.autoMatchedCount }}</strong></div>
        <div><span>人工确认</span><strong>{{ result.confirmedCount }}</strong></div>
        <div><span>未匹配</span><strong :class="{ danger: result.unmatchedCount }">{{ result.unmatchedCount }}</strong></div>
        <div><span>多候选</span><strong :class="{ danger: result.ambiguousCount }">{{ result.ambiguousCount }}</strong></div>
      </div>

      <el-alert
        v-if="result?.parsed"
        :type="result.structureReady ? 'success' : 'warning'"
        :closable="false"
        show-icon
        class="result-alert"
        :title="result.message"
      />

      <div v-if="result?.structureReady && !confirmed" class="confirm-row">
        <span>料号和父子结构已通过检查。确认后，系统会按这份 BOM 检查底层物料价格。</span>
        <el-button type="primary" @click="confirmImport">确认此 BOM 并检查价格</el-button>
      </div>

      <div v-if="pendingMappings.length" class="mapping-section">
        <div class="section-heading">
          <div>
            <strong>需要确认 {{ pendingMappings.length }} 个图号</strong>
            <p>系统不会在多个候选中擅自选第一条；请从当前 U9 组织明确选择正式料号。</p>
          </div>
          <el-button type="primary" :disabled="!selectedMappingCount" @click="saveMappings">
            保存已选择（{{ selectedMappingCount }}）
          </el-button>
        </div>

        <el-table :data="pendingMappings" row-key="nodeId" size="small" class="mapping-table">
          <el-table-column label="Excel位置" width="110">
            <template #default="{ row }">第{{ row.sourceRowNumber }}行 / {{ row.sourceSequence }}</template>
          </el-table-column>
          <el-table-column label="图号与名称" min-width="230">
            <template #default="{ row }">
              <strong>{{ row.drawingCode || '-' }}</strong>
              <div class="muted">{{ row.sourceName || '-' }}<span v-if="row.sourceMaterial"> · {{ row.sourceMaterial }}</span></div>
            </template>
          </el-table-column>
          <el-table-column label="参考" min-width="150">
            <template #default="{ row }">
              <div>{{ row.referenceWeight == null ? '重量 -' : `重量 ${row.referenceWeight}` }}</div>
              <div class="muted">{{ [row.importanceClass, row.hsfRiskClass].filter(Boolean).join(' / ') || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="匹配状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'AMBIGUOUS' ? 'warning' : 'danger'" effect="plain">
                {{ row.status === 'AMBIGUOUS' ? '多个候选' : '未匹配' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="确认当前组织正式料号" min-width="330">
            <template #default="{ row }">
              <el-select
                v-model="selections[row.nodeId]"
                filterable
                remote
                clearable
                :remote-method="query => searchOptions(row, query)"
                :loading="optionLoading[row.nodeId]"
                placeholder="输入料号、品名、规格、型号或图号搜索"
                style="width: 100%"
              >
                <el-option
                  v-for="option in optionsByNode[row.nodeId] || []"
                  :key="option.materialCode"
                  :label="optionLabel(option)"
                  :value="option.materialCode"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-alert
        v-if="displayIssues.length"
        type="error"
        :closable="false"
        show-icon
        class="issue-alert"
      >
        <template #title>还有 {{ displayIssues.length }} 项需要处理</template>
        <div v-for="issue in displayIssues" :key="issueKey(issue)" class="issue-line">
          <span v-if="issue.sourceRowNumber">第{{ issue.sourceRowNumber }}行：</span>{{ issue.message }}
        </div>
      </el-alert>
    </template>
  </el-card>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  applyTechnicalElectronicBomMappings,
  confirmTechnicalElectronicBomImport,
  fetchTechnicalElectronicBomImportResult,
  searchTechnicalElectronicBomMaterialOptions,
  uploadTechnicalElectronicBomExcel,
} from '../api/technicalCollaborationTasks'
import { showErrorOnce } from '../utils/errorHandler'
import {
  buildElectronicDrawingMappingSelections,
  mergeElectronicDrawingMaterialOptions,
  pendingElectronicDrawingMappings,
  validateElectronicDrawingExcelFile,
} from '../utils/electronicDrawingExcelImport'

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  taskVersion: { type: Number, required: true },
  activeSource: { type: String, default: '' },
  confirmed: { type: Boolean, default: false },
})
const emit = defineEmits(['updated'])
const loading = ref(false)
const acting = ref(false)
const pendingFile = ref(null)
const result = ref(null)
const selections = reactive({})
const optionsByNode = reactive({})
const optionLoading = reactive({})

const showResult = computed(() => Boolean(result.value?.parsed || result.value?.issues?.length))
const pendingMappings = computed(() => pendingElectronicDrawingMappings(result.value?.mappings))
const selectedMappingCount = computed(() => pendingMappings.value
  .filter(row => String(selections[row.nodeId] || '').trim()).length)
const displayIssues = computed(() => (result.value?.issues || [])
  .filter(issue => issue.category !== 'MAPPING'))

function selectFile(uploadFile) {
  const file = uploadFile?.raw || null
  const error = validateElectronicDrawingExcelFile(file)
  if (error) {
    pendingFile.value = null
    return ElMessage.warning(error)
  }
  pendingFile.value = file
}

async function uploadFile() {
  if (!pendingFile.value) return
  if (props.activeSource && props.activeSource !== 'ELECTRONIC_DRAWING_EXCEL') {
    try {
      await ElMessageBox.confirm(
        '当前已有其他来源的 BOM 草稿。继续后会用本次电子图库 Excel 替换当前草稿，是否继续？',
        '确认替换 BOM 草稿',
        { type: 'warning', confirmButtonText: '确认替换', cancelButtonText: '取消' },
      )
    } catch { return }
  }
  acting.value = true
  try {
    const data = await uploadTechnicalElectronicBomExcel(
      props.taskId, props.taskVersion, pendingFile.value,
    )
    applyResult(data)
    if (data.parsed) {
      pendingFile.value = null
      data.structureReady ? ElMessage.success(data.message) : ElMessage.warning(data.message)
      emit('updated', data)
    } else {
      ElMessage.warning(data.message || '电子图库 Excel 解析失败')
    }
  } catch (error) {
    showErrorOnce(error, '电子图库 Excel 上传失败')
  } finally {
    acting.value = false
  }
}

async function loadResult() {
  loading.value = true
  try {
    const data = await fetchTechnicalElectronicBomImportResult(props.taskId)
    applyResult(data)
  } catch (error) {
    showErrorOnce(error, '电子图库 Excel 状态恢复失败')
  } finally {
    loading.value = false
  }
}

function applyResult(data) {
  result.value = data || null
  for (const key of Object.keys(selections)) delete selections[key]
  for (const key of Object.keys(optionsByNode)) delete optionsByNode[key]
  for (const row of data?.mappings || []) {
    optionsByNode[row.nodeId] = [...(row.options || [])]
    if (row.selectedMaterialCode) selections[row.nodeId] = row.selectedMaterialCode
  }
}

async function searchOptions(row, keyword) {
  const value = String(keyword || '').trim()
  if (!value) return
  optionLoading[row.nodeId] = true
  try {
    const options = await searchTechnicalElectronicBomMaterialOptions(props.taskId, value)
    optionsByNode[row.nodeId] = mergeElectronicDrawingMaterialOptions(
      row.options || [], options || [],
    )
  } catch (error) {
    showErrorOnce(error, '当前组织料品搜索失败')
  } finally {
    optionLoading[row.nodeId] = false
  }
}

async function saveMappings() {
  const values = buildElectronicDrawingMappingSelections(
    result.value?.mappings, selections,
  )
  if (!values.length) return ElMessage.warning('请先选择至少一个正式料号')
  acting.value = true
  try {
    const data = await applyTechnicalElectronicBomMappings(
      props.taskId, result.value.taskVersion, values,
    )
    applyResult(data)
    data.structureReady ? ElMessage.success(data.message) : ElMessage.warning(data.message)
    emit('updated', data)
  } catch (error) {
    showErrorOnce(error, '料号确认保存失败')
  } finally {
    acting.value = false
  }
}

async function confirmImport() {
  acting.value = true
  try {
    const data = await confirmTechnicalElectronicBomImport(
      props.taskId, result.value?.taskVersion || props.taskVersion,
    )
    if (!data.verified || data.priceScanStatus === 'ERROR') ElMessage.warning(data.message)
    else ElMessage.success(data.message)
    emit('updated', { taskVersion: data.taskVersion, confirmed: data.verified })
  } catch (error) {
    showErrorOnce(error, '电子图库 Excel BOM 确认失败')
  } finally {
    acting.value = false
  }
}

function optionLabel(option) {
  const identity = [option.materialCode, option.materialName].filter(Boolean).join(' · ')
  const detail = [option.materialSpec, option.materialModel, option.drawingNo].filter(Boolean).join(' / ')
  return detail ? `${identity}（${detail}）` : identity
}

function shortHash(value) { return value ? `${String(value).slice(0, 12)}…` : '-' }
function issueKey(issue) {
  return [issue.category, issue.code, issue.nodeId, issue.sourceRowNumber, issue.sourceSequence].join('|')
}

watch(() => [props.taskId, props.taskVersion], loadResult, { immediate: true })
defineExpose({ refresh: loadResult })
</script>

<style scoped>
.excel-import-card { margin-bottom: 14px; }
.panel-heading, .upload-row, .section-heading, .confirm-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.panel-heading p, .section-heading p { margin: 5px 0 0; color: #909399; font-size: 13px; line-height: 1.5; }
.upload-row { padding: 4px 0; }
.file-choice { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
.file-choice strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-choice span, .muted, .source-line { color: #909399; font-size: 12px; }
.source-line { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 12px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.stat-grid div { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid #ebeef5; border-radius: 6px; background: #fafafa; }
.stat-grid span { color: #909399; font-size: 12px; }
.stat-grid strong { font-size: 20px; }
.success { color: #67c23a; }
.danger { color: #f56c6c; }
.result-alert, .issue-alert { margin: 12px 0; }
.confirm-row { margin: 12px 0; padding: 14px 16px; border: 1px solid #b3e19d; border-radius: 6px; background: #f0f9eb; color: #3d6b2f; }
.mapping-section { margin-top: 18px; }
.section-heading { margin-bottom: 12px; }
.mapping-table { border: 1px solid #ebeef5; }
.issue-line { line-height: 1.8; }
@media (max-width: 1000px) {
  .upload-row, .section-heading { align-items: stretch; flex-direction: column; }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
