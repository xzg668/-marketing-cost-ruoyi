<template>
  <section class="imported-files" aria-label="本月已导入文件">
    <div class="files-header">
      <span>本月已导入文件<span v-if="!canViewAll" class="scope-hint">（仅本人）</span></span>
      <el-button link :loading="loading" :disabled="voiding" @click="loadFiles">刷新</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-else v-loading="loading" :data="rows" max-height="240" empty-text="本月暂无已导入文件">
      <el-table-column prop="fileName" label="文件名" min-width="230" show-overflow-tooltip />
      <el-table-column label="组织" width="100"><template #default="{ row }">{{ organizationLabel(row.priceOrgCode) }}</template></el-table-column>
      <el-table-column prop="rowCount" label="条数" width="80" align="right" />
      <el-table-column prop="uploadedBy" label="导入人" width="100" />
      <el-table-column label="导入时间" width="170"><template #default="{ row }">{{ row.publishedAt?.replace('T', ' ').slice(0, 19) || '—' }}</template></el-table-column>
      <el-table-column label="操作" width="126">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'VOIDED'" type="info" size="small">已作废</el-tag>
          <el-button v-else-if="row.canVoid" link type="danger" :disabled="disabled || voiding" @click="confirmVoid(row)">作废本次导入</el-button>
        </template>
      </el-table-column>
    </el-table>
    <BasePagination v-if="total > 0 && !error" v-model:current-page="page" v-model:page-size="pageSize" :total="total" />
  </section>
</template>

<script setup>
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchLinkedImportedFiles, previewVoidLinkedImportedFile, voidLinkedImportedFile } from '../api/priceLinkedItems'
import BasePagination from './BasePagination.vue'

const props = defineProps({ pricingMonth: String, businessUnitType: String, disabled: Boolean })
const emit = defineEmits(['voided', 'voiding-change'])
const userStore = useUserStore()
const canViewAll = computed(() => userStore.roles?.some(role => role.toLowerCase() === 'admin')
  || ['*:*:*', 'price:linked-item:import-history:all', 'price:linked-item:admin',
    'price:finance-base:import-history:all', 'price:finance-base:admin'].some(permission => userStore.permissions?.includes(permission)))
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const voiding = ref(false)
const error = ref('')
let generation = 0
let mounted = true
const organizationLabel = code => ({ '210': '商用', '220': '板换' })[code] || code || '—'

const confirmVoid = async (row) => {
  if (props.disabled || voiding.value || !row.canVoid) return
  const scope = { pricingMonth: props.pricingMonth, businessUnitType: props.businessUnitType }
  const isCurrent = () => mounted && scope.pricingMonth === props.pricingMonth && scope.businessUnitType === props.businessUnitType
  voiding.value = true
  emit('voiding-change', true)
  try {
    const count = await previewVoidLinkedImportedFile(row.id, scope)
    if (!isCurrent()) return
    await ElMessageBox.confirm(h('div', [
      h('p', `文件 ${row.fileName}`),
      h('p', `组织 ${organizationLabel(row.priceOrgCode)} · ${scope.pricingMonth}`),
      h('p', `导入时间 ${row.publishedAt?.replace('T', ' ').slice(0, 19) || '—'}`),
      h('p', `本次导入的 ${count} 条联动规则将停止参与取价。财务可用正确原稿重新导入。`),
    ]), '作废本次导入', {
      type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消', closeOnClickModal: false,
    })
    if (!isCurrent()) return
    await voidLinkedImportedFile(row.id, { ...scope, expectedRuleCount: count })
    if (!isCurrent()) return
    ElMessage.success('本次导入已作废')
    emit('voided')
    await loadFiles()
  } catch (failure) {
    if (isCurrent() && failure !== 'cancel' && failure !== 'close') ElMessage.error(failure?.message || '作废失败，请刷新后再试')
  } finally {
    voiding.value = false
    emit('voiding-change', false)
  }
}

const loadFiles = async () => {
  const current = ++generation
  rows.value = []
  total.value = 0
  error.value = ''
  if (!props.pricingMonth || !props.businessUnitType) {
    loading.value = false
    error.value = '请选择月份和业务单元'
    return
  }
  loading.value = true
  try {
    const data = await fetchLinkedImportedFiles({
      pricingMonth: props.pricingMonth, businessUnitType: props.businessUnitType,
      page: page.value, pageSize: pageSize.value,
    })
    if (current !== generation) return
    rows.value = data.list
    total.value = data.total
  } catch (failure) {
    if (current === generation) error.value = failure.message || '读取已导入文件失败，请重试'
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(() => [props.pricingMonth, props.businessUnitType, pageSize.value], () => { page.value = 1 })
watch(() => [props.pricingMonth, props.businessUnitType, page.value, pageSize.value], loadFiles, { immediate: true })
onBeforeUnmount(() => { mounted = false; generation++ })
</script>

<style scoped>
.imported-files { margin-top: 24px; border-top: 1px solid #ebeef5; padding-top: 12px; }
.files-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.scope-hint { color: #909399; font-size: 12px; }
</style>
