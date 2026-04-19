<template>
  <div class="oa-list">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" label-width="90px">
        <el-form-item label="OA单号">
          <el-input v-model="filters.oaNo" placeholder="FI-SR-005-xxxx" />
        </el-form-item>
        <el-form-item label="表单类型">
          <el-select v-model="filters.formType" placeholder="全部">
            <el-option label="家用-FI-SR-005" value="FI-SR-005" />
            <el-option label="商用-FI-SC-006" value="FI-SC-006" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customer" placeholder="客户名称" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="filters.date"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="oaNo" label="OA单号" width="200" />
        <el-table-column prop="formType" label="表单类型" width="150" />
        <el-table-column prop="applyDate" label="日期" width="120" />
        <el-table-column prop="customer" label="客户名称" min-width="200" />
        <el-table-column prop="copperPrice" label="铜基价" width="120" />
        <el-table-column prop="zincPrice" label="锌基价" width="120" />
        <el-table-column prop="aluminumPrice" label="铝基价" width="120" />
        <el-table-column prop="steelPrice" label="不锈钢基价" width="130" />
        <el-table-column prop="otherMaterial" label="其他材料价" width="130" />
        <el-table-column prop="baseShipping" label="基准运输费" width="130" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goDetail(row.oaNo)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchOaForms } from '../api/oaForms'

const router = useRouter()

const loading = ref(false)
const filters = ref({
  oaNo: '',
  formType: '',
  customer: '',
  date: [],
})
const tableRows = ref([])

const buildParams = () => {
  const params = {}
  if (filters.value.oaNo?.trim()) {
    params.oaNo = filters.value.oaNo.trim()
  }
  if (filters.value.formType) {
    params.formType = filters.value.formType
  }
  if (filters.value.customer?.trim()) {
    params.customer = filters.value.customer.trim()
  }
  if (Array.isArray(filters.value.date) && filters.value.date.length === 2) {
    params.startDate = filters.value.date[0]
    params.endDate = filters.value.date[1]
  }
  return params
}

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchOaForms(buildParams())
    tableRows.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取 OA 表单列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    oaNo: '',
    formType: '',
    customer: '',
    date: [],
  }
  fetchList()
}

const goDetail = (id) => {
  router.push(`/ingest/oa-form/${id}`)
}

onMounted(fetchList)
</script>

<style scoped>
.oa-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}
</style>
