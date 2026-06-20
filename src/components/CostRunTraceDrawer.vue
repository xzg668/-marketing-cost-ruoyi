<template>
  <el-drawer
    v-model="visible"
    title="核算底稿"
    size="840px"
    destroy-on-close
    @opened="loadTraces"
  >
    <div class="trace-shell">
      <div class="trace-head">
        <strong>{{ displayVersionNo }}</strong>
        <span>{{ costRunNo || '-' }}</span>
      </div>

      <el-alert
        v-if="emptySnapshotVisible"
        type="info"
        show-icon
        :closable="false"
        title="该版本未生成底稿快照"
      />

      <div class="trace-body">
        <aside class="trace-list">
          <el-tabs v-model="activeGroup" stretch>
            <el-tab-pane label="部品价格" name="PART_PRICE" />
            <el-tab-pane label="费用项目" name="COST" />
          </el-tabs>
          <el-scrollbar class="trace-scroll">
            <button
              v-for="row in groupedRows"
              :key="row.id"
              type="button"
              class="trace-row"
              :class="{ active: row.id === selectedId }"
              @click="selectTrace(row)"
            >
              <span class="trace-row-title">{{ traceTitle(row) }}</span>
              <span class="trace-row-sub">{{ traceSubTitle(row) }}</span>
              <span class="trace-row-amount">{{ formatMoney(row.amount) }}</span>
            </button>
            <el-empty
              v-if="!loading && groupedRows.length === 0"
              description="暂无底稿条目"
            />
          </el-scrollbar>
        </aside>

        <main class="trace-detail" v-loading="detailLoading || loading">
          <template v-if="selectedDetail">
            <div class="detail-title">
              <div>
                <strong>{{ detailTitle }}</strong>
                <span>{{ traceCategoryLabel(selectedDetail.traceType) }} / {{ selectedDetail.traceKey }}</span>
              </div>
              <el-tag effect="plain">{{ detailTypeAndMethodLabel(selectedDetail) }}</el-tag>
            </div>

            <section class="finance-summary">
              <div>
                <span>{{ selectedDetail.traceType === 'PART_PRICE' ? '部品类型' : '项目类型' }}</span>
                <strong>{{ partCategoryLabel(selectedDetail) }}</strong>
              </div>
              <div>
                <span>取价方式</span>
                <strong>{{ priceMethodLabel(selectedDetail.sourceType) }}</strong>
              </div>
              <div>
                <span>{{ selectedDetail.traceType === 'PART_PRICE' ? '单价' : '基数' }}</span>
                <strong>{{ selectedDetail.traceType === 'PART_PRICE' ? formatMoney(selectedDetail.unitPrice) : formatMoney(selectedDetail.baseAmount) }}</strong>
              </div>
              <div>
                <span>{{ selectedDetail.traceType === 'PART_PRICE' ? 'BOM 用量' : '费率' }}</span>
                <strong>{{ selectedDetail.traceType === 'PART_PRICE' ? formatMoney(selectedDetail.quantity) : formatRate(selectedDetail.rate) }}</strong>
              </div>
              <div>
                <span>本次金额</span>
                <strong>{{ formatMoney(selectedDetail.amount) }}</strong>
              </div>
            </section>

            <section class="detail-section" v-if="financeSummaryText">
              <h3>取数说明</h3>
              <div class="plain-note">{{ financeSummaryText }}</div>
            </section>

            <section class="detail-section">
              <h3>计算公式</h3>
              <div class="formula-card">
                <strong>{{ formulaCard.displayFormula }}</strong>
                <span v-for="line in formulaCard.lines" :key="line">{{ line }}</span>
              </div>
            </section>

            <section class="detail-section" v-if="priceLineRows.length">
              <h3>{{ priceLineTitle }}</h3>
              <el-table :data="priceLineRows" border size="small" empty-text="暂无价格行">
                <el-table-column prop="label" label="项目" min-width="150" />
                <el-table-column label="值" min-width="220">
                  <template #default="{ row }">{{ formatValue(row.value) }}</template>
                </el-table-column>
              </el-table>
            </section>

            <section class="detail-section" v-if="isMakePartTrace && childRows.length">
              <h3>自制件明细</h3>
              <el-table :data="childRows" border size="small" empty-text="暂无明细">
                <el-table-column label="原材料" min-width="190" fixed="left">
                  <template #default="{ row }">
                    <div class="cell-stack">
                      <strong>{{ row.childMaterialNo || '-' }}</strong>
                      <span>{{ row.childMaterialName || '-' }}</span>
                      <span v-if="row.childMaterialSpec">{{ row.childMaterialSpec }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="itemProcessType" label="加工类型" width="110" />
                <el-table-column label="下料重量(g)" width="120" align="right">
                  <template #default="{ row }">{{ formatValue(row.grossWeightG) }}</template>
                </el-table-column>
                <el-table-column label="净重(g)" width="100" align="right">
                  <template #default="{ row }">{{ formatValue(row.netWeightG) }}</template>
                </el-table-column>
                <el-table-column label="废料" min-width="170">
                  <template #default="{ row }">
                    <div class="cell-stack">
                      <strong>{{ row.scrapCode || '-' }}</strong>
                      <span>{{ row.scrapName || '-' }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="材料价格" width="110" align="right">
                  <template #default="{ row }">{{ formatValue(row.rawUnitPrice) }}</template>
                </el-table-column>
                <el-table-column label="回收单价" width="110" align="right">
                  <template #default="{ row }">{{ formatValue(row.scrapUnitPrice) }}</template>
                </el-table-column>
                <el-table-column label="本行成本" width="120" align="right">
                  <template #default="{ row }">{{ formatValue(row.costPrice) }}</template>
                </el-table-column>
                <el-table-column label="行公式" min-width="260">
                  <template #default="{ row }">{{ makePartRowFormula(row) }}</template>
                </el-table-column>
                <el-table-column label="说明" min-width="160">
                  <template #default="{ row }">{{ makePartRowRemark(row) }}</template>
                </el-table-column>
              </el-table>
            </section>

            <section class="detail-section">
              <h3>{{ isLinkedTrace ? '公式变量' : '关键取值' }}</h3>
              <el-table :data="variableRows" border size="small" empty-text="暂无变量">
                <el-table-column prop="label" :label="isLinkedTrace ? '变量' : '项目'" min-width="150" />
                <el-table-column v-if="isLinkedTrace" prop="code" label="变量编码" min-width="150" />
                <el-table-column label="取值" min-width="150">
                  <template #default="{ row }">{{ formatValue(row.value) }}</template>
                </el-table-column>
                <el-table-column v-if="isLinkedTrace" prop="source" label="变量类型" min-width="150" />
              </el-table>
            </section>

            <section class="detail-section" v-if="!isMakePartTrace && childRows.length">
              <h3>{{ childSectionTitle }}</h3>
              <el-table :data="childRows" border size="small" empty-text="暂无明细">
                <el-table-column prop="costCode" label="编码" width="150" />
                <el-table-column prop="costName" label="名称" min-width="180" />
                <el-table-column label="基数" width="120">
                  <template #default="{ row }">{{ formatValue(row.baseAmount) }}</template>
                </el-table-column>
                <el-table-column label="费率" width="100">
                  <template #default="{ row }">{{ formatRate(row.rate) }}</template>
                </el-table-column>
                <el-table-column label="金额" width="120">
                  <template #default="{ row }">{{ formatValue(row.amount) }}</template>
                </el-table-column>
                <el-table-column label="是否计入" width="100">
                  <template #default="{ row }">{{ row.included === false ? '否' : '是' }}</template>
                </el-table-column>
                <el-table-column prop="remark" label="说明" min-width="180" />
              </el-table>
            </section>

            <section class="detail-section">
              <h3>计算过程</h3>
              <el-table :data="stepRows" border size="small" empty-text="暂无步骤">
                <el-table-column label="步骤" width="170">
                  <template #default="{ row }">{{ stepLabel(row.step) }}</template>
                </el-table-column>
                <el-table-column label="口径" min-width="260">
                  <template #default="{ row }">
                    <div class="cell-stack">
                      <strong>{{ row.displayFormula || row.formula || '-' }}</strong>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="结果" width="140" align="right">
                  <template #default="{ row }">{{ formatValue(row.amount ?? row.result) }}</template>
                </el-table-column>
                <el-table-column label="说明" min-width="160">
                  <template #default="{ row }">{{ row.remark || row.error || row.sourceDescription || '-' }}</template>
                </el-table-column>
              </el-table>
            </section>
          </template>
          <el-empty v-else description="请选择左侧底稿条目" />
        </main>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchCostRunTraceDetail, fetchCostRunTraces } from '../api/costRunDetail'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  costRunNo: {
    type: String,
    default: '',
  },
  versionNo: {
    type: String,
    default: '',
  },
  initialTrace: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const loading = ref(false)
const detailLoading = ref(false)
const activeGroup = ref('PART_PRICE')
const traceRows = ref([])
const selectedId = ref(null)
const selectedDetail = ref(null)

const displayVersionNo = computed(() => props.versionNo || selectedDetail.value?.versionNo || '-')
const groupedRows = computed(() => {
  const rows = traceRows.value || []
  if (activeGroup.value === 'PART_PRICE') {
    return rows.filter((row) => row.traceType === 'PART_PRICE')
  }
  return rows.filter((row) => row.traceType === 'COST_ITEM' || row.traceType === 'TOTAL')
})
const emptySnapshotVisible = computed(() => !loading.value && props.costRunNo && traceRows.value.length === 0)
const detailTitle = computed(() =>
  selectedDetail.value?.materialName
  || selectedDetail.value?.materialCode
  || selectedDetail.value?.costName
  || selectedDetail.value?.costCode
  || '-'
)
const parsedDetail = computed(() => ({
  sourceSnapshot: parseJson(selectedDetail.value?.sourceSnapshotJson),
  formulaSnapshot: parseJson(selectedDetail.value?.formulaSnapshotJson),
  variables: parseJson(selectedDetail.value?.variablesJson),
  steps: parseJson(selectedDetail.value?.stepsJson),
  children: parseJson(selectedDetail.value?.childrenJson),
}))
const isMakePartTrace = computed(() => selectedDetail.value?.sourceType === 'MAKE_PART')
const isLinkedTrace = computed(() => selectedDetail.value?.sourceType === 'LINKED_PRICE')
const isFixedTrace = computed(() => selectedDetail.value?.sourceType === 'FIXED_PRICE')
const isSettleFixedTrace = computed(() => selectedDetail.value?.sourceType === 'SETTLE_FIXED_PRICE')
const isRangeTrace = computed(() => selectedDetail.value?.sourceType === 'RANGE_PRICE')
const conclusionRows = computed(() => {
  const source = parsedDetail.value.sourceSnapshot || {}
  const prepare = source.pricePrepareItem || {}
  const make = source.makePartCalc || {}
  const linked = source.linkedCalcItem || {}
  return {
    priceSource: selectedDetail.value?.sourceType || prepare.priceSource || selectedDetail.value?.sourceType || '',
    batchNo: make.calcBatchId || linked.adjustBatchId || prepare.prepareNo || selectedDetail.value?.sourceBatchNo || '',
    prepareNo: prepare.prepareNo || '',
    periodMonth: prepare.periodMonth || make.pricingMonth || linked.pricingMonth || selectedDetail.value?.pricingMonth || '',
  }
})
const formulaCard = computed(() => {
  const formula = parsedDetail.value.formulaSnapshot || {}
  if (isMakePartTrace.value) {
    return {
      displayFormula: '部品金额 = 自制件最终单价 × BOM 用量',
      lines: [
        `自制件最终单价 = Σ 制造件明细行成本 = ${formatValue(parsedDetail.value.variables?.rowCostSum ?? selectedDetail.value?.unitPrice)}`,
        `本次金额 = ${formatValue(selectedDetail.value?.unitPrice)} × ${formatValue(selectedDetail.value?.quantity)} = ${formatValue(selectedDetail.value?.amount)}`,
        '原材料加工行成本 = 下料重量(kg) × 材料价格 - 废料重量(kg) × 回收单价 + 外加工费(如有)',
        '毛坯加工行成本 = 毛坯价格 - 废料重量(kg) × 回收单价 + 外加工费(如有)',
      ],
    }
  }
  if (isLinkedTrace.value) {
    return {
      displayFormula: formula.displayFormula || formula.formulaText || '联动价 = 公式变量代入计算结果',
      lines: [
        formula.formula ? `公式：${formula.formula}` : '',
        formula.evalResult !== undefined ? `公式结果：${formatValue(formula.evalResult)}` : '',
        `部品金额 = ${formatValue(formula.finalUnitPrice ?? selectedDetail.value?.unitPrice)} × ${formatValue(formula.quantity ?? selectedDetail.value?.quantity)} = ${formatValue(formula.amount ?? selectedDetail.value?.amount)}`,
      ].filter(Boolean),
    }
  }
  return {
    displayFormula: formula.displayFormula || formula.formulaText || formula.formula || '-',
    lines: [
      formula.formula ? `公式：${formula.formula}` : '',
      formula.matchRange ? `命中区间：${formula.matchRange}` : '',
      formula.priceField ? `价格字段：${priceFieldLabel(formula.priceField)}` : '',
      formula.unitNote || '',
    ].filter(Boolean),
  }
})
const priceLineTitle = computed(() => {
  if (isSettleFixedTrace.value) return '结算固定价命中行'
  if (isFixedTrace.value) return '固定价格表命中行'
  if (isRangeTrace.value) return '区间价命中行'
  return '价格命中行'
})
const priceLineRows = computed(() => {
  const source = parsedDetail.value.sourceSnapshot || {}
  if (isFixedTrace.value || isSettleFixedTrace.value) {
    return normalizeFixedPriceLine(source.fixedPriceItem || {})
  }
  if (isRangeTrace.value) {
    return normalizeRangePriceLine(source.rangePriceItem || {})
  }
  return []
})
const variableRows = computed(() => normalizeVariables(parsedDetail.value.variables))
const stepRows = computed(() => normalizeRows(parsedDetail.value.steps))
const childRows = computed(() => normalizeRows(parsedDetail.value.children))
const childSectionTitle = computed(() => {
  if (isMakePartTrace.value) return '自制件最终单价明细'
  if (selectedDetail.value?.traceType === 'TOTAL') return '总成本组成'
  return '组成明细'
})
const financeSummaryText = computed(() => {
  if (isMakePartTrace.value) {
    return `该部品为自制件，取制造件价格生成后的最终单价，再按 BOM 用量计算本次金额。`
  }
  if (isLinkedTrace.value) {
    return `该部品为采购件，取联动价公式计算后的单价，再按 BOM 用量计算本次金额。`
  }
  if (selectedDetail.value?.traceType === 'PART_PRICE' && selectedDetail.value?.sourceType === 'FIXED_PRICE') {
    return `该部品为采购件，取固定价格表中的固定采购价作为单价，再按 BOM 用量计算本次金额。`
  }
  if (selectedDetail.value?.traceType === 'PART_PRICE' && selectedDetail.value?.sourceType === 'SETTLE_FIXED_PRICE') {
    return `该部品为采购件，取结算固定价表中的结算价作为单价，再按 BOM 用量计算本次金额。`
  }
  if (selectedDetail.value?.traceType === 'PART_PRICE' && selectedDetail.value?.sourceType === 'RANGE_PRICE') {
    return `该部品为采购件，按 BOM 用量命中区间价区间，取该区间单价，再计算本次金额。`
  }
  if (selectedDetail.value?.traceType === 'PART_PRICE' && selectedDetail.value?.sourceType === 'PACKAGE_COMPONENT') {
    return `该部品为包装组件，按包装组件规则汇总价格，再按 BOM 用量计算本次金额。`
  }
  return selectedDetail.value?.summary || ''
})

watch(
  () => props.costRunNo,
  async () => {
    traceRows.value = []
    selectedId.value = null
    selectedDetail.value = null
    if (visible.value) {
      await loadTraces()
    }
  },
)

watch(
  () => props.initialTrace,
  async () => {
    if (!visible.value || traceRows.value.length === 0) return
    const matched = findInitialTrace(traceRows.value, props.initialTrace)
    if (matched && matched.id !== selectedId.value) {
      activeGroup.value = matched.traceType === 'PART_PRICE' ? 'PART_PRICE' : 'COST'
      await selectTrace(matched)
    } else if (!matched && hasTraceSelector(props.initialTrace)) {
      activeGroup.value = traceGroup(props.initialTrace)
      selectedId.value = null
      selectedDetail.value = null
      ElMessage.info('未找到对应底稿条目')
    }
  },
)

async function loadTraces() {
  if (!props.costRunNo) {
    ElMessage.info('当前成本版本缺少核算批次')
    return
  }
  loading.value = true
  selectedDetail.value = null
  try {
    const response = await fetchCostRunTraces(props.costRunNo)
    traceRows.value = Array.isArray(response?.records) ? response.records : []
    if (traceRows.value.length === 0) {
      ElMessage.info('该版本未生成底稿快照')
      return
    }
    const matched = findInitialTrace(traceRows.value, props.initialTrace)
    if (!matched && hasTraceSelector(props.initialTrace)) {
      activeGroup.value = traceGroup(props.initialTrace)
      ElMessage.info('未找到对应底稿条目')
      return
    }
    activeGroup.value = matched ? traceGroup(matched) : 'PART_PRICE'
    await selectTrace(matched || traceRows.value[0])
  } catch (error) {
    traceRows.value = []
    ElMessage.error(error?.message || '获取核算底稿失败')
  } finally {
    loading.value = false
  }
}

async function selectTrace(row) {
  if (!row?.id || !props.costRunNo) return
  selectedId.value = row.id
  detailLoading.value = true
  try {
    selectedDetail.value = await fetchCostRunTraceDetail(props.costRunNo, row.id)
  } catch (error) {
    ElMessage.error(error?.message || '获取底稿详情失败')
  } finally {
    detailLoading.value = false
  }
}

function findInitialTrace(rows, initial) {
  if (!initial) return null
  const partId = initial.partItemId == null ? null : String(initial.partItemId)
  const costId = initial.costItemId == null ? null : String(initial.costItemId)
  if (partId) {
    const row = rows.find((item) => String(item.partItemId || '') === partId)
    if (row) return row
  }
  if (costId) {
    const row = rows.find((item) => String(item.costItemId || '') === costId)
    if (row) return row
  }
  if (initial.costCode) {
    const row = rows.find((item) => item.costCode === initial.costCode)
    if (row) return row
  }
  if (initial.partCode) {
    const row = rows.find((item) => item.materialCode === initial.partCode)
    if (row) return row
  }
  if (hasTraceSelector(initial)) return null
  if (initial.traceType) {
    return rows.find((item) => item.traceType === initial.traceType) || null
  }
  return null
}

function hasTraceSelector(initial) {
  if (!initial) return false
  return initial.partItemId != null
    || initial.costItemId != null
    || Boolean(initial.costCode)
    || Boolean(initial.partCode)
    || Boolean(initial.partName)
    || Boolean(initial.expenseName)
}

function traceGroup(trace) {
  return trace?.traceType === 'PART_PRICE' ? 'PART_PRICE' : 'COST'
}

function traceTitle(row) {
  return row?.materialName || row?.materialCode || row?.costName || row?.costCode || '-'
}

function traceSubTitle(row) {
  return row?.materialCode || row?.costCode || row?.summary || row?.traceKey || '-'
}

function formatMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(6).replace(/\.?0+$/, '')
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return formatMoney(value)
  if (typeof value === 'string') {
    const number = Number(value)
    return Number.isFinite(number) && value.trim() !== '' ? formatMoney(number) : value
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  return JSON.stringify(value)
}

function formatRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(2)}%`
}

function traceCategoryLabel(type) {
  if (type === 'PART_PRICE') return '部品价格'
  if (type === 'COST_ITEM') return '费用项目'
  if (type === 'TOTAL') return '总成本'
  return type || '-'
}

function detailTypeAndMethodLabel(row) {
  if (!row) return '-'
  if (row.traceType !== 'PART_PRICE') return sourceTypeLabel(row.sourceType)
  return `${partCategoryLabel(row)} / ${priceMethodLabel(row.sourceType)}`
}

function partCategoryLabel(row) {
  if (!row) return '-'
  if (row.traceType !== 'PART_PRICE') return traceCategoryLabel(row.traceType)
  const type = row.sourceType
  if (type === 'MAKE_PART') return '自制件'
  if (type === 'PACKAGE_COMPONENT') return '包装组件'
  if (type === 'UNKNOWN_PRICE') return '采购件（价格来源未识别）'
  return '采购件'
}

function priceMethodLabel(type) {
  const labels = {
    MAKE_PART: '取自制件价格生成结果',
    LINKED_PRICE: '取联动价',
    FIXED_PRICE: '取固定价',
    SETTLE_FIXED_PRICE: '取结算固定价',
    RANGE_PRICE: '取区间价',
    PACKAGE_COMPONENT: '按包装组件汇总',
    ROLLUP: '汇总计算',
    CMS: '取 CMS 成本',
    RATE_CONFIG: '按费率配置计算',
    UNKNOWN_PRICE: '价格来源未识别',
  }
  return labels[type] || sourceTypeLabel(type)
}

function sourceTypeLabel(type) {
  const labels = {
    MAKE_PART: '自制件价格生成',
    LINKED_PRICE: '联动价',
    FIXED_PRICE: '固定采购价',
    SETTLE_FIXED_PRICE: '结算固定价',
    RANGE_PRICE: '区间价',
    PACKAGE_COMPONENT: '包装组件',
    ROLLUP: '汇总计算',
    CMS: 'CMS 来源',
    RATE_CONFIG: '费率配置',
    UNKNOWN_PRICE: '未识别价格来源',
  }
  return labels[type] || type || '-'
}

function stepLabel(step) {
  const labels = {
    MAKE_PART_ROW: '制造件明细行',
    MAKE_PART_FINAL_UNIT_PRICE: '汇总自制件单价',
    PART_AMOUNT: '计算部品金额',
    LINKED_FORMULA: '读取联动公式',
    LINKED_VARIABLES: '读取公式变量',
    LINKED_EVALUATE: '代入公式计算',
    FIXED_PRICE_ROW: '读取固定价格表',
    SETTLE_FIXED_PRICE_ROW: '读取结算固定价',
    RANGE_PRICE_ROW: '匹配区间价',
    WEIGHT_CONVERT: '重量换算',
    RAW_MATERIAL_AMOUNT: '计算原材料金额',
    BLANK_AMOUNT: '读取毛坯价格',
    SCRAP_DEDUCTION: '计算废料抵扣',
    CHILD_COST_PRICE: '计算明细行成本',
  }
  return labels[step] || step || '-'
}

function makePartRowFormula(row) {
  const outsourceText = Number(row?.outsourceFee || 0) === 0 ? '' : ' + 外加工费'
  if (row?.itemProcessType === '毛坯加工') {
    return `毛坯价格 - 废料重量(kg) × 回收单价${outsourceText}`
  }
  return `下料重量(kg) × 材料价格 - 废料重量(kg) × 回收单价${outsourceText}`
}

function makePartRowRemark(row) {
  const texts = []
  if (row?.rawPriceType) texts.push(`材料价：${priceTypeLabel(row.rawPriceType)}`)
  if (row?.scrapPriceType) texts.push(`废料价：${priceTypeLabel(row.scrapPriceType)}`)
  if (row?.noScrapConfirmed) texts.push('已确认无废料')
  if (row?.outsourceFee) texts.push(`外加工费 ${formatValue(row.outsourceFee)}`)
  if (row?.status && row.status !== 'SUCCESS') texts.push(row.status)
  return texts.join('；') || row?.remark || '-'
}

function priceTypeLabel(type) {
  const labels = {
    FIXED: '固定价',
    LINKED: '联动价',
    MONTHLY: '月度价',
    MANUAL: '手工确认',
    MAKE_PART: '自制件生成',
  }
  return labels[type] || type || '-'
}

function parseJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    return { raw: text, parseError: error?.message || 'JSON 解析失败' }
  }
}

function normalizeRows(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => (typeof item === 'object' ? item : { value: item }))
  }
  if (typeof value === 'object') return [value]
  return [{ value }]
}

function normalizeFixedPriceLine(row) {
  if (!row || Object.keys(row).length === 0) return []
  const rows = []
  pushVariable(rows, '价格表', '固定价格表', '')
  pushVariable(rows, '供应商', row.supplierName, '')
  pushVariable(rows, '物料编码', row.materialCode, '')
  pushVariable(rows, '物料名称', row.materialName, '')
  pushVariable(rows, '规格型号', row.specModel, '')
  pushVariable(rows, '固定价', row.fixedPrice, '')
  pushVariable(rows, '现不含税价格', row.currentTaxExcludedPrice, '')
  pushVariable(rows, '现含税价格', row.currentTaxIncludedPrice, '')
  pushVariable(rows, '计划价', row.plannedPrice, '')
  pushVariable(rows, '上浮比例', row.markupRatio, '')
  pushVariable(rows, '结算价列名', row.settleReferenceHeader, '')
  pushVariable(rows, '结算价列值', row.settleReferencePrice, '')
  pushVariable(rows, '生效日期', row.effectiveFrom, '')
  pushVariable(rows, '失效日期', row.effectiveTo, '')
  pushVariable(rows, '流程/单据', row.processNo || row.srmDocNo, '')
  return rows
}

function normalizeRangePriceLine(row) {
  if (!row || Object.keys(row).length === 0) return []
  const rows = []
  pushVariable(rows, '价格表', '区间价表', '')
  pushVariable(rows, '供应商', row.supplierName, '')
  pushVariable(rows, '物料编码', row.materialCode, '')
  pushVariable(rows, '物料名称', row.materialName, '')
  pushVariable(rows, '规格型号', row.specModel, '')
  pushVariable(rows, '区间下限', row.rangeLow, '')
  pushVariable(rows, '区间上限', row.rangeHigh, '')
  pushVariable(rows, '不含税单价', row.priceExclTax, '')
  pushVariable(rows, '含税单价', row.priceInclTax, '')
  pushVariable(rows, '生效日期', row.effectiveFrom, '')
  pushVariable(rows, '失效日期', row.effectiveTo, '')
  return rows
}

function normalizeVariables(value) {
  if (!value) return []
  if (isMakePartTrace.value) return normalizeMakePartVariables(value)
  if (Array.isArray(value)) return normalizeVariableArray(value)
  if (Array.isArray(value.variables)) return normalizeVariableArray(value.variables)

  const rows = []
  if (value.variables && typeof value.variables === 'object') {
    Object.entries(value.variables).forEach(([key, item]) => {
      rows.push({ label: key, value: item, source: value.source || '-' })
    })
  }
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'variables' || key === 'makePartRows' || key === 'remark') return
    if (item === null || item === undefined || Array.isArray(item) || typeof item === 'object') return
    rows.push({ label: variableLabel(key), value: item, source: variableSource(key) })
  })
  return rows
}

function normalizeMakePartVariables(value) {
  const rows = []
  pushVariable(rows, '自制件最终单价', value.makePartFinalUnitPrice ?? selectedDetail.value?.unitPrice, '制造件生成快照')
  pushVariable(rows, 'BOM 用量', value.bomQuantity ?? selectedDetail.value?.quantity, '报价 BOM 快照')
  pushVariable(rows, '本次金额', value.amount ?? selectedDetail.value?.amount, '核算结果')
  pushVariable(rows, '明细行数', value.rowCount, '制造件生成快照')
  pushVariable(rows, '明细成本合计', value.rowCostSum, '制造件生成快照')
  pushVariable(rows, '父件总成本价', value.parentTotalCostPrice, '制造件生成快照')
  pushVariable(rows, '生成批次', value.calcBatchId, '制造件生成快照')
  return rows
}

function pushVariable(rows, label, value, source) {
  if (value === null || value === undefined || value === '') return
  rows.push({ label, value, source })
}

function normalizeVariableArray(rows) {
  return rows.filter(Boolean).map((row) => ({
    label: row.label || row.name || row.variableName || row.code || row.variable || '-',
    code: row.code || row.name || row.variable || '-',
    value: row.value ?? row.amount ?? row.result,
    source: variableSourceLabel(row.source || row.sourceType || row.remark),
  }))
}

function variableLabel(key) {
  const labels = {
    unitPrice: '单价',
    finalUnitPrice: '最终单价',
    makePartFinalUnitPrice: '自制件最终单价',
    quantity: 'BOM 用量',
    bomQuantity: 'BOM 用量',
    amount: '金额',
    baseAmount: '基数',
    rate: '费率',
    priceKind: '价格类型',
    materialCode: '物料编码',
    fixedPrice: '固定价',
    supplierName: '供应商',
    effectiveFrom: '生效日期',
    effectiveTo: '失效日期',
    pricingMonth: '价格月份',
    plannedPrice: '计划价',
    markupRatio: '上浮比例',
    settleReferenceHeader: '结算价列名',
    settleReferencePrice: '结算价列值',
    matchQuantity: '匹配数量',
    rangeLow: '区间下限',
    rangeHigh: '区间上限',
    priceExclTax: '不含税单价',
    priceInclTax: '含税单价',
    rangeUnitPrice: '区间单价',
    rowCostSum: '明细行成本合计',
    parentTotalCostPrice: '父件总成本价',
    calcBatchId: '生成批次',
    rowCount: '明细行数',
    blankWeight: '下料/毛坯重量',
    netWeight: '净重',
    processFee: '加工费',
    agentFee: '代理费',
    rawUnitPrice: '原材料价',
    scrapUnitPrice: '废料价',
    scrapWeightKg: '废料重(kg)',
    costPrice: '明细行成本',
  }
  return labels[key] || key
}

function variableSource(key) {
  if (key.includes('Weight') || key.includes('weight')) return '重量快照'
  if (key.includes('Price') || key.includes('price')) return '价格快照'
  if (key.includes('rate') || key.includes('Rate')) return '费率快照'
  if (key === 'calcBatchId' || key === 'rowCount') return '制造件生成快照'
  return '核算快照'
}

function variableSourceLabel(source) {
  const labels = {
    FINANCE_FACTOR: '财务基价/影响因素',
    MONTHLY_FACTOR: '月度影响因素',
    PART_CONTEXT: '部品行参数',
    OA_LOCKED: '报价单锁价',
    PRICE_PREPARE: '价格准备结果',
    MAKE_PART: '制造件生成快照',
    LINKED_PRICE: '联动价计算结果',
    FIXED_PRICE: '固定采购价',
    COST_RUN: '核算快照',
  }
  return labels[source] || source || '-'
}

function priceFieldLabel(field) {
  const labels = {
    fixed_price: '固定价',
    price_incl_tax: '含税单价',
    price_excl_tax: '不含税单价',
  }
  return labels[field] || field || '-'
}

</script>

<style scoped>
.trace-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}

.trace-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e5eaf3;
  background: #fafbfe;
}

.trace-head strong {
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.trace-head span {
  color: #697386;
  font-size: 12px;
}

.trace-body {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 12px;
  min-height: 620px;
}

.trace-list {
  min-width: 0;
  border: 1px solid #e5eaf3;
  background: #fff;
}

.trace-scroll {
  height: 560px;
}

.trace-row {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid #edf1f7;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
  text-align: left;
}

.trace-row.active {
  background: #ecf5ff;
  box-shadow: inset 3px 0 0 #409eff;
}

.trace-row-title,
.trace-row-sub,
.trace-row-amount {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-row-title {
  font-size: 13px;
  font-weight: 650;
}

.trace-row-sub {
  margin-top: 4px;
  color: #697386;
  font-size: 12px;
}

.trace-row-amount {
  margin-top: 6px;
  color: #303133;
  font-size: 12px;
}

.trace-detail {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5eaf3;
  background: #fff;
  overflow: auto;
}

.detail-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-title strong,
.detail-title span {
  display: block;
}

.detail-title strong {
  color: #1f2937;
  font-size: 16px;
  font-weight: 650;
}

.detail-title span {
  margin-top: 4px;
  color: #697386;
  font-size: 12px;
}

.detail-section {
  margin-top: 14px;
}

.detail-section h3 {
  margin: 0 0 8px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.detail-section h4 {
  margin: 10px 0 6px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 650;
}

.finance-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.finance-summary div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5eaf3;
  background: #fafbfe;
}

.finance-summary .wide {
  grid-column: span 2;
}

.finance-summary span {
  display: block;
  margin-bottom: 4px;
  color: #697386;
  font-size: 12px;
}

.finance-summary strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.plain-note {
  padding: 10px 12px;
  border: 1px solid #e5eaf3;
  background: #fff;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.formula-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid #d8e0ec;
  background: #f8fafc;
  color: #1f2937;
  line-height: 1.6;
  word-break: break-word;
}

.formula-card strong {
  font-size: 14px;
  font-weight: 650;
}

.formula-card span {
  color: #697386;
  font-size: 12px;
}

.cell-stack {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  word-break: break-word;
}

.cell-stack strong {
  color: #1f2937;
  font-weight: 650;
}

.cell-stack span {
  color: #697386;
  font-size: 12px;
}

@media (max-width: 860px) {
  .trace-body {
    grid-template-columns: 1fr;
  }

  .finance-summary {
    grid-template-columns: 1fr;
  }

  .finance-summary .wide {
    grid-column: auto;
  }

  .trace-scroll {
    height: 260px;
  }
}
</style>
