<template>
  <div class="oa-result">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">联动价结果</div>
        <div class="filter-actions">
          <el-button :loading="loading" @click="fetchList">刷新</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="OA单号">
          <el-input v-model="filters.oaNo" placeholder="OA单号" />
        </el-form-item>
        <el-form-item label="客户">
          <el-input v-model="filters.customer" placeholder="客户名称" />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-select v-model="filters.businessUnitType" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="商用" value="COMMERCIAL" />
            <el-option label="家用" value="HOUSEHOLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="物料编码">
          <el-input v-model="filters.itemCode" placeholder="物料编码" />
        </el-form-item>
        <el-form-item label="计算场景">
          <el-select v-model="filters.calcScene" placeholder="全部" clearable style="width: 150px">
            <el-option label="全部" value="" />
            <el-option label="正常报价" value="QUOTE" />
            <el-option label="月度调价" value="MONTHLY_ADJUST" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格月份">
          <el-input v-model="filters.pricingMonth" placeholder="2026-05" />
        </el-form-item>
        <el-form-item label="计算状态">
          <el-select v-model="filters.calcStatus" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="成功" value="OK" />
            <el-option label="失败" value="FAILED" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果来源">
          <el-select v-model="filters.factorSource" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="客户锁价" value="OA_LOCKED" />
            <el-option label="财务基准" value="FINANCE_QUOTE_BASE" />
            <el-option label="月度影响因素" value="MONTHLY_FACTOR" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <span>结果总数</span>
          <strong>{{ total }}</strong>
        </div>
        <div class="summary-item">
          <span>本页成功</span>
          <strong>{{ summary.success }}</strong>
        </div>
        <div class="summary-item">
          <span>本页失败</span>
          <strong>{{ summary.failed }}</strong>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableRows" stripe v-loading="loading">
        <el-table-column prop="oaNo" label="OA单号" min-width="180" />
        <el-table-column prop="customer" label="客户" min-width="140" />
        <el-table-column prop="businessUnitType" label="业务单元" min-width="120" />
        <el-table-column prop="itemCode" label="物料编码" min-width="150" />
        <el-table-column prop="materialName" label="物料名称" min-width="160" />
        <el-table-column prop="supplierName" label="供应商" min-width="140" />
        <el-table-column label="计算场景" width="110">
          <template #default="{ row }">
            <el-tag effect="light" :type="row.calcScene === 'MONTHLY_ADJUST' ? 'warning' : 'success'">
              {{ calcSceneText(row.calcScene) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pricingMonth" label="价格月份" width="110" />
        <el-table-column prop="shapeAttr" label="形态属性" width="120" />
        <el-table-column prop="bomQty" label="部品用量" width="120" />
        <el-table-column prop="partUnitPrice" label="部品单价" width="120" />
        <el-table-column prop="partAmount" label="部品价格" width="120" />
        <el-table-column label="结果来源" width="120">
          <template #default="{ row }">
            {{ factorSourceText(row.factorSource) }}
          </template>
        </el-table-column>
        <el-table-column label="OA锁价变量" width="130">
          <template #default="{ row }">
            <el-tag v-if="oaLockedCount(row) > 0" type="success" effect="light">
              {{ oaLockedCount(row) }} 个
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="计算状态" width="110">
          <template #default="{ row }">
            <el-tag :type="calcStatusTag(row.calcStatus)" effect="light">
              {{ calcStatusText(row.calcStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="calcMessage" label="计算信息" min-width="180" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="计算时间" min-width="160" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <!-- calcId 缺失（BOM 行尚未计算过）→ 禁用；否则弹窗展示 trace -->
            <el-button
              type="primary"
              link
              :disabled="!row?.calcId"
              @click="openTrace(row)"
            >
              查看明细
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
        暂无计算明细，请从报价核算页重新核算。
      </div>
      <div v-else class="trace-body">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="OA单号">{{ traceMeta.oaNo }}</el-descriptions-item>
          <el-descriptions-item label="末端料号">{{ traceMeta.itemCode }}</el-descriptions-item>
          <el-descriptions-item label="计算场景">{{ calcSceneText(traceMeta.calcScene) }}</el-descriptions-item>
          <el-descriptions-item label="变量来源">{{ factorSourceText(traceMeta.factorSource) }}</el-descriptions-item>
          <el-descriptions-item label="价格月份">{{ traceMeta.pricingMonth }}</el-descriptions-item>
          <el-descriptions-item label="计算状态">{{ calcStatusText(traceMeta.calcStatus) }}</el-descriptions-item>
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
            <el-table-column prop="name" label="变量名称" min-width="160" />
            <el-table-column prop="value" label="代入值" min-width="160" />
            <el-table-column label="来源类型" min-width="160">
              <template #default="{ row }">
                {{ sourceText(row.source) }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="trace-section">
          <div class="section-title">求值结果</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="公式求值结果">
              {{ formatNum(traceData?.result) }}
            </el-descriptions-item>
            <!-- V48 新增：联动价主表 Excel 金标 + 月份，用于业务对比是否同月一致 -->
            <el-descriptions-item v-if="traceData?.manualPrice !== undefined" label="原表参考价">
              {{ formatNum(traceData?.manualPrice) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.manualPriceMonth" label="主表月份">
              {{ traceData?.manualPriceMonth }}
            </el-descriptions-item>
            <!-- 已保存的历史对照仍可查看。 -->
            <el-descriptions-item v-if="traceData?.legacyResult !== undefined" label="历史旧算法结果">
              {{ formatNum(traceData?.legacyResult) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.newResult !== undefined" label="历史新算法结果">
              {{ formatNum(traceData?.newResult) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.diff !== undefined" label="历史对照差异">
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
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchPriceLinkedCalcResults,
  fetchCalcTrace,
} from '../api/priceLinkedCalc'
import { parseTraceJson } from './priceLinkedResultUtils'

const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const total = ref(0)

const filters = ref({
  oaNo: String(route.query.oaNo || '').trim(),
  customer: '',
  businessUnitType: '',
  itemCode: '',
  calcScene: '',
  pricingMonth: '',
  calcStatus: '',
  factorSource: '',
})

const currentPage = ref(1)
const pageSize = ref(20)


const buildParams = () => ({
  oaNo: filters.value.oaNo?.trim(),
  customer: filters.value.customer?.trim(),
  businessUnitType: filters.value.businessUnitType,
  itemCode: filters.value.itemCode?.trim(),
  calcScene: filters.value.calcScene,
  pricingMonth: filters.value.pricingMonth?.trim(),
  calcStatus: filters.value.calcStatus,
  factorSource: filters.value.factorSource,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const summary = computed(() => {
  const rows = tableRows.value || []
  let success = 0
  let failed = 0
  rows.forEach((row) => {
    if (row.calcStatus === 'OK' || row.calcStatus === 'SUCCESS') success += 1
    if (row.calcStatus === 'FAILED') failed += 1
  })
  return { success, failed }
})

const oaLockedCount = (row) =>
  Number(row?.variableSourceSummary?.OA_LOCKED || row?.variableSourceSummary?.QUOTE_BASE || 0)

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchPriceLinkedCalcResults(buildParams())
    tableRows.value = data?.list || []
    total.value = data?.total || 0
  } catch (error) {
    tableRows.value = []
    total.value = 0
    ElMessage.error(error?.message || '获取联动价结果失败')
  } finally {
    loading.value = false
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
    customer: '',
    businessUnitType: '',
    itemCode: '',
    calcScene: '',
    pricingMonth: '',
    calcStatus: '',
    factorSource: '',
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

watch(
  () => route.query.oaNo,
  (value) => {
    const nextOaNo = String(value || '').trim()
    if (nextOaNo && nextOaNo !== filters.value.oaNo) {
      filters.value.oaNo = nextOaNo
      applyFilters()
    }
  },
)

// ==================== trace 弹窗状态 ====================
const traceVisible = ref(false)
const traceLoading = ref(false)
const traceData = ref(null)
// traceMeta 保留触发行的上下文（料号 / 单价 / 公式中文），方便弹窗交叉展示
const traceMeta = ref({
  oaNo: '',
  itemCode: '',
  calcScene: '',
  factorSource: '',
  pricingMonth: '',
  calcStatus: '',
  bomQty: '',
  partUnitPrice: '',
  formulaExpr: '',
  formulaExprCn: '',
})

// 变量代入表：扁平化 {code: value} 为表格行
const variableRows = computed(() => {
  if (Array.isArray(traceData.value?.variableDetails)) {
    return traceData.value.variableDetails.map((row) => ({
      code: row.code,
      name: row.name || row.code,
      value: row.value,
      source: row.source || '',
    }))
  }
  const vars = traceData.value?.variables
  if (!vars || typeof vars !== 'object') return []
  return Object.entries(vars).map(([code, value]) => ({ code, name: code, value, source: '' }))
})

// BigDecimal → string / 数字美观显示；null/undefined → 中划线
const formatNum = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

const calcStatusText = (status) => {
  if (status === 'OK' || status === 'SUCCESS') return '成功'
  if (status === 'FAILED') return '失败'
  if (status === 'PENDING') return '待计算'
  return '—'
}

const calcStatusTag = (status) => {
  if (status === 'OK' || status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'info'
}

const calcSceneText = (scene) => {
  if (scene === 'QUOTE') return '正常报价'
  if (scene === 'MONTHLY_ADJUST') return '月度调价'
  return scene || '—'
}

const factorSourceText = (source) => {
  const map = {
    OA_LOCKED: '客户锁价',
    FINANCE_QUOTE_BASE: '财务基准',
    QUOTE_BASE: 'OA报价单基价覆盖',
    MONTHLY_FACTOR: '月度影响因素',
    FINANCE_FACTOR: '影响因素月度价',
  }
  return map[source] || source || '—'
}

const sourceText = (source) => {
  const map = {
    OA_LOCKED: '客户锁价',
    FINANCE_QUOTE_BASE: '财务基准',
    QUOTE_BASE: 'OA报价单基价覆盖',
    FINANCE: '报价单基价/影响因素月度价',
    FINANCE_FACTOR: '影响因素月度价',
    MONTHLY_FACTOR: '月度影响因素',
    PART_CONTEXT: '行局部字段',
    DERIVED: '派生公式/调价结果',
    FORMULA_REF: '派生公式',
    CONST: '常量',
    MISSING: '缺失',
    UNKNOWN: '未知',
  }
  return map[source] || source || '—'
}

const openTrace = async (row) => {
  if (!row?.calcId) {
    ElMessage.warning('尚未生成计算明细，请从报价核算页发起核算')
    return
  }
  traceMeta.value = {
    oaNo: row.oaNo,
    itemCode: row.itemCode,
    calcScene: row.calcScene || '',
    factorSource: row.factorSource || '',
    pricingMonth: row.pricingMonth || '',
    calcStatus: row.calcStatus || '',
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
    ElMessage.error(error?.message || '获取计算明细失败')
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

.summary-card {
  padding-bottom: 4px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.summary-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.summary-item span {
  color: #6b7280;
  font-size: 13px;
}

.summary-item strong {
  color: #111827;
  font-size: 18px;
}

.muted {
  color: #9ca3af;
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
