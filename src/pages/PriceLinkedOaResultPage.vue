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
        <el-form-item label="客户">
          <el-input v-model="filters.customer" placeholder="客户名称" />
        </el-form-item>
        <el-form-item label="业务单元">
          <el-select v-model="filters.businessUnitType" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="COMMERCIAL" value="COMMERCIAL" />
            <el-option label="HOUSEHOLD" value="HOUSEHOLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="物料编码">
          <el-input v-model="filters.itemCode" placeholder="物料编码" />
        </el-form-item>
        <el-form-item label="价格月份">
          <el-input v-model="filters.pricingMonth" placeholder="2026-05" />
        </el-form-item>
        <el-form-item label="计算状态">
          <el-select v-model="filters.calcStatus" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAILED" />
            <el-option label="待刷新" value="PENDING" />
          </el-select>
        </el-form-item>
        <el-form-item label="变量来源">
          <el-select v-model="filters.variableSource" placeholder="全部" clearable>
            <el-option label="全部" value="" />
            <el-option label="OA报价单基价覆盖" value="QUOTE_BASE" />
            <el-option label="影响因素月度价" value="FINANCE_FACTOR" />
            <el-option label="行局部字段" value="PART_CONTEXT" />
            <el-option label="派生公式" value="DERIVED" />
            <el-option label="常量" value="CONST" />
            <el-option label="缺失" value="MISSING" />
          </el-select>
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

    <el-card shadow="never" class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <span>联动价物料数</span>
          <strong>{{ total }}</strong>
        </div>
        <div class="summary-item">
          <span>计算成功数</span>
          <strong>{{ summary.success }}</strong>
        </div>
        <div class="summary-item">
          <span>计算失败数</span>
          <strong>{{ summary.failed }}</strong>
        </div>
        <div class="summary-item">
          <span>有 trace 数</span>
          <strong>{{ summary.hasTrace }}</strong>
        </div>
        <div class="summary-item">
          <span>OA基价覆盖变量</span>
          <strong>{{ summary.quoteBaseVariables }}</strong>
        </div>
        <div class="summary-item">
          <span>月度影响因素变量</span>
          <strong>{{ summary.financeVariables }}</strong>
        </div>
        <div class="summary-item">
          <span>调价/派生变量</span>
          <strong>{{ summary.derivedVariables }}</strong>
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
        <el-table-column prop="pricingMonth" label="价格月份" width="110" />
        <el-table-column prop="shapeAttr" label="形态属性" width="120" />
        <el-table-column prop="bomQty" label="部品用量" width="120" />
        <el-table-column prop="partUnitPrice" label="部品单价" width="120" />
        <el-table-column prop="partAmount" label="部品价格" width="120" />
        <el-table-column label="OA基价覆盖" width="130">
          <template #default="{ row }">
            <el-tag v-if="quoteBaseCount(row) > 0" type="success" effect="light">
              {{ quoteBaseCount(row) }} 个
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
        本次刷新未记录 trace，请点击列表页"刷新"后重试。
      </div>
      <div v-else class="trace-body">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="OA单号">{{ traceMeta.oaNo }}</el-descriptions-item>
          <el-descriptions-item label="末端料号">{{ traceMeta.itemCode }}</el-descriptions-item>
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
            <el-descriptions-item label="模式">{{ traceData?.mode || '—' }}</el-descriptions-item>
            <!-- V48 新增：联动价主表 Excel 金标 + 月份，用于业务对比是否同月一致 -->
            <el-descriptions-item v-if="traceData?.manualPrice !== undefined" label="主表金标">
              {{ formatNum(traceData?.manualPrice) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="traceData?.manualPriceMonth" label="主表月份">
              {{ traceData?.manualPriceMonth }}
            </el-descriptions-item>
            <!-- legacy/dual 灰度切换 dual→new 后这些字段不再写入；保留 v-if 兜底显示历史 trace -->
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
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import BasePagination from '../components/BasePagination.vue'
import {
  fetchPriceLinkedCalc,
  refreshPriceLinkedCalc,
  fetchCalcTrace,
} from '../api/priceLinkedCalc'
import { parseTraceJson } from './priceLinkedResultUtils'

const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const total = ref(0)
const refreshing = ref(false)

const filters = ref({
  oaNo: String(route.query.oaNo || '').trim(),
  customer: '',
  businessUnitType: '',
  itemCode: '',
  pricingMonth: '',
  calcStatus: '',
  variableSource: '',
  shapeAttr: '',
})

const currentPage = ref(1)
const pageSize = ref(20)

const buildParams = () => ({
  oaNo: filters.value.oaNo?.trim(),
  customer: filters.value.customer?.trim(),
  businessUnitType: filters.value.businessUnitType,
  itemCode: filters.value.itemCode?.trim(),
  pricingMonth: filters.value.pricingMonth?.trim(),
  calcStatus: filters.value.calcStatus,
  variableSource: filters.value.variableSource,
  shapeAttr: filters.value.shapeAttr,
  page: currentPage.value,
  pageSize: pageSize.value,
})

const summary = computed(() => {
  const rows = tableRows.value || []
  let success = 0
  let failed = 0
  let hasTrace = 0
  let quoteBaseVariables = 0
  let financeVariables = 0
  let derivedVariables = 0
  rows.forEach((row) => {
    if (row.calcStatus === 'SUCCESS') success += 1
    if (row.calcStatus === 'FAILED') failed += 1
    if (row.hasTrace) hasTrace += 1
    const sourceSummary = row.variableSourceSummary || {}
    quoteBaseVariables += Number(sourceSummary.QUOTE_BASE || 0)
    financeVariables += Number(sourceSummary.FINANCE || sourceSummary.FINANCE_FACTOR || 0)
    derivedVariables += Number(sourceSummary.DERIVED || sourceSummary.FORMULA_REF || 0)
  })
  return { success, failed, hasTrace, quoteBaseVariables, financeVariables, derivedVariables }
})

const quoteBaseCount = (row) => Number(row?.variableSourceSummary?.QUOTE_BASE || 0)

const fetchList = async () => {
  // V48：必须输 OA 单号才查询。否则不带 OA 时后端会返回联动价主表 22 条料号
  // (OA 单号 / 用量 / 单价 全空)，业务侧看着像 bug。强制 OA 必填，引导业务先输再查。
  if (!filters.value.oaNo?.trim()) {
    tableRows.value = []
    total.value = 0
    return
  }
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
    customer: '',
    businessUnitType: '',
    itemCode: '',
    pricingMonth: '',
    calcStatus: '',
    variableSource: '',
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
  if (status === 'SUCCESS') return '成功'
  if (status === 'FAILED') return '失败'
  if (status === 'PENDING') return '待刷新'
  return '—'
}

const calcStatusTag = (status) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'info'
}

const sourceText = (source) => {
  const map = {
    QUOTE_BASE: 'OA报价单基价覆盖',
    FINANCE: '报价单基价/影响因素月度价',
    FINANCE_FACTOR: '影响因素月度价',
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
    ElMessage.warning('该行尚未生成 trace，请先刷新')
    return
  }
  traceMeta.value = {
    oaNo: row.oaNo,
    itemCode: row.itemCode,
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
