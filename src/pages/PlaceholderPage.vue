<template>
  <el-card shadow="never" class="page-card">
    <div class="page-meta">
      <el-tag size="small" type="info">假数据</el-tag>
      <span class="page-meta-text">当前页面：{{ title }}</span>
    </div>
    <el-table :data="tableRows" stripe>
      <el-table-column prop="id" label="编号" width="140" />
      <el-table-column prop="name" label="名称" min-width="200" />
      <el-table-column prop="source" label="数据来源" width="120" />
      <el-table-column prop="month" label="月份" width="120" />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === '已导入' ? 'success' : 'info'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="180" />
    </el-table>
  </el-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta?.title || '未命名页面')

const tableRows = ref([
  {
    id: 'U9-2026-02',
    name: 'U9 BOM 明细',
    source: 'U9',
    month: '2026-02',
    status: '已导入',
    updatedAt: '2026-02-02 11:13',
  },
  {
    id: 'OA-2026-02',
    name: 'OA 结算价',
    source: 'OA',
    month: '2026-02',
    status: '已导入',
    updatedAt: '2026-02-01 09:20',
  },
  {
    id: 'EXCEL-2026-02',
    name: '联动价/区间价',
    source: 'Excel',
    month: '2026-02',
    status: '待导入',
    updatedAt: '2026-01-30 16:45',
  },
])
</script>

<style scoped>
.page-card {
  border-radius: 8px;
}

.page-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #4b5563;
  font-size: 13px;
}
</style>
