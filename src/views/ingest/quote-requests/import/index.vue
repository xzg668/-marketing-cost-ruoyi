<template>
  <section class="quote-page">
    <div class="page-head">
      <div>
        <h1>报价单导入</h1>
        <p>财务 OA 原始表单 Excel 接入</p>
      </div>
      <div class="page-actions">
        <el-button :icon="RefreshRight" :loading="templateLoading" @click="loadTemplates">刷新模板</el-button>
        <el-button :icon="ArrowLeft" @click="goList">返回列表</el-button>
      </div>
    </div>

    <section class="template-panel">
      <div class="section-head">
        <h2>导入模板</h2>
        <el-tag effect="plain">{{ templates.length }} 个</el-tag>
      </div>
      <el-alert
        v-if="templateError"
        :title="templateError"
        type="error"
        show-icon
        :closable="false"
      />
      <el-table v-loading="templateLoading" :data="templates" border stripe>
        <el-table-column prop="displayName" label="模板" min-width="220" />
        <el-table-column prop="templateType" label="类型" width="170" />
        <el-table-column prop="processCode" label="流程编号" width="130" />
        <el-table-column prop="quoteScenario" label="报价场景" width="150">
          <template #default="{ row }">{{ formatValue(row.quoteScenario) }}</template>
        </el-table-column>
        <el-table-column prop="fileName" label="文件名" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              :icon="Download"
              :loading="downloadingTemplateType === row.templateType"
              @click="handleDownloadTemplate(row)"
            >
              下载
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无模板" />
        </template>
      </el-table>
    </section>

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
        <div class="state-alerts">
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
        </div>
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

    <section v-if="commitResults.length" class="result-panel">
      <div class="section-head">
        <h2>提交结果</h2>
        <el-tag type="success" effect="plain">{{ commitResults.length }} 条</el-tag>
      </div>
      <el-table :data="commitResults" border stripe>
        <el-table-column prop="oaNo" label="OA 单号" min-width="180" />
        <el-table-column prop="oaFormId" label="OA 表单 ID" width="140" />
        <el-table-column prop="ingestLogId" label="接入流水 ID" width="150" />
        <el-table-column prop="ingestStatus" label="接入状态" width="130">
          <template #default="{ row }">{{ formatValue(row.ingestStatus) }}</template>
        </el-table-column>
        <el-table-column prop="classificationStatus" label="分类状态" width="130">
          <template #default="{ row }">{{ formatValue(row.classificationStatus) }}</template>
        </el-table-column>
        <el-table-column prop="itemCount" label="产品数量" width="110" />
      </el-table>
    </section>

    <el-tabs v-if="preview" v-model="activeTab" class="preview-tabs">
      <el-tab-pane label="报价单预览" name="forms">
        <el-table :data="previewSummary.forms" border stripe>
          <el-table-column prop="oaNo" label="报价单号" min-width="180" />
          <el-table-column prop="processCode" label="流程编号" width="130" />
          <el-table-column prop="quoteScenario" label="报价场景" width="150">
            <template #default="{ row }">{{ formatValue(row.quoteScenario) }}</template>
          </el-table-column>
          <el-table-column prop="classificationStatus" label="分类状态" width="130">
            <template #default="{ row }">
              <el-tag :type="row.classificationPending ? 'warning' : 'success'" effect="plain">
                {{ formatValue(row.classificationStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ingestStatus" label="接入状态" width="150">
            <template #default="{ row }">{{ formatValue(row.ingestStatus) }}</template>
          </el-table-column>
          <el-table-column prop="itemCount" label="产品数量" width="110" />
          <template #empty>
            <el-empty description="暂无报价单预览" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="核算维度" name="accounting">
        <div class="form-detail-head">
          <el-select v-model="selectedFormIndex" class="form-select" placeholder="选择报价单">
            <el-option
              v-for="(form, index) in previewSummary.forms"
              :key="form.oaNo || index"
              :label="form.oaNo || `报价单 ${index + 1}`"
              :value="index"
            />
          </el-select>
        </div>
        <el-descriptions :column="3" border>
          <el-descriptions-item
            v-for="field in accountingFields"
            :key="field.key"
            :label="field.label"
          >
            {{ formatValue(field.value) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <el-tab-pane label="表头摘要" name="header">
        <el-descriptions :column="3" border>
          <el-descriptions-item
            v-for="field in headerFields"
            :key="field.key"
            :label="field.label"
          >
            {{ formatValue(field.value) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <el-tab-pane :label="`产品行 ${selectedItems.length}`" name="items">
        <el-table :data="selectedItems" border stripe>
          <el-table-column prop="seq" label="序号" width="80" />
          <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="materialNo" label="料号" min-width="150" />
          <el-table-column prop="sunlModel" label="三花型号" min-width="140" />
          <el-table-column prop="businessType" label="业务类型" width="120" />
          <el-table-column prop="businessUnitType" label="核算类型" width="120" />
          <el-table-column prop="supportQty" label="配套量" width="110" />
          <el-table-column prop="annualVolume" label="年用量" width="120" />
          <el-table-column prop="validDate" label="有效期" width="130" />
          <template #empty>
            <el-empty description="暂无产品行" />
          </template>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`费用项 ${selectedFees.length}`" name="fees">
        <el-table :data="selectedFees" border stripe>
          <el-table-column prop="scope" label="范围" width="100" />
          <el-table-column prop="itemSeq" label="产品序号" width="110">
            <template #default="{ row }">{{ formatValue(row.itemSeq) }}</template>
          </el-table-column>
          <el-table-column prop="feeCode" label="费用编码" min-width="150" />
          <el-table-column prop="feeName" label="费用名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="feeCategory" label="费用分类" width="120" />
          <el-table-column prop="amount" label="金额" width="130" />
          <el-table-column prop="unit" label="单位" width="90" />
          <el-table-column prop="sourceFieldName" label="来源字段" min-width="160" show-overflow-tooltip />
          <template #empty>
            <el-empty description="暂无费用项" />
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  DocumentChecked,
  Download,
  RefreshRight,
  UploadFilled,
} from '@element-plus/icons-vue'
import {
  commitQuoteExcel,
  downloadQuoteExcelTemplate,
  fetchQuoteExcelTemplates,
  previewQuoteExcel,
} from '../../../../api/quoteIngest'
import {
  canCommitQuoteExcelPreview,
  downloadBlob,
  getQuoteImportFile,
  getQuoteImportFileName,
  normalizeQuoteExcelCommitResponse,
  normalizeQuoteExcelPreview,
  validateQuoteImportFile,
} from '../../../../utils/quoteImport'
import QuoteImportIssueTable from './components/QuoteImportIssueTable.vue'
import QuoteImportPreviewSummary from './components/QuoteImportPreviewSummary.vue'

const router = useRouter()

const templates = ref([])
const templateLoading = ref(false)
const templateError = ref('')
const downloadingTemplateType = ref('')
const selectedFile = ref(null)
const selectedFileName = ref('')
const preview = ref(null)
const previewError = ref('')
const previewing = ref(false)
const committing = ref(false)
const commitResults = ref([])
const selectedFormIndex = ref(0)
const activeTab = ref('forms')

const previewSummary = computed(() =>
  normalizeQuoteExcelPreview(preview.value, selectedFileName.value)
)

const selectedForm = computed(() => previewSummary.value.forms[selectedFormIndex.value] || {})
const selectedItems = computed(() => selectedForm.value.items || [])
const selectedFees = computed(() => selectedForm.value.extraFees || [])

const canCommit = computed(
  () =>
    selectedFile.value &&
    canCommitQuoteExcelPreview(preview.value) &&
    !previewing.value &&
    !committing.value
)

const accountingFields = computed(() => {
  const context = selectedForm.value.accountingContext || {}
  return [
    { key: 'businessUnitType', label: '核算类型', value: context.businessUnitType },
    { key: 'accountingPeriodMonth', label: '核算年月', value: context.accountingPeriodMonth },
    { key: 'expenseProductCategory', label: '费用产品分类', value: context.expenseProductCategory },
    { key: 'sourceCompany', label: '所属公司', value: context.sourceCompany },
    { key: 'sourceBusinessDivision', label: '所属事业部', value: context.sourceBusinessDivision },
    { key: 'customer', label: '客户', value: context.customer },
    { key: 'productAttr', label: '产品属性', value: context.productAttr },
    { key: 'quoteScenario', label: '报价场景', value: context.quoteScenario },
    { key: 'classificationStatus', label: '分类状态', value: context.classificationStatus },
    { key: 'ruleCode', label: '规则编码', value: context.ruleCode },
    { key: 'confidence', label: '置信度', value: context.confidence },
  ]
})

const headerFields = computed(() => {
  const header = selectedForm.value.headerSummary || {}
  return [
    { key: 'sourceType', label: '来源类型', value: header.sourceType },
    { key: 'sourceSystem', label: '来源系统', value: header.sourceSystem },
    { key: 'externalFormNo', label: '外部单号', value: header.externalFormNo },
    { key: 'oaNo', label: 'OA 单号', value: header.oaNo },
    { key: 'processCode', label: '流程编号', value: header.processCode },
    { key: 'processName', label: '流程名称', value: header.processName },
    { key: 'formType', label: '表单类型', value: header.formType },
    { key: 'applyDate', label: '申请日期', value: header.applyDate },
    { key: 'customer', label: '客户', value: header.customer },
    { key: 'applicantUnit', label: '申请单位', value: header.applicantUnit },
    { key: 'sourceCompany', label: '所属公司', value: header.sourceCompany },
    { key: 'sourceBusinessDivision', label: '所属事业部', value: header.sourceBusinessDivision },
    { key: 'expenseProductCategory', label: '费用产品分类', value: header.expenseProductCategory },
    { key: 'applicantDept', label: '申请部门', value: header.applicantDept },
    { key: 'applicantOffice', label: '申请处室', value: header.applicantOffice },
    { key: 'applicantName', label: '申请人', value: header.applicantName },
    { key: 'urgency', label: '紧急程度', value: header.urgency },
    { key: 'productAttr', label: '产品属性', value: header.productAttr },
    { key: 'priceLinkMode', label: '联动情况', value: header.priceLinkMode },
    { key: 'overseasSalesMode', label: '海外销售', value: header.overseasSalesMode },
    { key: 'tradeTerms', label: '贸易方式', value: header.tradeTerms },
    { key: 'exchangeRate', label: '汇率', value: header.exchangeRate },
    { key: 'copperPrice', label: '铜基价', value: header.copperPrice },
    { key: 'zincPrice', label: '锌基价', value: header.zincPrice },
    { key: 'aluminumPrice', label: '铝基价', value: header.aluminumPrice },
    { key: 'steelPrice', label: '不锈钢基价', value: header.steelPrice },
    { key: 'sus304Price', label: 'SUS304 基价', value: header.sus304Price },
    { key: 'sus316lPrice', label: 'SUS316L 基价', value: header.sus316lPrice },
    { key: 'silverPrice', label: '银基价', value: header.silverPrice },
    { key: 'goldPrice', label: '金基价', value: header.goldPrice },
    { key: 'remark', label: '备注', value: header.remark },
  ]
})

watch(
  () => previewSummary.value.forms.length,
  (length) => {
    if (length === 0 || selectedFormIndex.value >= length) {
      selectedFormIndex.value = 0
    }
  }
)

function formatValue(value) {
  return value === undefined || value === null || value === '' ? '-' : value
}

function goList() {
  router.push('/ingest/quote-requests')
}

function resetImport() {
  selectedFile.value = null
  selectedFileName.value = ''
  preview.value = null
  previewError.value = ''
  commitResults.value = []
  selectedFormIndex.value = 0
  activeTab.value = 'forms'
}

async function loadTemplates() {
  templateLoading.value = true
  templateError.value = ''
  try {
    const rows = await fetchQuoteExcelTemplates()
    templates.value = Array.isArray(rows) ? rows : []
  } catch (error) {
    templateError.value = error?.message || '模板列表加载失败'
    ElMessage.error(templateError.value)
  } finally {
    templateLoading.value = false
  }
}

async function handleDownloadTemplate(template) {
  downloadingTemplateType.value = template.templateType
  try {
    const result = await downloadQuoteExcelTemplate(template.templateType)
    downloadBlob(result.blob, result.fileName || template.fileName || `${template.templateType}.xlsx`)
  } catch (error) {
    ElMessage.error(error?.message || '模板下载失败')
  } finally {
    downloadingTemplateType.value = ''
  }
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
  commitResults.value = []
  selectedFormIndex.value = 0
  activeTab.value = 'forms'
  previewing.value = true

  try {
    const response = await previewQuoteExcel(file)
    preview.value = response
    const summary = normalizeQuoteExcelPreview(response, selectedFileName.value)
    activeTab.value = summary.errorCount > 0 ? 'errors' : 'accounting'
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
    commitResults.value = normalizeQuoteExcelCommitResponse(response)
    ElMessage.success('导入成功')
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    committing.value = false
  }
}

onMounted(loadTemplates)
</script>

<style scoped>
.quote-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head,
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-head h1,
.section-head h2 {
  margin: 0;
  color: #1f2a37;
  font-weight: 600;
}

.page-head h1 {
  font-size: 20px;
}

.section-head h2 {
  font-size: 16px;
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

.template-panel,
.result-panel,
.preview-tabs {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.template-panel,
.result-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.state-alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-detail-head {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.form-select {
  width: 280px;
}

@media (max-width: 860px) {
  .page-head,
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .upload-panel {
    grid-template-columns: 1fr;
  }

  .form-detail-head {
    justify-content: stretch;
  }

  .form-select {
    width: 100%;
  }
}
</style>
