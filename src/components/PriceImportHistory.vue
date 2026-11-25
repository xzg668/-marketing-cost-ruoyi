<template>
  <el-dialog v-model="visible" title="导入记录" width="min(1080px, 95vw)" :show-close="!busy">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" border row-key="id" max-height="480" aria-label="导入记录">
      <el-table-column prop="file_name" label="原件文件名" min-width="215" show-overflow-tooltip />
      <el-table-column prop="month" label="来源月份" width="105" />
      <el-table-column prop="row_count" :label="rowLabel" width="108" />
      <el-table-column label="导入时间 / 人员" min-width="180">
        <template #default="{ row }">{{ time(row.imported_at) }} {{ row.imported_by }}</template>
      </el-table-column>
      <el-table-column label="状态" min-width="175">
        <template #default="{ row }">
          <el-tag :type="row.status === 'VOIDED' ? 'info' : row.status === 'PARTIAL' ? 'warning' : 'success'">{{ row.status === 'VOIDED' ? '已失效' : row.status === 'PARTIAL' ? '部分失效' : '已导入' }}</el-tag>
          <div v-if="row.voided_at">{{ time(row.voided_at) }} {{ row.voided_by }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="155" fixed="right">
        <template #default="{ row }">
          <el-button v-if="download" :disabled="!!busy" link type="primary" @click="original(row)">下载原件</el-button>
          <el-button v-if="row.status === 'PUBLISHED' || row.status === 'PARTIAL'" :disabled="!!busy" :loading="busy === row.id"
            link type="danger" @click="withdraw(row)">失效</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="total > 20" v-model:current-page="page" :page-size="20" :total="total"
      :disabled="!!busy" layout="total, prev, pager, next" @current-change="load" />
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const visible = defineModel({ type: Boolean })
const props = defineProps({ scope: String, rowLabel: { type: String, default: '新增版本数' }, fetch: Function, download: Function, withdrawBatch: Function })
const emit = defineEmits(['withdrawn'])
const rows = ref([]), total = ref(0), page = ref(1), loading = ref(false), error = ref(''), busy = ref(null)
let sequence = 0
let alive = true
onBeforeUnmount(() => { alive = false })
watch(() => props.scope, () => { visible.value = false }, { flush: 'sync' })
watch(visible, open => {
  sequence++
  rows.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  if (open) {
    page.value = 1
    load()
  }
}, { flush: 'sync' })

const time = value => String(value ?? '').replace('T', ' ').slice(0, 19)
async function load() {
  const ticket = ++sequence
  const current = () => alive && visible.value && sequence === ticket
  loading.value = true
  error.value = ''
  try {
    const result = await props.fetch({ page: page.value, size: 20 })
    if (current()) {
      rows.value = result.rows
      total.value = result.total
    }
  } catch (failure) {
    if (current()) error.value = failure.message || '读取导入记录失败'
  } finally {
    if (current()) loading.value = false
  }
}
async function original(row) {
  const ticket = sequence
  const isCurrent = () => alive && visible.value && sequence === ticket && !!props.download
  try {
    await props.download(row, { isCurrent })
  } catch (failure) {
    if (isCurrent()) error.value = failure.message || '原件下载失败'
  }
}
async function withdraw(row) {
  if (busy.value) return
  const scope = props.scope, ticket = sequence
  const current = () => alive && props.scope === scope
  busy.value = row.id
  try {
    await ElMessageBox.confirm(
      `失效 ${row.month} 的“${row.file_name}”整批导入？该批次将停止参与取价。已保存的核算结果保留，之后可重新导入正确文件。`,
      '失效本次导入', { type: 'warning', confirmButtonText: '确认失效', cancelButtonText: '取消' })
    if (!current() || !visible.value || ticket !== sequence) return
    await props.withdrawBatch(row.id)
    if (current()) {
      ElMessage.success('本次导入已失效，可以重新导入正确文件')
      emit('withdrawn')
      if (visible.value) await load()
    }
  } catch (failure) {
    if (current() && visible.value && failure !== 'cancel' && failure !== 'close')
      error.value = failure.message || '失效失败，请刷新后重试'
  } finally {
    busy.value = null
  }
}
</script>
