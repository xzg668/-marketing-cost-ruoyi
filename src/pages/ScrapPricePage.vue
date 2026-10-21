<template>
  <div class="scrap-page">
    <el-card shadow="never">
      <div class="page-heading">
        <h2>废料价格</h2>
        <el-button v-hasPermi="['price:scrap:import']" type="primary" @click="importVisible = true">导入 Excel</el-button>
      </div>
      <el-form :inline="true" @submit.prevent="search">
        <el-form-item label="价格月份">
          <el-date-picker v-model="filters.priceMonth" type="month" value-format="YYYY-MM" format="YYYY-MM" :clearable="false" style="width: 135px" @change="search" />
        </el-form-item>
        <el-form-item label="料号 / 名称">
          <el-input v-model="filters.keyword" clearable placeholder="输入料号或名称" style="width: 190px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filters.priceType" clearable placeholder="全部" style="width: 110px" @change="search">
            <el-option label="固定价" value="FIXED" /><el-option label="联动价" value="LINKED" />
          </el-select>
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="filters.supplier" clearable placeholder="代码或名称" style="width: 150px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item><el-button @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="rows" row-key="id" stripe>
        <el-table-column prop="materialCode" label="料号" width="125" />
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">{{ row.materialName }}<div v-if="row.specification" class="secondary">{{ row.specification }}</div></template>
        </el-table-column>
        <el-table-column label="供应商" min-width="130">
          <template #default="{ row }"><div>{{ row.supplierName || '—' }}</div><div v-if="row.supplierCode" class="secondary">{{ row.supplierCode }}</div></template>
        </el-table-column>
        <el-table-column label="类型" width="80"><template #default="{ row }">{{ typeLabel(row.priceType) }}</template></el-table-column>
        <el-table-column label="固定金额 / 公式" min-width="170">
          <template #default="{ row }"><span class="numeric">{{ row.priceType === 'FIXED' ? displayPrice(row.fixedPrice) : row.expression }}</span></template>
        </el-table-column>
        <el-table-column label="不含税单价（元）" min-width="175" align="right">
          <template #default="{ row }"><span v-if="row.calcStatus === 'READY'" class="numeric">{{ displayPrice(row.unitPrice) }}</span><el-tag v-else :type="row.calcStatus === 'WAITING_BASE' ? 'warning' : 'danger'" size="small">{{ calcStatusLabel(row.calcStatus) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="单位" width="60"><template #default>公斤</template></el-table-column>
        <el-table-column label="操作" width="112" fixed="right">
          <template #default="{ row }">
            <el-button v-hasPermi="['price:scrap:edit']" link type="primary" :disabled="opening" @click="openRow(row, 'edit')">编辑</el-button>
            <el-button link type="primary" :disabled="opening" @click="openRow(row, 'detail')">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="error ? '价格加载失败' : '该月份暂无废料价格'" :image-size="70" /></template>
      </el-table>
      <BasePagination :current-page="page" :page-size="size" :total="total" @update:current-page="changePage" @update:page-size="changeSize" />
    </el-card>
    <ScrapPriceImportDialog v-model="importVisible" :price-month="filters.priceMonth" @imported="imported" />
    <ScrapPriceEditDialog v-if="selected" v-model="editVisible" :record="selected" @saved="load" />
    <ScrapPriceDetailDrawer v-if="selected" v-model="detailVisible" :record="selected" />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { fetchScrapPrices, fetchScrapPrice } from '../api/scrapPrices'
import BasePagination from '../components/BasePagination.vue'
import ScrapPriceImportDialog from '../components/scrap/ScrapPriceImportDialog.vue'
import ScrapPriceEditDialog from '../components/scrap/ScrapPriceEditDialog.vue'
import ScrapPriceDetailDrawer from '../components/scrap/ScrapPriceDetailDrawer.vue'
import { calcStatusLabel, currentPriceMonth, displayPrice, typeLabel } from './scrapPriceUtils.js'

const filters = reactive({ priceMonth: currentPriceMonth(), keyword: '', priceType: '', supplier: '' })
const rows = ref([]), total = ref(0), page = ref(1), size = ref(20), loading = ref(false), error = ref('')
const importVisible = ref(false), editVisible = ref(false), detailVisible = ref(false), selected = ref(null), opening = ref(false)
let sequence = 0
async function load() {
  const current = ++sequence
  rows.value = []; total.value = 0; error.value = ''; loading.value = true
  try {
    const result = await fetchScrapPrices({ ...filters, page: page.value, size: size.value })
    if (current !== sequence) return
    rows.value = result.records; total.value = result.total
  } catch (failure) {
    if (current === sequence) error.value = failure.message
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() { page.value = 1; load() }
function reset() { Object.assign(filters, { keyword: '', priceType: '', supplier: '' }); search() }
function changePage(value) { page.value = value; load() }
function changeSize(value) { size.value = value; search() }
function imported(month) { filters.priceMonth = month; reset() }
async function openRow(row, mode) {
  if (opening.value) return
  opening.value = true
  try {
    selected.value = await fetchScrapPrice(row.id)
    if (mode === 'edit') editVisible.value = true
    else detailVisible.value = true
  } catch (failure) { error.value = failure.message }
  finally { opening.value = false }
}
onMounted(load)
onBeforeUnmount(() => { sequence += 1 })
</script>

<style scoped>
.scrap-page { padding: 16px; }
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.secondary { font-size: 12px; color: #7a8492; }
.numeric { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.scrap-page :deep(.base-pagination) { background: #fff; border: 0; border-radius: 0; padding: 10px 0 0; }
</style>
