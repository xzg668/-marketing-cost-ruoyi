<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">BOM数据</div>
      </div>
      <div class="filter-content">
        <el-form label-position="top" class="filter-form">
          <div class="filter-grid">
            <el-form-item label="OA单号">
              <el-input
                v-model="filters.oaNo"
                placeholder="FI-SR-005-xxxx"
                clearable
              />
            </el-form-item>
            <el-form-item label="BOM编码">
              <el-input
                v-model="filters.bomCode"
                placeholder="BOM0001"
                clearable
              />
            </el-form-item>
            <el-form-item label="产品物料编码">
              <el-input
                v-model="filters.materialNo"
                placeholder="产品物料编码"
                clearable
              />
            </el-form-item>
          </div>
        </el-form>
        <div class="filter-actions">
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button type="success" :loading="refreshing" @click="refreshCache">计算</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="result-header">
        <div class="result-title">父级BOM清单</div>
        <el-tag size="small" type="success">共 {{ total }} 条</el-tag>
      </div>
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="oaNo" label="OA单号" width="160" />
        <el-table-column prop="customerName" label="客户名称" min-width="140" />
        <el-table-column prop="productName" label="产品名称" min-width="140" />
        <el-table-column prop="materialNo" label="产品物料编码" width="160" />
        <el-table-column prop="bomCode" label="BOM编码" width="120" />
        <el-table-column prop="rootItemCode" label="父级料号" width="160" />
        <el-table-column prop="detailCount" label="明细数" width="100" />
        <el-table-column prop="copperPriceTax" label="铜基价(含税)" width="140" />
        <el-table-column prop="zincPriceTax" label="锌基价(含税)" width="140" />
        <el-table-column prop="aluminumPriceTax" label="铝基价(含税)" width="140" />
        <el-table-column prop="steelPriceTax" label="不锈钢基价(含税)" width="160" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDetails(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <el-drawer
      v-model="detailDrawerVisible"
      :title="detailTitle"
      size="70%"
      destroy-on-close
    >
      <div class="detail-meta" v-if="activeParent">
        <el-tag>OA单号：{{ activeParent.oaNo }}</el-tag>
        <el-tag type="info">BOM：{{ activeParent.bomCode }}</el-tag>
        <el-tag type="success">父级：{{ activeParent.rootItemCode }}</el-tag>
      </div>
      <el-table :data="detailRows" stripe v-loading="detailLoading">
        <el-table-column prop="itemCode" label="末端料号" width="160" />
        <el-table-column prop="itemName" label="末端名称" min-width="160" />
        <el-table-column prop="itemSpec" label="末端规格" min-width="160" />
        <el-table-column prop="itemModel" label="末端型号" min-width="160" />
        <el-table-column prop="shapeAttr" label="形态属性" width="100" />
        <el-table-column prop="bomQty" label="BOM用量" width="120" />
        <el-table-column prop="material" label="材质" width="120" />
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <template #empty>
          <el-empty description="暂无明细数据" />
        </template>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchBomManageItemDetails,
  fetchBomManageItems,
  refreshBomManageItems,
} from '../api/bomManage'

const filters = ref({
  oaNo: '',
  bomCode: '',
  materialNo: '',
})

const tableRows = ref([])
const total = ref(0)
const loading = ref(false)
const refreshing = ref(false)

const currentPage = ref(1)
const pageSize = ref(20)

const detailDrawerVisible = ref(false)
const detailLoading = ref(false)
const detailRows = ref([])
const activeParent = ref(null)

const detailTitle = computed(() => {
  if (!activeParent.value) {
    return 'BOM明细'
  }
  return `BOM明细 - ${activeParent.value.materialNo || ''}`
})

const buildParams = () => ({
  oaNo: filters.value.oaNo.trim(),
  bomCode: filters.value.bomCode.trim(),
  materialNo: filters.value.materialNo.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchBomManageItems(buildParams())
    tableRows.value = data?.list || []
    total.value = data?.total || 0
  } catch (error) {
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const openDetails = async (row) => {
  if (!row?.oaNo || !row?.oaFormItemId || !row?.bomCode || !row?.rootItemCode) {
    ElMessage.warning('当前行缺少明细查询参数')
    return
  }
  activeParent.value = row
  detailRows.value = []
  detailDrawerVisible.value = true
  detailLoading.value = true
  try {
    const data = await fetchBomManageItemDetails({
      oaNo: row.oaNo,
      oaFormItemId: row.oaFormItemId,
      bomCode: row.bomCode,
      rootItemCode: row.rootItemCode,
    })
    detailRows.value = Array.isArray(data) ? data : []
  } catch (error) {
    detailRows.value = []
    ElMessage.error(error?.message || '加载明细失败')
  } finally {
    detailLoading.value = false
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
    bomCode: '',
    materialNo: '',
  }
  applyFilters()
}

const refreshCache = async () => {
  if (!filters.value.oaNo.trim()) {
    ElMessage.warning('请输入OA单号')
    return
  }
  refreshing.value = true
  try {
    const count = await refreshBomManageItems({
      oaNo: filters.value.oaNo.trim() || undefined,
      bomCode: filters.value.bomCode.trim() || undefined,
    })
    ElMessage.success(`已刷新${count || 0}条记录`)
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

watch(detailDrawerVisible, (value) => {
  if (!value) {
    detailRows.value = []
    activeParent.value = null
  }
})

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.base-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
  border-radius: 8px;
}

.filter-header {
  margin-bottom: 12px;
}

.filter-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a37;
}

.filter-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-form {
  flex: 1;
  min-width: 640px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 0 16px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.filter-form :deep(.el-input) {
  width: 100%;
}

.filter-form :deep(.el-form-item__label) {
  line-height: 1;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 8px;
}

.filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
  align-self: flex-end;
  padding-bottom: 12px;
}

@media (max-width: 1200px) {
  .filter-form {
    min-width: 100%;
  }

  .filter-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .filter-actions {
    width: 100%;
    justify-content: flex-start;
    padding-bottom: 0;
  }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a37;
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
</style>
