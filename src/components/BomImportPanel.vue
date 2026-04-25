<template>
  <!-- BOM 三阶段流程 · 阶段 A：Excel 导入面板
       上传 .xlsx → 返回 importBatchId + 行数统计 + 错误明细 -->
  <el-card shadow="never" class="stage-panel" :class="{ 'stage-panel-done': !!batchId }">
    <template #header>
      <div class="panel-header">
        <div class="panel-index">1</div>
        <div class="panel-title">导入 U9 BOM Excel</div>
        <el-tag v-if="batchId" type="success">已导入</el-tag>
      </div>
    </template>

    <el-upload
      class="bom-upload"
      drag
      :show-file-list="false"
      :auto-upload="false"
      accept=".xlsx,.xls"
      :on-change="handleFileChange"
      :disabled="importing"
    >
      <el-icon class="upload-icon"><icon-upload /></el-icon>
      <div class="upload-text">
        将 Excel 拖到此处，或<em>点击选择文件</em>
      </div>
      <div class="upload-hint">
        仅支持 .xlsx/.xls，大文件（34 万行）约需 2 分钟，请耐心等待
      </div>
    </el-upload>

    <!-- 上传中进度 -->
    <div v-if="importing" class="import-progress">
      <el-progress
        :percentage="100"
        :indeterminate="true"
        :duration="3"
        status="warning"
      />
      <div class="progress-text">正在读取并写入数据库，勿关闭页面...</div>
    </div>

    <!-- 导入结果摘要 -->
    <div v-if="result" class="import-result">
      <el-descriptions :column="2" size="small" border>
        <el-descriptions-item label="批次 ID">
          <el-tag type="primary" size="small">{{ result.importBatchId }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="文件名">
          {{ result.sourceFileName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="总行数">
          {{ result.totalRows }}
        </el-descriptions-item>
        <el-descriptions-item label="成功行数">
          <span :class="successClass">
            {{ result.successRows }} / {{ result.totalRows }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="错误行数" :span="2">
          <span v-if="(result.errors || []).length === 0" class="zero-error">0</span>
          <el-popover
            v-else
            placement="top"
            :width="520"
            trigger="click"
            title="错误行明细（最多 50 条）"
          >
            <template #reference>
              <el-button link type="danger">{{ result.errors.length }} 条（点击查看）</el-button>
            </template>
            <el-table :data="result.errors.slice(0, 50)" size="small" max-height="300">
              <el-table-column prop="rowIndex" label="行号" width="80" />
              <el-table-column prop="reason" label="原因" />
            </el-table>
          </el-popover>
        </el-descriptions-item>
        <el-descriptions-item label="导入时间" :span="2">
          {{ result.importedAt }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-card>
</template>

<script setup>
// BomImportPanel —— 薄封装：上传 + 展示，不管 batchId 往下游的传递（由父页面 emit 后接管）
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled as IconUpload } from '@element-plus/icons-vue'
import { importBomExcel } from '../api/bom'

const props = defineProps({
  // 父页面可选择外部传入 result 以跨 panel 持久显示
  initialResult: { type: Object, default: null },
})

const emit = defineEmits([
  // 导入成功后把完整 result 抛给父页面，其中包含 importBatchId 供下一阶段使用
  'imported',
])

const importing = ref(false)
const result = ref(props.initialResult)

const batchId = computed(() => result.value?.importBatchId || null)
const successClass = computed(() => {
  if (!result.value) return ''
  return result.value.successRows === result.value.totalRows ? 'all-ok' : 'partial-ok'
})

async function handleFileChange(uploadFile) {
  const rawFile = uploadFile?.raw
  if (!rawFile) return

  // 简单类型校验 —— 后端还会再校一次，这里只是避免明显错误
  const name = rawFile.name?.toLowerCase() || ''
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    ElMessage.warning('仅支持 .xlsx / .xls 格式')
    return
  }

  importing.value = true
  try {
    const data = await importBomExcel(rawFile)
    result.value = data
    const ok = data.successRows === data.totalRows
    ElMessage[ok ? 'success' : 'warning'](
      `导入完成：成功 ${data.successRows} / ${data.totalRows} 行`
    )
    emit('imported', data)
  } catch (error) {
    // errorHandler 已弹 toast；这里只做局部兜底
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.stage-panel {
  margin-bottom: 16px;
}
.stage-panel-done :deep(.el-card__header) {
  background: #f0f9eb;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.panel-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
}
.bom-upload :deep(.el-upload-dragger) {
  padding: 24px;
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
.import-progress {
  margin-top: 16px;
}
.progress-text {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  text-align: center;
}
.import-result {
  margin-top: 16px;
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
</style>
