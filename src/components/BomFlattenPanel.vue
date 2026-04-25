<template>
  <!-- BOM 三阶段流程 · 阶段 C：拍平面板
       按 asOfDate + 规则把 raw_hierarchy 合成 lp_bom_costing_row -->
  <el-card
    shadow="never"
    class="stage-panel"
    :class="{
      'stage-panel-disabled': !ready,
      'stage-panel-done': !!result,
    }"
  >
    <template #header>
      <div class="panel-header">
        <div class="panel-index">3</div>
        <div class="panel-title">拍平成结算行（costing_row）</div>
        <el-tag v-if="result" type="success">已拍平</el-tag>
        <el-tooltip v-else-if="!ready" content="需先完成层级构建">
          <el-tag type="info">等待构建</el-tag>
        </el-tooltip>
      </div>
    </template>

    <el-form :model="form" label-width="120px" inline>
      <el-form-item label="拍平模式">
        <el-select v-model="form.mode" style="width: 220px">
          <el-option
            v-for="opt in FLATTEN_MODE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.mode === 'BY_OA'" label="OA 单号">
        <el-input
          v-model="form.oaNo"
          placeholder="例：OA-GOLDEN-001"
          style="width: 200px"
        />
      </el-form-item>
      <!-- BY_OA 和 BY_PRODUCT 都需要 topProductCode（BY_OA 支持一个 OA 下多个顶层产品时指定某一个） -->
      <el-form-item
        v-if="form.mode === 'BY_OA' || form.mode === 'BY_PRODUCT'"
        label="顶层料号"
      >
        <el-input
          v-model="form.topProductCode"
          placeholder="例：1079900000536"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="BOM 目的">
        <el-select
          v-model="form.bomPurpose"
          placeholder="（全部）"
          clearable
          style="width: 140px"
        >
          <el-option label="全部" value="" />
          <el-option label="主制造" value="主制造" />
          <el-option label="普机" value="普机" />
          <el-option label="精益" value="精益" />
        </el-select>
      </el-form-item>
      <el-form-item label="asOfDate" required>
        <el-date-picker
          v-model="form.asOfDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="必填，决定取哪个版本"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canSubmit"
          @click="submit"
        >
          拍平
        </el-button>
      </el-form-item>
    </el-form>

    <div v-if="result" class="flatten-result">
      <el-descriptions :column="3" size="small" border>
        <el-descriptions-item label="写入 costing_row">
          <span class="ok-count">{{ result.costingRowsWritten }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="需子树合成数">
          {{ result.subtreeRequiredCount }}
        </el-descriptions-item>
        <el-descriptions-item label="警告条数">
          <span :class="warnClass">{{ (result.warnings || []).length }}</span>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="(result.warnings || []).length > 0"
          label="警告明细"
          :span="3"
        >
          <div class="warn-list">
            <el-tag
              v-for="(w, i) in result.warnings"
              :key="i"
              type="warning"
              size="small"
              class="warn-tag"
            >{{ w }}</el-tag>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-card>
</template>

<script setup>
// BomFlattenPanel —— 阶段 C；ready 门控由父页面从阶段 B 的成功状态传入
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { flattenBom, FLATTEN_MODE_OPTIONS } from '../api/bom'

const props = defineProps({
  // 父页面通过 ready 告诉本组件阶段 B 是否完成
  ready: { type: Boolean, default: false },
  // 默认 asOfDate；父页面可透传选中的日期
  defaultAsOfDate: { type: String, default: '' },
})

const emit = defineEmits(['flattened'])

const form = ref({
  mode: 'BY_OA',
  oaNo: '',
  topProductCode: '',
  bomPurpose: '',
  asOfDate: props.defaultAsOfDate || new Date().toISOString().slice(0, 10),
})

const loading = ref(false)
const result = ref(null)

const canSubmit = computed(() => {
  if (!props.ready) return false
  if (!form.value.asOfDate) return false
  // BY_OA 模式需 oaNo + topProductCode（后端 validate 两个都要）
  if (form.value.mode === 'BY_OA'
      && (!form.value.oaNo || !form.value.topProductCode)) return false
  if (form.value.mode === 'BY_PRODUCT' && !form.value.topProductCode) return false
  return true
})

const warnClass = computed(() => {
  if (!result.value) return ''
  return (result.value.warnings || []).length === 0 ? 'zero-error' : 'warn-count'
})

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const payload = {
      mode: form.value.mode,
      oaNo: form.value.mode === 'BY_OA' ? form.value.oaNo.trim() : null,
      // BY_OA 和 BY_PRODUCT 都传 topProductCode（后端两种模式都要）
      topProductCode:
        form.value.mode === 'BY_OA' || form.value.mode === 'BY_PRODUCT'
          ? form.value.topProductCode.trim()
          : null,
      // 空串不能传 —— 后端 null 语义 = 全部 purpose
      bomPurpose: form.value.bomPurpose ? form.value.bomPurpose.trim() : null,
      asOfDate: form.value.asOfDate,
    }
    const data = await flattenBom(payload)
    result.value = data
    ElMessage.success(
      `拍平完成：写入 ${data.costingRowsWritten} 行结算数据`
    )
    emit('flattened', data)
  } catch (error) {
    ElMessage.error(error?.message || '拍平失败')
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
.flatten-result {
  margin-top: 12px;
}
.ok-count {
  color: #67c23a;
  font-weight: 600;
}
.zero-error {
  color: #67c23a;
}
.warn-count {
  color: #e6a23c;
  font-weight: 600;
}
.warn-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.warn-tag {
  max-width: 100%;
  white-space: normal;
  height: auto;
  line-height: 1.4;
  padding: 4px 8px;
}
</style>
