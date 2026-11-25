<template>
  <el-dialog :model-value="true" title="供货比率导入记录" width="min(1000px, 96vw)" append-to-body
    :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving"
    @update:model-value="emit('close')">
    <el-alert title="导入错误时，作废这次导入，再重新上传正确文件。作废的数据不再参与取价。"
      type="info" :closable="false" show-icon />
    <el-table :data="rows" v-loading="loading" border max-height="460" style="margin-top: 16px">
      <el-table-column prop="fileName" label="导入文件" min-width="240" show-overflow-tooltip />
      <el-table-column prop="importedAt" label="导入时间" width="180" />
      <el-table-column prop="importedBy" label="导入人" width="130" show-overflow-tooltip />
      <el-table-column prop="activeRows" label="生效条数" width="100" align="right" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.activeRows > 0 ? 'success' : 'info'">
            {{ row.voided ? '已作废' : row.activeRows > 0 ? '生效中' : '已被替换' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="156" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.activeRows > 0" v-hasPermi="['base:supplier-supply-ratio:import']"
            type="danger" link :disabled="saving" @click="discard(row)">作废本次导入</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无导入记录" /></template>
    </el-table>
    <BasePagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" />
    <template #footer><el-button :disabled="saving" @click="emit('close')">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import BasePagination from './BasePagination.vue'
import { fetchSupplierRatioImportBatches, normalizeSupplierSupplyRatioPage, voidSupplierRatioBatch } from '../api/supplierSupplyRatios'

const emit = defineEmits(['close', 'voided'])
const rows = ref([]), total = ref(0), page = ref(1), pageSize = ref(20)
const loading = ref(false), saving = ref(false)

async function fetchRows() {
  loading.value = true
  try {
    const result = normalizeSupplierSupplyRatioPage(await fetchSupplierRatioImportBatches({ page: page.value, pageSize: pageSize.value }))
    rows.value = result.list
    total.value = result.total
  } catch (error) {
    ElMessage.error(error.message || '导入记录查询失败')
  } finally {
    loading.value = false
  }
}

async function discard(row) {
  if (saving.value) return
  saving.value = true
  try {
    await ElMessageBox.confirm(
      `作废「${row.fileName || '这次导入'}」仍生效的 ${row.activeRows} 条供货比率？作废后不再参与取价，请重新上传正确文件。`,
      '作废本次导入', { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' },
    )
    const result = await voidSupplierRatioBatch(row.batchNo, { expectedActiveRows: row.activeRows })
    ElMessage.success(`已作废 ${result.voidedRows} 条供货比率，不再参与取价`)
    emit('voided')
    await fetchRows()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '作废失败，请刷新导入记录后重试')
      await fetchRows()
    }
  } finally {
    saving.value = false
  }
}

watch([page, pageSize], fetchRows)
onMounted(fetchRows)
</script>
