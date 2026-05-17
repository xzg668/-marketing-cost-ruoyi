<template>
  <div class="summary-grid">
    <div class="summary-item">
      <span class="label">文件名</span>
      <strong>{{ summary.fileName || '-' }}</strong>
    </div>
    <div class="summary-item">
      <span class="label">预览状态</span>
      <el-tag :type="summary.statusType" effect="plain">{{ summary.statusLabel }}</el-tag>
    </div>
    <div class="summary-item">
      <span class="label">报价单数量</span>
      <strong>{{ summary.formCount }}</strong>
    </div>
    <div class="summary-item">
      <span class="label">产品行数量</span>
      <strong>{{ summary.itemCount }}</strong>
    </div>
    <div class="summary-item">
      <span class="label">费用行数量</span>
      <strong>{{ summary.feeCount }}</strong>
    </div>
    <div class="summary-item danger">
      <span class="label">错误</span>
      <strong>{{ summary.errorCount }}</strong>
    </div>
    <div class="summary-item warning">
      <span class="label">提醒</span>
      <strong>{{ summary.warningCount }}</strong>
    </div>
  </div>
</template>

<script setup>
defineProps({
  summary: {
    type: Object,
    required: true,
  },
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(120px, 1fr));
  gap: 12px;
}

.summary-item {
  min-height: 72px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.summary-item .label {
  display: block;
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 12px;
}

.summary-item strong {
  display: block;
  overflow: hidden;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-item.danger strong {
  color: #dc2626;
}

.summary-item.warning strong {
  color: #b45309;
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
