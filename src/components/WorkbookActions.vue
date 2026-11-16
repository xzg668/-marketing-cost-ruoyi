<template>
  <span class="workbook-actions">
    <el-button v-if="showTemplate && canImport" :disabled="busy" :loading="active === 'template'" @click="download(true)">{{ templateLabel }}</el-button>
    <el-button v-if="fetchPage && canExport" :disabled="busy" :loading="active === 'data'" @click="download(false)">导出数据</el-button>
    <span v-if="active === 'data' && progressText" class="progress" role="status">{{ progressText }}</span>
  </span>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { workbookDefinitions } from '../utils/workbookCatalog'
import { collectExportRows, createWorkbook, saveWorkbook } from '../utils/workbookTransfer'

const props = defineProps({
  kind: { type: String, required: true }, query: { type: Object, default: () => ({}) },
  fetchPage: Function, normalize: Function, transformRows: Function, definition: Object,
  pageKey: { type: String, default: 'page' }, sizeKey: { type: String, default: 'pageSize' },
  importPermission: String, exportPermission: String, showTemplate: { type: Boolean, default: true },
  templateLabel: { type: String, default: '下载填写模板' },
})
const user = useUserStore(), active = ref(''), progressText = ref('')
const busy = computed(() => Boolean(active.value))
const canImport = computed(() => !props.importPermission || user.permissions.includes('*:*:*') || user.permissions.includes(props.importPermission))
const canExport = computed(() => !props.exportPermission || user.permissions.includes('*:*:*') || user.permissions.includes(props.exportPermission))
const scope = computed(() => JSON.stringify([user.userId, user.businessUnitType, user.permissions, props.kind, props.query]))
let generation = 0
watch(scope, () => { generation++; active.value = ''; progressText.value = '' })
onBeforeUnmount(() => { generation++ })
async function download(template) {
  if (busy.value) return
  if (template ? !canImport.value : !canExport.value) return
  const ticket = ++generation, owner = scope.value, isCurrent = () => ticket === generation && scope.value === owner
  active.value = template ? 'template' : 'data'
  try {
    const definition = props.definition || workbookDefinitions[props.kind]
    if (!definition) throw new Error('未找到对应填写模板')
    const XLSX = await import('xlsx')
    let rows = template ? [] : await collectExportRows(props.fetchPage, props.query, {
      pageKey: props.pageKey, sizeKey: props.sizeKey, normalize: props.normalize, isCurrent,
      progress: (count, total) => { progressText.value = `${count} / ${total} 条` },
    })
    if (!template && props.transformRows) rows = await props.transformRows(rows)
    if (!isCurrent()) return
    const book = createWorkbook(XLSX, definition, rows, template)
    saveWorkbook(XLSX, book, `${definition.title}${template ? '填写模板' : '数据'}.xlsx`)
    ElMessage.success(template ? '填写模板已下载' : `已导出 ${rows.length} 条数据`)
  } catch (error) {
    if (isCurrent()) ElMessage.error(error?.message || '下载失败，请重试')
  } finally {
    if (isCurrent()) { active.value = ''; progressText.value = '' }
  }
}
</script>
<style scoped>
.workbook-actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.workbook-actions .el-button + .el-button { margin-left: 0; }
.progress { color: #606266; font-size: 12px; }
</style>
