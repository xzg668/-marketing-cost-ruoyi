<template>
  <div class="mapping-page">
    <el-card shadow="never">
      <div class="heading">
        <h2>型号—板片材质对照表</h2>
        <div>
          <el-button v-hasPermi="['base:plate-material:add']" :disabled="!options.length" @click="edit(null)">新增</el-button>
          <el-button v-hasPermi="['base:plate-material:import']" type="primary" @click="importVisible = true">导入 Excel</el-button>
        </div>
      </div>
      <el-form :inline="true" @submit.prevent="search">
        <el-form-item label="产品型号"><el-input v-model="filters.model" aria-label="筛选产品型号" placeholder="输入完整型号，精确查询" clearable style="width: 260px" @keyup.enter="search" /></el-form-item>
        <el-form-item label="板片材质">
          <el-select v-model="filters.plateMaterial" aria-label="筛选板片材质" placeholder="全部材质" clearable style="width: 180px" @change="search">
            <el-option v-for="option in options" :key="option" :label="option" :value="option" />
          </el-select>
        </el-form-item>
        <el-form-item><el-button @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="rows" row-key="id" stripe>
        <el-table-column prop="normalizedModel" label="产品型号" min-width="240" />
        <el-table-column prop="plateMaterial" label="板片材质" width="160" />
        <el-table-column label="来源" min-width="230">
          <template #default="{ row }">
            <span v-if="row.sourceType === 'EXCEL'">{{ row.sourceFileName }} · {{ row.sourceSheetName }} 第 {{ row.sourceRowNumber }} 行</span>
            <span v-else>手工维护</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="185" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }"><el-button v-hasPermi="['base:plate-material:edit']" link type="primary" :disabled="!options.length" @click="edit(row)">编辑</el-button></template>
        </el-table-column>
        <template #empty><el-empty :description="error ? '配置加载失败' : '暂无符合条件的型号配置'" :image-size="70" /></template>
      </el-table>
      <BasePagination :current-page="page" :page-size="size" :total="total" @update:current-page="changePage" @update:page-size="changeSize" />
    </el-card>
    <PlateMaterialMappingEditDialog v-model="editVisible" :record="selected" :options="options" @saved="load" />
    <PlateMaterialMappingImportDialog v-model="importVisible" @imported="reset" />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { fetchPlateMaterialMappings, fetchPlateMaterialOptions } from '../api/plateMaterialMappings'
import BasePagination from '../components/BasePagination.vue'
import PlateMaterialMappingEditDialog from '../components/plate-material/PlateMaterialMappingEditDialog.vue'
import PlateMaterialMappingImportDialog from '../components/plate-material/PlateMaterialMappingImportDialog.vue'

const filters = reactive({ model: '', plateMaterial: '' })
const rows = ref([]), options = ref([]), total = ref(0), page = ref(1), size = ref(20)
const loading = ref(false), error = ref(''), selected = ref(null), editVisible = ref(false), importVisible = ref(false)
let sequence = 0
async function load() {
  const current = ++sequence
  // Keep the total while fetching: resetting it would make pagination clamp back to page 1.
  loading.value = true; error.value = ''; rows.value = []
  try {
    const result = await fetchPlateMaterialMappings({ ...filters, page: page.value, size: size.value })
    if (current !== sequence) return
    rows.value = result.records; total.value = result.total
  } catch (failure) {
    if (current === sequence) { error.value = failure.message; total.value = 0 }
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() { page.value = 1; load() }
function reset() { Object.assign(filters, { model: '', plateMaterial: '' }); search() }
function changePage(value) { page.value = value; load() }
function changeSize(value) { size.value = value; search() }
function edit(row) { selected.value = row; editVisible.value = true }
onMounted(async () => {
  await load()
  try { options.value = await fetchPlateMaterialOptions() }
  catch (failure) { error.value = failure.message }
})
onBeforeUnmount(() => { sequence += 1 })
</script>

<style scoped>
.mapping-page { padding: 16px; }
.heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
</style>
