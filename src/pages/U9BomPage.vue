<template>
  <!-- U9 BOM 明细（财务视图，T7 后续简化）
       一步到位：点上传 → 后端自动做"入库 + 展开层级"两步 → 可直接跳转查看树
       原三阶段页面保留在 /admin/bom-pipeline，面向 IT / 测试。 -->
  <div class="base-page">
    <el-card shadow="never" class="page-header-card">
      <div class="page-header">
        <div class="page-title">U9 BOM 明细</div>
        <div class="page-subtitle">
          上传 U9 导出的 BOM Excel，系统自动入库并展开层级；完成后可直接跳转到"BOM 层级树"查看结果。
        </div>
      </div>
    </el-card>

    <!-- 上传面板 -->
    <el-card shadow="never" class="upload-card" :class="{ 'upload-done': !!lastResult }">
      <template #header>
        <div class="panel-header">
          <div class="panel-title">上传并处理</div>
          <el-tag v-if="lastResult" :type="statusTagType">
            {{ statusLabel }}
          </el-tag>
        </div>
      </template>

      <el-upload
        class="bom-upload"
        drag
        :show-file-list="false"
        :auto-upload="false"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :disabled="processing"
      >
        <el-icon class="upload-icon"><icon-upload /></el-icon>
        <div class="upload-text">
          将 Excel 拖到此处，或<em>点击选择文件</em>
        </div>
        <div class="upload-hint">
          仅支持 .xlsx/.xls；34 万行 Excel 约需 3-5 分钟，请耐心等待，勿关闭页面
        </div>
      </el-upload>

      <!-- 进度条 -->
      <div v-if="processing" class="progress-section">
        <el-progress
          :percentage="100"
          :indeterminate="true"
          :duration="3"
          status="warning"
        />
        <div class="progress-text">{{ progressText }}</div>
      </div>

      <!-- 处理结果 -->
      <div v-if="lastResult" class="result-section">
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="文件名">
            {{ lastResult.importResult?.sourceFileName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="导入时间">
            {{ lastResult.importResult?.importedAt || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="导入总行数">
            {{ lastResult.importResult?.totalRows ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="成功行数">
            <span :class="successClass">
              {{ lastResult.importResult?.successRows ?? '-' }}
              / {{ lastResult.importResult?.totalRows ?? '-' }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="错误行数" :span="2">
            <span
              v-if="(lastResult.importResult?.errors || []).length === 0"
              class="zero-error"
            >0</span>
            <el-popover
              v-else
              placement="top"
              :width="520"
              trigger="click"
              title="错误行明细（最多 50 条）"
            >
              <template #reference>
                <el-button link type="danger">
                  {{ lastResult.importResult.errors.length }} 条（点击查看）
                </el-button>
              </template>
              <el-table
                :data="lastResult.importResult.errors.slice(0, 50)"
                size="small"
                max-height="300"
              >
                <el-table-column prop="rowIndex" label="行号" width="80" />
                <el-table-column prop="reason" label="原因" />
              </el-table>
            </el-popover>
          </el-descriptions-item>
          <el-descriptions-item label="展开的 BOM 用途" :span="2">
            <el-tag
              v-for="p in lastResult.purposesBuilt || []"
              :key="p"
              size="small"
              class="purpose-tag"
            >{{ p }}</el-tag>
            <span v-if="(lastResult.purposesBuilt || []).length === 0" class="dim">（未展开）</span>
          </el-descriptions-item>
          <el-descriptions-item label="层级总行数">
            {{ lastResult.totalRawRowsWritten ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="构建批次数">
            {{ (lastResult.builds || []).length }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="action-row">
          <el-button type="primary" @click="goToTree">查看 BOM 层级树</el-button>
          <el-button @click="reset">再导一次</el-button>
        </div>
      </div>
    </el-card>

    <!-- 历史批次快览 -->
    <BomBatchHistoryTable :refresh-token="historyToken" />
  </div>
</template>

<script setup>
// U9BomPage —— 财务视图：一键上传 → 后端自动完成入库 + 展开
// 后端端点 POST /api/v1/bom/import-and-build
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled as IconUpload } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { importAndBuildBom } from '../api/bom'
import BomBatchHistoryTable from '../components/BomBatchHistoryTable.vue'

const router = useRouter()

const processing = ref(false)
const progressText = ref('')
const lastResult = ref(null)
const historyToken = ref(0)

const statusLabel = computed(() => {
  const s = lastResult.value?.status
  if (s === 'SUCCESS') return '完成'
  if (s === 'PARTIAL_BUILD_FAILED') return '部分完成'
  if (s === 'IMPORT_FAILED') return '导入失败'
  return ''
})

const statusTagType = computed(() => {
  const s = lastResult.value?.status
  if (s === 'SUCCESS') return 'success'
  if (s === 'PARTIAL_BUILD_FAILED') return 'warning'
  if (s === 'IMPORT_FAILED') return 'danger'
  return 'info'
})

const successClass = computed(() => {
  const r = lastResult.value?.importResult
  if (!r) return ''
  return r.successRows === r.totalRows ? 'all-ok' : 'partial-ok'
})

async function handleFileChange(uploadFile) {
  const rawFile = uploadFile?.raw
  if (!rawFile) return

  const name = rawFile.name?.toLowerCase() || ''
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    ElMessage.warning('仅支持 .xlsx / .xls 格式')
    return
  }

  processing.value = true
  progressText.value = '正在读取 Excel 并写入数据库（约 2 分钟）...'
  try {
    // 1 分钟后把文案切换，引导用户耐心等待构建阶段
    const t = setTimeout(() => {
      progressText.value = '导入完成，正在展开 BOM 多层结构...'
    }, 60 * 1000)

    const data = await importAndBuildBom(rawFile)
    clearTimeout(t)
    lastResult.value = data
    historyToken.value = Date.now()

    if (data.status === 'SUCCESS') {
      ElMessage.success(
        `处理完成：入库 ${data.importResult?.successRows} 行，展开 ${data.totalRawRowsWritten} 行层级`
      )
    } else if (data.status === 'PARTIAL_BUILD_FAILED') {
      ElMessage.warning(
        `导入成功，部分 BOM 用途展开失败（已处理 ${(data.purposesBuilt || []).length} 个）`
      )
    } else {
      ElMessage.error(data.errorMessage || 'BOM 导入失败')
    }
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    processing.value = false
    progressText.value = ''
  }
}

function goToTree() {
  router.push('/base/bomTree')
}

function reset() {
  lastResult.value = null
}
</script>

<style scoped>
.base-page {
  padding: 16px;
}
.page-header-card {
  margin-bottom: 16px;
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.page-subtitle {
  font-size: 12px;
  color: #909399;
}
.upload-card {
  margin-bottom: 16px;
}
.upload-done :deep(.el-card__header) {
  background: #f0f9eb;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
}
.bom-upload :deep(.el-upload-dragger) {
  padding: 32px;
}
.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
}
.upload-text {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}
.upload-text em {
  color: #409eff;
  font-style: normal;
}
.upload-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.progress-section {
  margin-top: 16px;
}
.progress-text {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  text-align: center;
}
.result-section {
  margin-top: 16px;
}
.action-row {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.all-ok {
  color: #67c23a;
  font-weight: 600;
}
.partial-ok {
  color: #e6a23c;
  font-weight: 600;
}
.zero-error {
  color: #67c23a;
}
.purpose-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}
.dim {
  color: #909399;
}
</style>
