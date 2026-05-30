<template>
  <div class="bom-preparation-placeholder">
    <el-card shadow="never" class="panel">
      <div class="panel-header">
        <div>
          <div class="page-title">{{ title }}</div>
          <div class="page-subtitle">报价产品 BOM 准备</div>
        </div>
        <el-tag type="info" effect="plain">待接入</el-tag>
      </div>
      <el-empty :description="`${title}暂无数据`" />
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta?.title || 'BOM 数据')
</script>

<style scoped>
.bom-preparation-placeholder {
  padding: 20px;
}

.panel {
  border-radius: 8px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-title {
  color: #1f2937;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.page-subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}
</style>
