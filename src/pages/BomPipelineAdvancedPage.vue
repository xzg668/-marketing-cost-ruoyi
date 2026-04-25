<template>
  <!-- U9 BOM 三阶段流程页（T6）：导入 → 构建层级 → 拍平
       阶段按钮联动禁用；阶段完成后把 batchId 流转给下游；底部批次历史同步刷新 -->
  <div class="base-page">
    <el-card shadow="never" class="page-header-card">
      <div class="page-header">
        <div class="page-title">U9 BOM 明细（三阶段）</div>
        <div class="page-subtitle">
          从 Excel 导入到结算行的完整流程，每阶段独立触发
        </div>
      </div>
    </el-card>

    <!-- 阶段 A：Excel 导入 -->
    <BomImportPanel
      :initial-result="importResult"
      @imported="onImported"
    />

    <!-- 阶段 B：层级构建 -->
    <BomBuildHierarchyPanel
      :import-batch-id="importBatchId"
      @built="onBuilt"
    />

    <!-- 阶段 C：拍平 -->
    <BomFlattenPanel
      :ready="!!buildBatchId"
      :default-as-of-date="defaultAsOfDate"
      @flattened="onFlattened"
    />

    <!-- 批次历史只读表 —— refreshToken 变化时强制拉新数据 -->
    <BomBatchHistoryTable :refresh-token="historyRefresh" />
  </div>
</template>

<script setup>
// U9BomPage —— 三阶段 state machine：
//   阶段 A 完成 → importBatchId 非空 → 阶段 B 解禁
//   阶段 B 完成 → buildBatchId 非空 → 阶段 C 解禁
//   任一阶段完成 → 刷新批次历史
import { computed, ref } from 'vue'
import BomImportPanel from '../components/BomImportPanel.vue'
import BomBuildHierarchyPanel from '../components/BomBuildHierarchyPanel.vue'
import BomFlattenPanel from '../components/BomFlattenPanel.vue'
import BomBatchHistoryTable from '../components/BomBatchHistoryTable.vue'

const importResult = ref(null)
const buildResult = ref(null)
const flattenResult = ref(null)

const importBatchId = computed(() => importResult.value?.importBatchId || '')
const buildBatchId = computed(() => buildResult.value?.buildBatchId || '')

// 拍平阶段默认 asOfDate 取今天（yyyy-MM-dd）
const defaultAsOfDate = new Date().toISOString().slice(0, 10)

// 批次历史自动刷新 token（任一阶段完成都 +1）
const historyRefresh = ref(0)

function bumpHistory() {
  historyRefresh.value = Date.now()
}

function onImported(data) {
  importResult.value = data
  // 阶段 A 成功后，下游 B / C 的历史结果失效
  buildResult.value = null
  flattenResult.value = null
  bumpHistory()
}

function onBuilt(data) {
  buildResult.value = data
  flattenResult.value = null
  bumpHistory()
}

function onFlattened(data) {
  flattenResult.value = data
  bumpHistory()
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
</style>
