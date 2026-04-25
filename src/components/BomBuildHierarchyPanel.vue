<template>
  <!-- BOM 三阶段流程 · 阶段 B：层级构建面板
       用 importBatchId 把 u9_source 行按 parent_code 编织成 raw_hierarchy 树 -->
  <el-card
    shadow="never"
    class="stage-panel"
    :class="{
      'stage-panel-disabled': !importBatchId,
      'stage-panel-done': !!result,
    }"
  >
    <template #header>
      <div class="panel-header">
        <div class="panel-index">2</div>
        <div class="panel-title">构建层级（raw_hierarchy）</div>
        <el-tag v-if="result" type="success">已构建</el-tag>
        <el-tooltip v-else-if="!importBatchId" content="先完成导入才能构建层级">
          <el-tag type="info">等待导入</el-tag>
        </el-tooltip>
      </div>
    </template>

    <el-form :model="form" label-width="120px" inline>
      <el-form-item label="导入批次">
        <el-input
          v-model="form.importBatchId"
          :placeholder="importBatchId || '需先完成阶段 1 导入'"
          :disabled="!!importBatchId"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="BOM 目的">
        <el-select
          v-model="form.bomPurpose"
          placeholder="（全部）"
          clearable
          style="width: 160px"
        >
          <el-option label="全部" value="" />
          <el-option label="主制造" value="主制造" />
          <el-option label="普机" value="普机" />
          <el-option label="精益" value="精益" />
        </el-select>
      </el-form-item>
      <el-form-item label="构建模式">
        <el-select v-model="form.mode" style="width: 220px">
          <el-option
            v-for="opt in BUILD_MODE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.mode === 'BY_PRODUCT'" label="顶层料号">
        <el-input
          v-model="form.topProductCode"
          placeholder="例：1079900000536"
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canSubmit"
          @click="submit"
        >
          构建层级
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 构建结果摘要 -->
    <div v-if="result" class="build-result">
      <el-descriptions :column="3" size="small" border>
        <el-descriptions-item label="构建批次">
          <el-tag type="primary" size="small">{{ result.buildBatchId }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="处理产品数">
          {{ result.productsProcessed }}
        </el-descriptions-item>
        <el-descriptions-item label="写入行数">
          {{ result.rowsWritten }}
        </el-descriptions-item>
        <el-descriptions-item label="失败产品" :span="3">
          <template v-if="(result.failedProducts || []).length === 0">
            <span class="zero-error">0</span>
          </template>
          <template v-else>
            <el-tag
              v-for="code in result.failedProducts"
              :key="code"
              size="small"
              type="danger"
              class="failed-tag"
            >{{ code }}</el-tag>
          </template>
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-card>
</template>

<script setup>
// BomBuildHierarchyPanel —— 阶段 B，importBatchId 为空时整个面板禁用
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { buildBomHierarchy, BUILD_MODE_OPTIONS } from '../api/bom'

const props = defineProps({
  importBatchId: { type: String, default: '' },
})

const emit = defineEmits(['built'])

const form = ref({
  importBatchId: props.importBatchId || '',
  bomPurpose: '',
  mode: 'ALL',
  topProductCode: '',
})

watch(
  () => props.importBatchId,
  (val) => {
    form.value.importBatchId = val || ''
  }
)

const loading = ref(false)
const result = ref(null)

const canSubmit = computed(() => {
  if (!form.value.importBatchId) return false
  if (form.value.mode === 'BY_PRODUCT' && !form.value.topProductCode) return false
  return true
})

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const payload = {
      importBatchId: form.value.importBatchId.trim(),
      // 空字符串不能传 —— 后端 null 语义 = 全部 purpose
      bomPurpose: form.value.bomPurpose ? form.value.bomPurpose.trim() : null,
      mode: form.value.mode,
      topProductCode:
        form.value.mode === 'BY_PRODUCT'
          ? form.value.topProductCode.trim()
          : null,
    }
    const data = await buildBomHierarchy(payload)
    result.value = data
    const failed = (data.failedProducts || []).length
    ElMessage[failed === 0 ? 'success' : 'warning'](
      `构建完成：${data.productsProcessed} 个产品，${data.rowsWritten} 行，失败 ${failed} 个`
    )
    emit('built', data)
  } catch (error) {
    ElMessage.error(error?.message || '构建失败')
  } finally {
    loading.value = false
  }
}

defineExpose({ reset: () => (result.value = null) })
</script>

<style scoped>
.stage-panel {
  margin-bottom: 16px;
}
.stage-panel-disabled {
  opacity: 0.6;
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
.build-result {
  margin-top: 12px;
}
.failed-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}
.zero-error {
  color: #67c23a;
}
</style>
