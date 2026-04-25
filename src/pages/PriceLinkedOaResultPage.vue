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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <!-- calcId 缺失（BOM 行尚未计算过）→ 禁用；否则弹窗展示 trace -->
            <el-button
              type="primary"
              link
              :disabled="!row?.calcId"
              @click="openTrace(row)"
            >
              查看 trace
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <!-- trace 弹窗 —— 复用 parseTraceJson + buildTraceTimeline 的分段模型 -->
    <el-dialog
      v-model="traceVisible"
      title="联动价计算追踪"
      width="760px"
      :close-on-click-modal="false"
    >
      <div v-if="traceLoading" class="trace-loading">加载中…</div>
      <div v-else-if="!traceData" class="trace-empty">
        本次刷新未记录 trace，请点击列表页"刷新"后重试。
      </div>
      <div v-else class="trace-body">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="OA单号">{{ traceMeta.oaNo }}</el-descriptions-item>
          <el-descriptions-item label="末端料号">{{ traceMeta.itemCode }}</el-descriptions-item>
          <el-descriptions-item label="部品用量">{{ traceMeta.bomQty }}</el-descriptions-item>
          <el-descriptions-item label="系统部品单价">{{ traceMeta.partUnitPrice }}</el-descriptions-item>
          <el-descriptions-item label="中文公式" :span="2">
            <code class="expr-code">{{ traceMeta.formulaExprCn || '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="规范化公式" :span="2">
            <code class="expr-code">{{ traceData?.normalizedExpr || traceMeta.formulaExpr || '—' }}</code>
          </el-descriptions-item>
        </el-descriptions>

        <div class="trace-section">
          <div class="section-title">变量代入</div>
          <el-table
            :data="variableRows"
            size="small"
            border
            empty-text="无变量"
            max-height="280"
          >
            <el-table-column prop="code" label="变量代码" min-width="200" />
            <el-table-column prop="value" label="代入值" min-width="160" />
          </el-table>
        </div>

        <div class="trace-section">
          <div class="section-title">求值结果</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="公式求值结果">
              {{ formatNum(traceData?.result) }}
            </el-descriptions-item>
            <el-descriptions-item label="模式">{{ traceData?.mode || '—' }}</el-descriptions-item>
            <el-descriptions-item v-if="traceData?.legacyResult !== undefined" label="legacy 结果">
              {{ formatNum(traceData?.legacyResult) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.newResult !== undefined" label="new 结果">
              {{ formatNum(traceData?.newResult) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.diff !== undefined" label="双跑差异">
              {{ formatNum(traceData?.diff) }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <el-alert
          v-if="traceData?.error"
          type="error"
          :title="`错误：${traceData.error}`"
          :closable="false"
          show-icon
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchPriceLinkedCalc,
  refreshPriceLinkedCalc,
  fetchCalcTrace,
} from '../api/priceLinkedCalc'
import { parseTraceJson } from './priceLinkedResultUtils'

const loading = ref(false)
const tableRows = ref([])
const total = ref(0)
const refreshing = ref(false)

const filters = ref({
  oaNo: '',
  itemCode: '',
  shapeAttr: '',
})

const currentPage = ref(1)
const pageSize = ref(20)

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

// ==================== trace 弹窗状态 ====================
const traceVisible = ref(false)
const traceLoading = ref(false)
const traceData = ref(null)
// traceMeta 保留触发行的上下文（料号 / 单价 / 公式中文），方便弹窗交叉展示
const traceMeta = ref({
  oaNo: '',
  itemCode: '',
  bomQty: '',
  partUnitPrice: '',
  formulaExpr: '',
  formulaExprCn: '',
})

// 变量代入表：扁平化 {code: value} 为表格行
const variableRows = computed(() => {
  const vars = traceData.value?.variables
  if (!vars || typeof vars !== 'object') return []
  return Object.entries(vars).map(([code, value]) => ({ code, value }))
})

// BigDecimal → string / 数字美观显示；null/undefined → 中划线
const formatNum = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

const openTrace = async (row) => {
  if (!row?.calcId) {
    ElMessage.warning('该行尚未生成 trace，请先刷新')
    return
  }
  traceMeta.value = {
    oaNo: row.oaNo,
    itemCode: row.itemCode,
    bomQty: formatNum(row.bomQty),
    partUnitPrice: formatNum(row.partUnitPrice),
    formulaExpr: row.formulaExpr || '',
    formulaExprCn: row.formulaExprCn || '',
  }
  traceData.value = null
  traceVisible.value = true
  traceLoading.value = true
  try {
    const resp = await fetchCalcTrace(row.calcId)
    traceData.value = parseTraceJson(resp?.traceJson)
  } catch (error) {
    ElMessage.error(error?.message || '获取 trace 失败')
    traceData.value = null
  } finally {
    traceLoading.value = false
  }
}

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

.trace-loading,
.trace-empty {
  padding: 24px 0;
  color: #6b7280;
  text-align: center;
}

.trace-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trace-section .section-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.expr-code {
  display: inline-block;
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
