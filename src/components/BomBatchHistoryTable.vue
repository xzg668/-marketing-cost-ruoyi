<template>
  <!-- BOM 导入批次历史只读表 —— 用于 U9BomPage 右侧侧栏或底部展示
       只接 GET /api/v1/bom/batches，不做写操作 -->
  <el-card shadow="never" class="history-card">
    <template #header>
      <div class="history-header">
        <div class="history-title">导入批次历史</div>
        <div class="history-actions">
          <el-select
            v-model="layer"
            size="small"
            style="width: 160px"
            @change="fetchBatches"
          >
            <el-option label="U9_SOURCE（导入）" value="U9_SOURCE" />
            <el-option label="RAW_HIERARCHY（构建）" value="RAW_HIERARCHY" />
            <el-option label="COSTING_ROW（拍平）" value="COSTING_ROW" />
          </el-select>
          <el-button size="small" :loading="loading" @click="fetchBatches">
            刷新
          </el-button>
        </div>
      </div>
    </template>

    <el-table
      :data="rows"
      v-loading="loading"
      size="small"
      empty-text="暂无批次"
      stripe
    >
      <el-table-column prop="batchId" label="批次 ID" min-width="200" show-overflow-tooltip />
      <el-table-column prop="sourceFileName" label="文件名" min-width="200" show-overflow-tooltip />
      <el-table-column prop="rowCount" label="行数" width="100" align="right" />
      <el-table-column prop="importedBy" label="操作人" width="120" />
      <el-table-column prop="importedAt" label="时间" min-width="160" />
    </el-table>
  </el-card>
</template>

<script setup>
// BomBatchHistoryTable —— layer 可切换 U9_SOURCE / RAW_HIERARCHY / COSTING_ROW（分别对应三阶段）
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listBomBatches } from '../api/bom'

const props = defineProps({
  // 父页面可传入 refreshToken（数字/时间戳），值变化即触发重查
  refreshToken: { type: [Number, String], default: 0 },
  // 默认初始 layer
  defaultLayer: { type: String, default: 'U9_SOURCE' },
})

const layer = ref(props.defaultLayer)
const rows = ref([])
const loading = ref(false)

async function fetchBatches() {
  loading.value = true
  try {
    const data = await listBomBatches(layer.value, 1, 20)
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '查询批次失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

// 父页面 refreshToken 变化时重查（阶段完成后触发）
watch(() => props.refreshToken, () => fetchBatches())

onMounted(fetchBatches)
</script>

<style scoped>
.history-card {
  margin-bottom: 16px;
}
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.history-title {
  font-size: 15px;
  font-weight: 600;
}
.history-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
