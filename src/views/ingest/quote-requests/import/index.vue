<template>
  <section class="quote-page">
    <div class="page-head">
      <div>
        <h1>报价单导入</h1>
        <p>财务 Excel 接入</p>
      </div>
      <div class="page-actions">
        <el-button :icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
        <el-button :icon="ArrowLeft" @click="goList">返回列表</el-button>
      </div>
    </div>

    <div class="upload-panel">
      <el-upload
        class="quote-upload"
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xls"
        :disabled="previewing || committing"
        :on-change="handleFileChange"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-title">拖拽或点击上传报价单 Excel</div>
        <div class="upload-tip">支持 .xlsx / .xls，文件大小不超过 20MB</div>
      </el-upload>

      <div class="upload-state">
        <el-alert
          v-if="selectedFileName"
          :title="selectedFileName"
          type="info"
          show-icon
          :closable="false"
        />
        <el-alert
          v-if="previewError"
          :title="previewError"
          type="error"
          show-icon
          :closable="false"
        />
        <div class="upload-actions">
          <el-button :icon="RefreshRight" :disabled="!selectedFile || previewing || committing" @click="resetImport">
            重新选择
          </el-button>
          <el-button
            type="primary"
            :icon="DocumentChecked"
            :loading="committing"
            :disabled="!canCommit"
            @click="handleCommit"
          >
            确认导入
          </el-button>
        </div>
      </div>
    </div>

    <QuoteImportPreviewSummary v-if="preview" :summary="previewSummary" />

    <el-tabs v-if="preview" v-model="activeTab" class="preview-tabs">
      <el-tab-pane label="报价单预览" name="forms">
        <el-table :data="previewSummary.forms" border stripe>
          <el-table-column prop="oaNo" label="报价单号" min-width="180" />
          <el-table-column prop="processCode" label="流程编号" width="130" />
          <el-table-column prop="quoteScenario" label="报价场景" width="150">
            <template #default="{ row }">{{ row.quoteScenario || '-' }}</template>
          </el-table-column>
          <el-table-column prop="classificationStatus" label="分类状态" width="130">
            <template #default="{ row }">
              <el-tag :type="row.classificationPending ? 'warning' : 'success'" effect="plain">
                {{ row.classificationStatus || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ingestStatus" label="接入状态" width="150">
            <template #default="{ row }">{{ row.ingestStatus || '-' }}</template>
          </el-table-column>
          <el-table-column prop="itemCount" label="产品数量" width="110" />
          <template #empty>
            <el-empty description="暂无报价单预览" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`错误 ${previewSummary.errorCount}`" name="errors">
        <QuoteImportIssueTable :rows="previewSummary.errors" empty-text="暂无错误" />
      </el-tab-pane>

      <el-tab-pane :label="`提醒 ${previewSummary.warningCount}`" name="warnings">
        <QuoteImportIssueTable :rows="previewSummary.warnings" empty-text="暂无提醒" />
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  DocumentChecked,
  Download,
  RefreshRight,
  UploadFilled,
} from '@element-plus/icons-vue'
import { commitQuoteExcel, previewQuoteExcel } from '../../../../api/quoteIngest'
import {
  canCommitQuoteExcelPreview,
  downloadQuoteImportTemplate,
  getQuoteImportFile,
  getQuoteImportFileName,
  normalizeQuoteExcelPreview,
  validateQuoteImportFile,
} from '../../../../utils/quoteImport'
import QuoteImportIssueTable from './components/QuoteImportIssueTable.vue'
import QuoteImportPreviewSummary from './components/QuoteImportPreviewSummary.vue'

const router = useRouter()

const selectedFile = ref(null)
const selectedFileName = ref('')
const preview = ref(null)
const previewError = ref('')
const previewing = ref(false)
const committing = ref(false)
const activeTab = ref('forms')

const previewSummary = computed(() =>
  normalizeQuoteExcelPreview(preview.value, selectedFileName.value)
)

const canCommit = computed(
  () =>
    selectedFile.value &&
    canCommitQuoteExcelPreview(preview.value) &&
    !previewing.value &&
    !committing.value
)

function goList() {
  router.push('/ingest/quote-requests')
}

function resetImport() {
  selectedFile.value = null
  selectedFileName.value = ''
  preview.value = null
  previewError.value = ''
  activeTab.value = 'forms'
}

function handleDownloadTemplate() {
  downloadQuoteImportTemplate()
}

async function handleFileChange(uploadFile) {
  const file = getQuoteImportFile(uploadFile)
  const validation = validateQuoteImportFile(file)
  if (!validation.valid) {
    resetImport()
    ElMessage.warning(validation.message)
    return
  }

  selectedFile.value = file
  selectedFileName.value = getQuoteImportFileName(file)
  preview.value = null
  previewError.value = ''
  activeTab.value = 'forms'
  previewing.value = true

  try {
    const response = await previewQuoteExcel(file)
    preview.value = response
    const summary = normalizeQuoteExcelPreview(response, selectedFileName.value)
    activeTab.value = summary.errorCount > 0 ? 'errors' : 'forms'
    ElMessage[summary.errorCount > 0 ? 'warning' : 'success'](
      summary.errorCount > 0 ? '预览发现错误，请修正后重新上传' : '预览完成'
    )
  } catch (error) {
    previewError.value = error?.message || '预览失败'
    ElMessage.error(previewError.value)
  } finally {
    previewing.value = false
  }
}

async function handleCommit() {
  if (!canCommit.value) {
    ElMessage.warning('当前预览存在错误，不能确认导入')
    return
  }

  committing.value = true
  try {
    const response = await commitQuoteExcel(selectedFile.value)
    if (response?.preview) {
      preview.value = response.preview
    }
    if (!response?.committed) {
      activeTab.value = 'errors'
      ElMessage.warning('导入未提交，请检查错误明细')
      return
    }
    ElMessage.success('导入成功')
    router.push('/ingest/quote-requests')
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    committing.value = false
  }
}
</script>

<style scoped>
.quote-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-head h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2a37;
}

.page-head p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.page-actions,
.upload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.upload-panel {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(280px, 360px);
  gap: 16px;
  align-items: stretch;
}

.quote-upload {
  width: 100%;
}

.quote-upload :deep(.el-upload) {
  width: 100%;
}

.quote-upload :deep(.el-upload-dragger) {
  width: 100%;
  min-height: 178px;
  border-radius: 8px;
}

.upload-icon {
  margin-top: 18px;
  color: #2563eb;
  font-size: 42px;
}

.upload-title {
  margin-top: 8px;
  color: #1f2a37;
  font-size: 15px;
  font-weight: 600;
}

.upload-tip {
  margin-top: 8px;
  color: #6b7280;
  font-size: 13px;
}

.upload-state {
  display: flex;
  min-height: 178px;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.preview-tabs {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

@media (max-width: 860px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .upload-panel {
    grid-template-columns: 1fr;
  }
}
</style>
