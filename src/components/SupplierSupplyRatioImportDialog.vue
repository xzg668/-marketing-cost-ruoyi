<template>
<el-dialog v-model="visible" title="导入供应商供货比例" width="720px">
      <div class="import-panel">
        <el-alert
          title="按物料和供应商增量更新：仅新增或变动关系生成版本，未出现的关系保留，相同内容跳过；无需填写生效日期。"
          type="info"
          show-icon
          :closable="false"
        />
        <el-upload
          class="ratio-upload"
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :on-change="handleUploadChange"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-title">拖拽或点击选择 Excel</div>
          <div class="upload-tip">支持 .xls / .xlsx</div>
        </el-upload>
        <div v-if="uploadFileName" class="selected-file">
          <el-icon><Document /></el-icon>
          <span :title="uploadFileName">{{ uploadFileName }}</span>
        </div>
        <el-form label-width="130px">
          <el-form-item v-if="sheetNames.length" label="导入工作表">
            <div v-if="sheetNames.length === 1" class="recognized-sheet">
              <span class="sheet-name">{{ selectedSheet }}</span>
              <span class="sheet-hint">已自动识别</span>
            </div>
            <el-select v-else v-model="selectedSheet" placeholder="请选择本次导入的工作表" style="width: 100%">
              <el-option v-for="name in sheetNames" :key="name" :label="name" :value="name" />
            </el-select>
            <span v-if="sheetNames.length > 1" class="sheet-hint">有多个供货比率工作表，请选择本次要导入的表。</span>
          </el-form-item>
          <el-form-item label="未填写比例">
            <span class="ratio-note">空白或“补充”的记录照常导入，比例留空；填写 0% 表示退出供货，旧版本仍可追溯。</span>
          </el-form-item>
        </el-form>
        <section v-if="importResult" class="import-result">
          <div class="result-metrics">
            <div><span>总行数</span><strong>{{ importResult.totalRows || 0 }}</strong></div>
            <div><span>新增关系</span><strong>{{ importResult.newRelations || 0 }}</strong></div>
            <div><span>变更关系</span><strong>{{ importResult.changedRelations || 0 }}</strong></div>
            <div><span>未变化</span><strong>{{ importResult.unchangedRows || 0 }}</strong></div>
            <div><span>重复合并</span><strong>{{ importResult.duplicateRows || 0 }}</strong></div>
            <div><span>比例未填写</span><strong>{{ importResult.unfilledRatioRows || 0 }}</strong></div>
          </div>
          <div class="batch-line">批次：{{ importResult.batchNo || '无变更，未产生批次' }}</div>
        </section>
      </div>
      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button
          v-hasPermi="['base:supplier-supply-ratio:import']"
          type="primary"
          :icon="DocumentChecked"
          :disabled="!uploadFile || !selectedSheet"
          :loading="importing"
          @click="submitImport"
        >
          导入
        </el-button>
      </template>
    </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, DocumentChecked, UploadFilled } from '@element-plus/icons-vue'
import { read as readWorkbook } from 'xlsx'
import { getCmsCostUploadFile, getCmsCostUploadFileName, validateCmsCostFile } from '../api/cmsCost'
import { importSupplierSupplyRatioExcel } from '../api/supplierSupplyRatios'
const visible = defineModel({ type: Boolean, default: false })
const props = defineProps({ closeOnSuccess: Boolean })
const emit = defineEmits(['imported'])
const uploadFile = ref(null)
const uploadFileName = ref('')
const importing = ref(false)
const sheetNames = ref([])
const selectedSheet = ref('')
const importResult = ref(null)
async function handleUploadChange(file) {
  sheetNames.value = []
  selectedSheet.value = ''
  const raw = getCmsCostUploadFile(file)
  const validation = validateCmsCostFile(raw)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    uploadFile.value = null
    uploadFileName.value = ''
    return
  }
  uploadFile.value = raw
  uploadFileName.value = getCmsCostUploadFileName(raw)
  importResult.value = null
  try {
    const workbook = readWorkbook(await raw.arrayBuffer(), { type: 'array', bookSheets: true })
    // 工作表位置不影响识别；多个候选必须由用户选择。
    sheetNames.value = workbook.SheetNames.filter((name) => /供货比[例率利]/.test(name.replace(/[\s\u3000]+/g, '')))
    if (sheetNames.value.length === 1) selectedSheet.value = sheetNames.value[0]
    if (!sheetNames.value.length) ElMessage.warning('未找到名称包含供货比例或供货比率的工作表')
  } catch (error) {
    uploadFile.value = null
    ElMessage.error('Excel 无法读取，请检查文件格式')
  }
}

async function submitImport() {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择供应商供货比例 Excel')
    return
  }
  importing.value = true
  try {
    importResult.value = await importSupplierSupplyRatioExcel({
      file: uploadFile.value, sheetName: selectedSheet.value,
    })
    ElMessage.success(`导入完成：新增 ${importResult.value.newRelations} 条，变更 ${importResult.value.changedRelations} 条，未变化 ${importResult.value.unchangedRows} 条`)
    emit('imported', importResult.value)
    if (props.closeOnSuccess) visible.value = false
  } catch (error) {
    ElMessage.error(error.message || '供应商供货比例导入失败')
  } finally {
    importing.value = false
  }
}

</script>

<style scoped>
.import-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ratio-upload :deep(.el-upload) {
  width: 100%;
}

.ratio-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 24px 16px;
  border-radius: 8px;
}

.upload-icon {
  color: #3b82f6;
  font-size: 34px;
}

.upload-title {
  margin-top: 6px;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.upload-tip {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #475569;
  font-size: 13px;
}

.selected-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recognized-sheet {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.sheet-name {
  color: #303b4b;
  overflow-wrap: anywhere;
}

.sheet-hint {
  color: #8490a1;
  font-size: 12px;
}

.ratio-note {
  color: #606b7a;
  font-size: 13px;
  line-height: 1.7;
}

.import-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.result-metrics div {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e3e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.result-metrics span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.result-metrics strong {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.batch-line {
  color: #475569;
  font-size: 13px;
}

</style>
