<template>
  <cms-cost-page-shell title="CMS 成本数据导入">
    <template #actions>
      <el-button :icon="Link" @click="goMaterialScrapImport">
        回收废料映射导入
      </el-button>
    </template>

    <div class="cms-import">
      <div class="cms-import__uploads">
        <section
          v-for="item in uploadItems"
          :key="item.key"
          class="cms-import__upload"
        >
          <div class="cms-import__upload-head">
            <span>{{ item.label }}</span>
            <el-tag v-if="files[item.key]" type="success" effect="plain">已选择</el-tag>
            <el-tag v-else type="info" effect="plain">未选择</el-tag>
          </div>

          <el-upload
            drag
            :auto-upload="false"
            :limit="1"
            :show-file-list="false"
            accept=".xlsx,.xls"
            :disabled="submitting"
            :on-change="(file) => handleFileChange(item.key, file)"
          >
            <el-icon class="cms-import__upload-icon"><UploadFilled /></el-icon>
            <div class="cms-import__upload-title">{{ item.uploadTitle }}</div>
            <div class="cms-import__upload-tip">.xlsx / .xls，20MB 内</div>
          </el-upload>

          <el-alert
            v-if="fileNames[item.key]"
            class="cms-import__file"
            :title="fileNames[item.key]"
            type="info"
            show-icon
            :closable="false"
          />
        </section>
      </div>

      <div class="cms-import__toolbar">
        <el-checkbox v-model="dryRun" :disabled="submitting">试运行</el-checkbox>
        <div class="cms-import__actions">
          <el-button :icon="RefreshRight" :disabled="submitting || !hasAnyFile" @click="resetForm">
            清空
          </el-button>
          <el-button
            type="primary"
            :icon="DocumentChecked"
            :loading="submitting"
            @click="handleSubmit"
          >
            确认导入
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="submitError"
        :title="submitError"
        type="error"
        show-icon
        :closable="false"
      />

      <section v-if="result" class="cms-import__result">
        <div class="cms-import__result-head">
          <div>
            <div class="cms-import__result-title">导入结果</div>
            <div class="cms-import__result-subtitle">
              {{ result.batchNo || '-' }}
            </div>
          </div>
          <el-tag :type="result.errorCount > 0 ? 'danger' : 'success'" effect="plain">
            {{ result.status || '-' }}
          </el-tag>
        </div>

        <el-row :gutter="12">
          <el-col v-for="stat in stats" :key="stat.label" :xs="12" :sm="8" :md="6">
            <div class="cms-import__stat">
              <span>{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
            </div>
          </el-col>
        </el-row>

        <el-alert
          v-if="result.errorMessage"
          class="cms-import__error-message"
          :title="result.errorMessage"
          type="warning"
          show-icon
          :closable="false"
        />

      </section>
    </div>
  </cms-cost-page-shell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DocumentChecked,
  Link,
  RefreshRight,
  UploadFilled,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  canSubmitCmsCostImport,
  getCmsCostUploadFile,
  getCmsCostUploadFileName,
  importCmsCostExcel,
  missingCmsCostFileLabel,
  normalizeCmsCostImportResult,
  validateCmsCostFile,
} from '../api/cmsCost'
import CmsCostPageShell from '../components/CmsCostPageShell.vue'

const router = useRouter()
const uploadItems = [
  {
    key: 'planFile',
    label: '产品计划成本汇总',
    uploadTitle: '上传计划成本汇总',
  },
  {
    key: 'workshopFile',
    label: '产品车间料工费汇总',
    uploadTitle: '上传车间料工费汇总',
  },
  {
    key: 'subjectFile',
    label: '产品科目成本汇总',
    uploadTitle: '上传科目成本汇总',
  },
  {
    key: 'subjectSettingFile',
    label: '科目设置导出',
    uploadTitle: '上传科目设置导出',
  },
]

const files = reactive({
  planFile: null,
  workshopFile: null,
  subjectFile: null,
  subjectSettingFile: null,
})
const fileNames = reactive({
  planFile: '',
  workshopFile: '',
  subjectFile: '',
  subjectSettingFile: '',
})
const dryRun = ref(false)
const submitting = ref(false)
const submitError = ref('')
const result = ref(null)

const hasAnyFile = computed(() =>
  Boolean(files.planFile || files.workshopFile || files.subjectFile || files.subjectSettingFile)
)

const stats = computed(() => {
  const row = result.value || {}
  return [
    { label: '计划成本行数', value: row.planRowCount || 0 },
    { label: '车间料工费行数', value: row.workshopRowCount || 0 },
    { label: '科目成本行数', value: row.subjectRowCount || 0 },
    { label: '科目设置行数', value: row.subjectSettingRowCount || 0 },
    { label: '工资新增', value: row.salaryInsertCount || 0 },
    { label: '工资跳过', value: row.salarySkipCount || 0 },
    { label: '工资阻断', value: row.salaryBlockedCount || 0 },
    { label: '辅料新增', value: row.auxInsertCount || 0 },
    { label: '辅料跳过', value: row.auxSkipCount || 0 },
    { label: '异常数量', value: row.errorCount || 0 },
  ]
})

function goMaterialScrapImport() {
  router.push('/base/cms-cost/material-scrap-refs')
}

function handleFileChange(key, uploadFile) {
  const file = getCmsCostUploadFile(uploadFile)
  const validation = validateCmsCostFile(file)
  if (!validation.valid) {
    files[key] = null
    fileNames[key] = ''
    ElMessage.warning(validation.message)
    return
  }

  files[key] = file
  fileNames[key] = getCmsCostUploadFileName(file)
  submitError.value = ''
}

function resetForm() {
  files.planFile = null
  files.workshopFile = null
  files.subjectFile = null
  files.subjectSettingFile = null
  fileNames.planFile = ''
  fileNames.workshopFile = ''
  fileNames.subjectFile = ''
  fileNames.subjectSettingFile = ''
  submitError.value = ''
  result.value = null
}

async function handleSubmit() {
  if (!canSubmitCmsCostImport(files)) {
    ElMessage.warning(`请先选择${missingCmsCostFileLabel(files)}`)
    return
  }

  submitting.value = true
  submitError.value = ''
  try {
    const response = await importCmsCostExcel({
      planFile: files.planFile,
      workshopFile: files.workshopFile,
      subjectFile: files.subjectFile,
      subjectSettingFile: files.subjectSettingFile,
      dryRun: dryRun.value,
    })
    result.value = normalizeCmsCostImportResult(response)
    ElMessage[result.value.errorCount > 0 ? 'warning' : 'success'](
      result.value.errorCount > 0 ? '导入完成，存在异常' : '导入成功'
    )
  } catch (error) {
    submitError.value = error?.message || '导入失败'
    ElMessage.error(submitError.value)
  } finally {
    submitting.value = false
  }
}

</script>

<style scoped>
.cms-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cms-import__uploads {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.cms-import__upload {
  min-width: 0;
}

.cms-import__upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #1f2a37;
  font-size: 14px;
  font-weight: 600;
}

.cms-import__upload :deep(.el-upload),
.cms-import__upload :deep(.el-upload-dragger) {
  width: 100%;
}

.cms-import__upload :deep(.el-upload-dragger) {
  min-height: 158px;
  border-radius: 6px;
}

.cms-import__upload-icon {
  margin-top: 16px;
  color: #2563eb;
  font-size: 38px;
}

.cms-import__upload-title {
  margin-top: 8px;
  color: #1f2a37;
  font-size: 15px;
  font-weight: 600;
}

.cms-import__upload-tip {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.cms-import__file {
  margin-top: 8px;
}

.cms-import__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cms-import__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.cms-import__result {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.cms-import__result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.cms-import__result-title {
  color: #1f2a37;
  font-size: 16px;
  font-weight: 600;
}

.cms-import__result-subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}

.cms-import__stat {
  display: flex;
  min-height: 68px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f9fafb;
}

.cms-import__stat span {
  color: #6b7280;
  font-size: 13px;
}

.cms-import__stat strong {
  color: #1f2a37;
  font-size: 20px;
  line-height: 1.2;
}

.cms-import__error-message {
  margin-top: 4px;
}

@media (max-width: 980px) {
  .cms-import__uploads {
    grid-template-columns: 1fr;
  }

  .cms-import__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .cms-import__actions {
    justify-content: flex-start;
  }
}
</style>
