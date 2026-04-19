<template>
  <div class="oa-result">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">联动价计算</div>
        <div class="filter-actions">
          <el-button :loading="refreshing" @click="refreshCalc">刷新</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="OA单号">
          <el-input v-model="filters.oaNo" placeholder="OA单号" />
        </el-form-item>
        <el-form-item label="末端料号">
          <el-input v-model="filters.itemCode" placeholder="末端料号" />
        </el-form-item>
        <el-form-item label="形态属性">
          <el-select v-model="filters.shapeAttr" placeholder="全部">
            <el-option label="全部" value="" />
            <el-option label="制造件" value="制造件" />
            <el-option label="采购件" value="采购件" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="oaNo" label="OA单号" min-width="180" />
        <el-table-column prop="itemCode" label="末端料号" min-width="160" />
        <el-table-column prop="shapeAttr" label="形态属性" width="120" />
        <el-table-column prop="bomQty" label="部品用量" width="120" />
        <el-table-column prop="partUnitPrice" label="部品单价" width="120" />
        <el-table-column prop="partAmount" label="部品价格" width="120" />
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import { fetchPriceLinkedCalc, refreshPriceLinkedCalc } from '../api/priceLinkedCalc'

const loading = ref(false)
const tableRows = ref([])
const total = ref(0)
const refreshing = ref(false)

const filters = ref({
  oaNo: '',
  itemCode: '',
  shapeAttr: '',
})

const buildParams = () => ({
  oaNo: filters.value.oaNo?.trim(),
  itemCode: filters.value.itemCode?.trim(),
  shapeAttr: filters.value.shapeAttr,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchPriceLinkedCalc(buildParams())
    tableRows.value = data?.list || []
    total.value = data?.total || 0
  } catch (error) {
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取联动价计算失败')
  } finally {
    loading.value = false
  }
}

const refreshCalc = async () => {
  if (!filters.value.oaNo?.trim()) {
    ElMessage.warning('请输入OA单号')
    return
  }
  refreshing.value = true
  try {
    await refreshPriceLinkedCalc({ oaNo: filters.value.oaNo.trim() })
    ElMessage.success('已刷新')
    if (currentPage.value === 1) {
      fetchList()
    } else {
      currentPage.value = 1
    }
  } catch (error) {
    ElMessage.error(error?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    oaNo: '',
    itemCode: '',
    shapeAttr: '',
  }
  applyFilters()
}

const currentPage = ref(1)
const pageSize = ref(20)

watch(currentPage, () => {
  fetchList()
})

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

onMounted(fetchList)
</script>

<style scoped>
.oa-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

</style>
