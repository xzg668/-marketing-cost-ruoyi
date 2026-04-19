<template>
  <div class="cost-run">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" label-width="90px" class="filter-form">
        <el-form-item label="客户">
          <el-input
            v-if="isCompleted"
            v-model="form.customer"
            placeholder="客户名称"
            clearable
          />
          <el-select
            v-else
            v-model="form.customer"
            placeholder="全部"
            clearable
            filterable
            :loading="loadingForms"
          >
            <el-option
              v-for="item in customerOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isCompleted" label="月份">
          <el-select
            v-model="form.month"
            placeholder="全部"
            clearable
            :loading="loadingForms"
          >
            <el-option
              v-for="item in monthSelectOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="OA 单号">
          <el-input
            v-if="isCompleted"
            v-model="form.oaNo"
            placeholder="请输入 OA 单号"
            clearable
          />
          <el-select
            v-else
            v-model="form.oaNo"
            placeholder="请选择 OA 单号"
            clearable
            filterable
            :loading="loadingForms"
          >
            <el-option
              v-for="item in oaNoOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!isCompleted" label="状态">
          <el-select v-model="form.status" placeholder="全部" clearable>
            <el-option
              v-for="item in statusOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column label="序号" width="70">
          <template #default="{ row, $index }">
            {{ $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="oaNo" label="OA单号" min-width="180" />
        <el-table-column prop="customer" label="客户名称" min-width="200" />
        <el-table-column prop="formType" label="表单类型" min-width="160" />
        <el-table-column prop="applyDate" label="日期" min-width="120" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
          <el-tag :type="getFormStatus(row) === '已核算' ? 'success' : 'info'">
            {{ getFormStatus(row) }}
          </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goTrial(row)">
              {{ getFormStatus(row) === '未核算' ? '试算' : '查看' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchOaForms } from '../api/oaForms'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadingForms = ref(false)
const oaForms = ref([])
const tableRows = ref([])

const form = ref({
  customer: '',
  month: '',
  oaNo: '',
  status: '未核算',
})

const statusOptions = ['未核算', '已核算']
const isCompleted = computed(() => route.path === '/cost/run/completed')

const getQueryValue = (value) => {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

const formatMonth = (value) => {
  if (!value) {
    return ''
  }
  const text = String(value)
  return text.length >= 7 ? text.slice(0, 7) : text
}

const getMonthRange = (monthValue) => {
  if (!monthValue) {
    return null
  }
  const [yearText, monthText] = String(monthValue).split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!year || !month) {
    return null
  }
  const lastDay = new Date(year, month, 0).getDate()
  const monthPadded = String(month).padStart(2, '0')
  return {
    startDate: `${year}-${monthPadded}-01`,
    endDate: `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  }
}

const getFormStatus = (item) => {
  if (!item) {
    return '未核算'
  }
  return item.calcStatus || item.status || item.auditStatus || '未核算'
}

const customerOptions = computed(() => {
  const values = oaForms.value.map((item) => item.customer).filter(Boolean)
  return Array.from(new Set(values))
})

const monthOptions = computed(() => {
  const values = oaForms.value
    .map((item) => formatMonth(item.applyDate))
    .filter(Boolean)
  return Array.from(new Set(values))
})

const monthSelectOptions = computed(() => {
  if (!isCompleted.value) {
    return monthOptions.value
  }
  const startYear = 2026
  const startMonth = 1
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1
  const options = []
  let year = startYear
  let month = startMonth
  while (year < endYear || (year === endYear && month <= endMonth)) {
    options.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return options
})

const oaNoOptions = computed(() => {
  const customer = form.value.customer
  const month = form.value.month
  const filtered = oaForms.value.filter((item) => {
    if (customer && item.customer !== customer) {
      return false
    }
    if (month && formatMonth(item.applyDate) !== month) {
      return false
    }
    return true
  })
  return filtered.map((item) => ({
    label: item.oaNo,
    value: item.oaNo,
  }))
})

const loadOaForms = async () => {
  loadingForms.value = true
  try {
    const data = await fetchOaForms()
    oaForms.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error(error?.message || '获取 OA 表单列表失败')
  } finally {
    loadingForms.value = false
  }
}

const buildParams = () => {
  const params = {}
  if (form.value.oaNo) {
    params.oaNo = form.value.oaNo
  }
  if (form.value.customer) {
    params.customer = form.value.customer
  }
  if (form.value.status) {
    params.status = form.value.status
  }
  if (!isCompleted.value && form.value.month) {
    const range = getMonthRange(form.value.month)
    if (range) {
      params.startDate = range.startDate
      params.endDate = range.endDate
    }
  }
  return params
}

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchOaForms(buildParams())
    let rows = Array.isArray(data) ? data : []
    if (form.value.status) {
      rows = rows.filter((row) => getFormStatus(row) === form.value.status)
    }
    tableRows.value = rows
  } catch (error) {
    tableRows.value = []
    ElMessage.error(error?.message || '获取 OA 表单列表失败')
  } finally {
    loading.value = false
  }
}

const goTrial = (row) => {
  const oaNo = row?.oaNo
  if (!oaNo) {
    return
  }
  router.push({
    path: `/cost/run/${oaNo}`,
    query: {
      status: getFormStatus(row),
      customer: row?.customer || '',
      formType: row?.formType || '',
    },
  })
}

const applyQuery = () => {
  const oaNo = getQueryValue(route.query.oaNo)
  const customer = getQueryValue(route.query.customer)
  const month = getQueryValue(route.query.month)
  const status = getQueryValue(route.query.status)

  if (oaNo) {
    form.value.oaNo = String(oaNo)
  }
  if (customer) {
    form.value.customer = String(customer)
  }
  if (!isCompleted.value && month) {
    form.value.month = String(month)
  }
  if (status) {
    form.value.status = String(status)
  } else if (route.path === '/cost/run/completed') {
    form.value.status = '已核算'
    form.value.month = ''
  } else {
    form.value.status = '未核算'
  }

  fetchList()
}

watch(() => route.fullPath, applyQuery)

watch(
  () => form.value.oaNo,
  (oaNo) => {
    if (isCompleted.value || !oaNo) {
      return
    }
    const match = oaForms.value.find((item) => item.oaNo === oaNo)
    if (match) {
      if (match.customer) {
        form.value.customer = match.customer
      }
      const month = formatMonth(match.applyDate)
      if (month) {
        form.value.month = month
      }
    }
  }
)

watch(
  () => [form.value.customer, form.value.month],
  () => {
    if (isCompleted.value || !form.value.oaNo) {
      return
    }
    const match = oaForms.value.find((item) => item.oaNo === form.value.oaNo)
    if (!match) {
      form.value.oaNo = ''
      return
    }
    if (form.value.customer && match.customer !== form.value.customer) {
      form.value.oaNo = ''
      return
    }
    const month = formatMonth(match.applyDate)
    if (form.value.month && month !== form.value.month) {
      form.value.oaNo = ''
    }
  }
)

onMounted(() => {
  loadOaForms().then(() => {
    applyQuery()
  })
})
</script>


<style scoped>
.cost-run {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  padding-bottom: 6px;
}

.filter-form {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.filter-form :deep(.el-form-item__label),
.filter-form :deep(.el-form-item__content) {
  white-space: nowrap;
}
</style>
