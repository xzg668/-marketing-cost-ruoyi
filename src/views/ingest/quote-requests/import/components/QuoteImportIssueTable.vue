<template>
  <el-table :data="rows" border stripe>
    <el-table-column type="index" label="#" width="60" />
    <el-table-column prop="rowNo" label="Excel 行号" width="110">
      <template #default="{ row }">{{ row.rowNo || '-' }}</template>
    </el-table-column>
    <el-table-column prop="fieldPath" label="字段位置" min-width="180">
      <template #default="{ row }">{{ row.fieldPath || '-' }}</template>
    </el-table-column>
    <el-table-column prop="code" label="编码" min-width="170">
      <template #default="{ row }">{{ row.code || '-' }}</template>
    </el-table-column>
    <el-table-column prop="message" label="说明" min-width="280" show-overflow-tooltip />
    <template #empty>
      <el-empty :description="emptyText" />
    </template>
  </el-table>
</template>

<script setup>
defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  emptyText: {
    type: String,
    default: '暂无数据',
  },
})
</script>
