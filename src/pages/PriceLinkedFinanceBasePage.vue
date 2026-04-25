<template>
  <div class="base-page">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">影响因素表</div>
        <div class="filter-actions">
          <!-- T22：改用后端 /base-prices/import-excel —— 前端不再本地解析 Excel -->
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
          >
            <el-button type="primary" :loading="importing">导入 Excel</el-button>
          </el-upload>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.priceMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="简称/影响因素" />
        </el-form-item>
        <!-- T22：批次历史下拉 —— 数据源来自当前查询结果中出现的 importBatchId，客户端筛选 -->
        <el-form-item label="导入批次">
          <el-select
            v-model="filters.batchId"
            placeholder="全部批次"
            clearable
            style="width: 240px"
          >
            <el-option
              v-for="b in availableBatches"
              :key="b.id"
              :label="b.label"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="base-title">{{ monthTitle }}</div>
      <el-table :data="filteredRows" stripe v-loading="loading">
        <el-table-column prop="seq" label="序号" width="90" />
        <el-table-column
          prop="factorName"
          label="价表影响因素名称"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column prop="shortName" label="简称" width="120" />
        <el-table-column prop="priceSource" label="取价来源" width="140" />
        <!-- T22：当期价 / 原价 / 涨跌幅 三列 —— 替换原单列"价格" -->
        <el-table-column prop="price" label="当期价" width="120" align="right">
          <template #default="{ row }">{{ formatNumber(row.price) }}</template>
        </el-table-column>
        <el-table-column
          prop="priceOriginal"
          label="原价"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            {{ formatNumber(row.priceOriginal) }}
          </template>
        </el-table-column>
        <el-table-column label="涨跌幅" width="110" align="right">
          <template #default="{ row }">
            <span :class="percentChangeClass(row)">
              {{ percentChangeText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="90" />
        <el-table-column prop="linkType" label="固定/联动" width="110" />
        <el-table-column
          prop="importBatchId"
          label="批次"
          width="120"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="batch-tag">{{ shortBatchId(row.importBatchId) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑影响因素" width="520px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="formModel.priceMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="序号">
          <el-input v-model="formModel.seq" />
        </el-form-item>
        <el-form-item label="影响因素">
          <el-input v-model="formModel.factorName" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="formModel.shortName" />
        </el-form-item>
        <el-form-item label="取价来源">
          <el-input v-model="formModel.priceSource" />
        </el-form-item>
        <el-form-item label="当期价">
          <el-input v-model="formModel.price" />
        </el-form-item>
        <!-- T22：编辑时同样允许手工修正原价 -->
        <el-form-item label="原价">
          <el-input v-model="formModel.priceOriginal" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" placeholder="公斤" />
        </el-form-item>
        <el-form-item label="固定/联动">
          <el-select v-model="formModel.linkType" placeholder="固定">
            <el-option label="固定" value="固定" />
            <el-option label="联动" value="联动" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// T22：列表走 T19 新建的 financeBasePrice.list，导入走 importInfluenceFactors（multipart）
import { list as fetchBasePrices, importInfluenceFactors } from '../api/financeBasePrice'
import { updateBasePrice, deleteBasePrice } from '../api/basePrices'
import {
  calcPercentChange,
  formatNumber,
  formatPercentChange,
  shortBatchId,
} from './financeBasePriceUtils'

const loading = ref(false)
const tableRows = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const importing = ref(false)

const filters = ref({
  priceMonth: '',
  keyword: '',
  /** T22：客户端批次过滤 —— 从当前 tableRows 推出可选项 */
  batchId: '',
})

const formModel = ref({
  priceMonth: '',
  seq: '',
  factorName: '',
  shortName: '',
  priceSource: '',
  price: '',
  priceOriginal: '',
  unit: '公斤',
  linkType: '固定',
})

const monthTitle = computed(() => {
  const month = filters.value.priceMonth || tableRows.value[0]?.priceMonth || ''
  if (!month) {
    return '参照基准'
  }
  const [year, monthPart] = month.split('-')
  if (!year || !monthPart) {
    return '参照基准'
  }
  return `${year}年${Number(monthPart)}月参照基准`
})

/** 从当前结果集中去重得到批次下拉选项；label 显示短批次+行数，方便定位 */
const availableBatches = computed(() => {
  const buckets = new Map()
  for (const row of tableRows.value) {
    const bid = row.importBatchId
    if (!bid) continue
    if (!buckets.has(bid)) buckets.set(bid, 0)
    buckets.set(bid, buckets.get(bid) + 1)
  }
  return Array.from(buckets.entries()).map(([id, count]) => ({
    id,
    label: `${shortBatchId(id)}（${count} 行）`,
  }))
})

/** T22：批次筛选在客户端做 —— 列表接口目前没有 batchId 过滤参数 */
const filteredRows = computed(() => {
  if (!filters.value.batchId) return tableRows.value
  return tableRows.value.filter(
    (row) => row.importBatchId === filters.value.batchId
  )
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchBasePrices({
      priceMonth: filters.value.priceMonth,
      keyword: filters.value.keyword,
    })
    tableRows.value = Array.isArray(data) ? data : []
    if (!filters.value.priceMonth && tableRows.value.length > 0) {
      filters.value.priceMonth = tableRows.value[0].priceMonth || ''
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取影响因素表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = {
    priceMonth: '',
    keyword: '',
    batchId: '',
  }
  fetchList()
}

const openEdit = (row) => {
  editingId.value = row.id
  formModel.value = {
    priceMonth: row.priceMonth,
    seq: row.seq,
    factorName: row.factorName,
    shortName: row.shortName,
    priceSource: row.priceSource,
    price: row.price,
    priceOriginal: row.priceOriginal,
    unit: row.unit,
    linkType: row.linkType,
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!editingId.value) {
    dialogVisible.value = false
    return
  }
  if (!formModel.value.priceMonth || !formModel.value.shortName) {
    ElMessage.warning('月份和简称必填')
    return
  }
  await updateBasePrice(editingId.value, formModel.value)
  ElMessage.success('影响因素已更新')
  dialogVisible.value = false
  fetchList()
}

const removeRow = async (row) => {
  await ElMessageBox.confirm('确定删除该影响因素吗？', '提示', {
    type: 'warning',
  })
  await deleteBasePrice(row.id)
  ElMessage.success('已删除')
  fetchList()
}

/** 涨跌幅显示文本 —— 委托给纯函数 */
const percentChangeText = (row) =>
  formatPercentChange(calcPercentChange(row.price, row.priceOriginal))

/** 涨跌幅配色：涨橙跌绿（国内财务习惯） */
const percentChangeClass = (row) => {
  const ratio = calcPercentChange(row.price, row.priceOriginal)
  if (ratio === null) return 'pct-flat'
  if (ratio > 0) return 'pct-up'
  if (ratio < 0) return 'pct-down'
  return 'pct-flat'
}

/** T22：Excel 导入 —— 交给后端 /base-prices/import-excel 统一解析（T17） */
const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) return
  const priceMonth = filters.value.priceMonth
  if (!priceMonth) {
    ElMessage.warning('请先选择价格月份再导入')
    return
  }
  importing.value = true
  try {
    const resp = await importInfluenceFactors(rawFile, priceMonth)
    const imported = resp?.imported ?? 0
    const batchId = resp?.batchId ?? ''
    const skipped = resp?.skipped ?? 0
    ElMessage.success(`${imported} 行导入，批次 ${shortBatchId(batchId)}`)
    if (skipped > 0) {
      // 跳过明细 toast 简化展示；详细错误行号后续可进明细弹窗
      ElMessage.warning(`另有 ${skipped} 行跳过，请在错误列表确认`)
    }
    // 重新拉取并自动定位到本次批次
    await fetchList()
    filters.value.batchId = batchId
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

/** 暴露给单测：calcPercentChange / shortBatchId（模板里已使用） */
defineExpose({ calcPercentChange, shortBatchId })

onMounted(fetchList)
</script>

<style scoped>
.base-page {
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

.base-title {
  font-size: 18px;
  font-weight: 600;
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

/* T22：涨跌幅颜色 —— 绿涨红跌（国内财务习惯） */
.pct-up {
  color: #e6a23c;
}

.pct-down {
  color: #67c23a;
}

.pct-flat {
  color: #909399;
}

.batch-tag {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #606266;
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
