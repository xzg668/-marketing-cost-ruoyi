<template>
  <div class="base-pagination">
    <div class="base-pagination__meta">共 {{ total }} 条</div>
    <el-pagination
      :current-page="currentPage"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :total="total"
      layout="sizes, prev, pager, next, jumper"
      @update:current-page="emitCurrentPage"
      @update:page-size="emitPageSize"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  total: {
    type: Number,
    default: 0,
  },
  currentPage: {
    type: Number,
    default: 1,
  },
  pageSize: {
    type: Number,
    default: 20,
  },
  pageSizes: {
    type: Array,
    default: () => [20, 50, 100],
  },
})

const emit = defineEmits(['update:currentPage', 'update:pageSize'])

const emitCurrentPage = (value) => {
  emit('update:currentPage', value)
}

const emitPageSize = (value) => {
  emit('update:pageSize', value)
}
</script>

<style scoped>
.base-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e5e7eb;
}

.base-pagination__meta {
  font-size: 12px;
  color: #6b7280;
}
</style>
