<template>
  <div class="material-usage-page">
    <section class="page-toolbar">
      <div>
        <h1>物料使用查询</h1>
        <p>基础数据 / U9 数据</p>
      </div>
      <el-button
        v-hasPermi="['base:u9-material-usage:list']"
        :icon="RefreshRight"
        :disabled="!hasSearched"
        @click="fetchRows"
      >
        刷新
      </el-button>
    </section>

    <el-alert
      class="scope-alert"
      type="info"
      :closable="false"
      show-icon
      title="这里查询的是当前有效 U9 BOM 的潜在影响范围，不代表历史报价当时实际使用的 BOM。"
    />

    <section class="query-panel">
      <el-form
        class="query-form"
        :model="filters"
        :inline="true"
        label-width="92px"
        @submit.prevent
      >
        <el-form-item label="组织">
          <el-select v-model="filters.organizationCode" style="width: 150px">
            <el-option
              v-for="item in organizationOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="物料料号" required>
          <el-input
            v-model="filters.partCode"
            clearable
            autofocus
            placeholder="请输入完整物料料号"
            style="width: 220px"
            @keyup.enter="applyFilters"
          />
        </el-form-item>
        <el-form-item label="顶层产品">
          <el-input
            v-model="filters.topProductCode"
            clearable
            placeholder="可选，按料号开头筛选"
            style="width: 220px"
            @keyup.enter="applyFilters"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            v-hasPermi="['base:u9-material-usage:list']"
            type="primary"
            :icon="Search"
            @click="applyFilters"
          >
            查询
          </el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section v-if="hasSearched" class="summary-grid">
      <div class="summary-card">
        <span>查询物料</span>
        <strong>{{ materialSummary.code || '-' }}</strong>
        <small>{{ materialSummary.name || '未查到物料名称' }}</small>
      </div>
      <div class="summary-card">
        <span>当前影响产品</span>
        <strong>{{ total }}</strong>
        <small>按顶层产品关系统计</small>
      </div>
      <div class="summary-card">
        <span>物料形态</span>
        <strong>{{ materialSummary.shapeAttr || '-' }}</strong>
        <small>{{ materialSummary.spec || '暂无规格' }}</small>
      </div>
      <div class="summary-card">
        <span>数据快照</span>
        <strong>{{ materialSummary.snapshotDate || '-' }}</strong>
        <small>EasyData 当前有效 BOM</small>
      </div>
    </section>

    <section class="table-panel">
      <div class="table-title">
        <div>
          <h2>当前 BOM 潜在影响</h2>
          <p v-if="hasSearched">共 {{ total }} 个顶层产品</p>
          <p v-else>输入物料料号后查询它被哪些产品使用</p>
        </div>
      </div>

      <el-table
        :data="rows"
        stripe
        border
        v-loading="loading"
        row-key="topProductCode"
        class="usage-table"
      >
        <el-table-column
          prop="topProductCode"
          label="顶层产品料号"
          width="165"
          fixed
          show-overflow-tooltip
        />
        <el-table-column
          prop="topProductName"
          label="顶层产品名称"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="topBomVersion"
          label="BOM版本"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column label="累计单台用量" width="145" align="right">
          <template #default="{ row }">
            {{ formatQuantity(row.totalQtyPerTop) }}
          </template>
        </el-table-column>
        <el-table-column prop="bomPathCount" label="路径数" width="85" align="right" />
        <el-table-column label="出现层级" width="105" align="center">
          <template #default="{ row }">
            {{ levelLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="节点类型" width="145">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag v-if="row.hasLeafOccurrence" size="small" type="success">叶子节点</el-tag>
              <el-tag v-if="row.hasNonLeafOccurrence" size="small" type="primary">中间件</el-tag>
              <span v-if="!row.hasLeafOccurrence && !row.hasNonLeafOccurrence">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="shapeAttr"
          label="物料形态"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column
          prop="sourceCategory"
          label="生产分类"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="costElementCode"
          label="成本要素"
          width="115"
          show-overflow-tooltip
        />
        <el-table-column
          prop="bomPurpose"
          label="BOM用途"
          width="105"
          show-overflow-tooltip
        />
        <el-table-column
          prop="samplePath"
          label="示例BOM路径"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column prop="snapshotDate" label="快照日期" width="115" />

        <template #empty>
          <el-empty :description="emptyDescription" />
        </template>
      </el-table>

      <BasePagination
        v-if="hasSearched"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshLeft, RefreshRight, Search } from '@element-plus/icons-vue'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchMaterialUsage,
  MATERIAL_USAGE_ORGANIZATIONS,
  normalizeMaterialUsagePage,
} from '../api/materialUsage'

const organizationOptions = MATERIAL_USAGE_ORGANIZATIONS
const filters = reactive({
  organizationCode: 'COMMERCIAL',
  partCode: '',
  topProductCode: '',
})

const rows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const hasSearched = ref(false)
const searchedPartCode = ref('')

const materialSummary = computed(() => {
  const first = rows.value[0] || {}
  return {
    code: first.partCode || searchedPartCode.value,
    name: first.partName || '',
    spec: first.partSpec || '',
    shapeAttr: first.shapeAttr || '',
    snapshotDate: first.snapshotDate || '',
  }
})

const emptyDescription = computed(() => {
  if (!hasSearched.value) {
    return '请输入物料料号开始查询'
  }
  return `当前组织的有效 BOM 中未找到物料 ${searchedPartCode.value}`
})

function queryParams() {
  return {
    organizationCode: filters.organizationCode,
    partCode: searchedPartCode.value,
    topProductCode: filters.topProductCode.trim(),
    page: currentPage.value,
    pageSize: pageSize.value,
  }
}

async function fetchRows() {
  if (!searchedPartCode.value) return
  loading.value = true
  try {
    const result = normalizeMaterialUsagePage(await fetchMaterialUsage(queryParams()))
    rows.value = result.list
    total.value = result.total
  } catch (error) {
    rows.value = []
    total.value = 0
    ElMessage.error(error.message || '物料使用关系查询失败')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  const code = filters.partCode.trim()
  if (!code) {
    ElMessage.warning('请输入物料料号')
    return
  }
  searchedPartCode.value = code
  hasSearched.value = true
  currentPage.value = 1
  fetchRows()
}

function resetFilters() {
  filters.organizationCode = 'COMMERCIAL'
  filters.partCode = ''
  filters.topProductCode = ''
  searchedPartCode.value = ''
  hasSearched.value = false
  currentPage.value = 1
  rows.value = []
  total.value = 0
}

function formatQuantity(value) {
  if (value === null || value === undefined || value === '') return '-'
  const text = String(value)
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

function levelLabel(row) {
  const min = row.minLevel
  const max = row.maxLevel
  if (min === null || min === undefined) return '-'
  return min === max ? `第 ${min} 层` : `${min}–${max} 层`
}

watch([currentPage, pageSize], () => {
  if (hasSearched.value) fetchRows()
})
</script>

<style scoped>
.material-usage-page {
  padding: 16px;
  color: #1f2937;
}

.page-toolbar,
.table-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-toolbar {
  margin-bottom: 14px;
}

.page-toolbar h1,
.table-title h2 {
  margin: 0;
  font-weight: 700;
}

.page-toolbar h1 {
  font-size: 22px;
}

.page-toolbar p,
.table-title p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.scope-alert {
  margin-bottom: 14px;
}

.query-panel,
.table-panel {
  margin-bottom: 14px;
  padding: 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.query-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.summary-card {
  min-height: 96px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.summary-card span,
.summary-card small {
  color: #6b7280;
}

.summary-card strong {
  margin: 6px 0 4px;
  color: #111827;
  font-size: 20px;
}

.table-title {
  margin-bottom: 12px;
}

.table-title h2 {
  font-size: 17px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .query-form :deep(.el-form-item) {
    width: 100%;
    margin-bottom: 12px;
  }
}
</style>
