<template>
  <div class="linked-result">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">
          联动价格表
          <!-- T6：顶部徽章 —— 行局部绑定待确认数量 -->
          <el-tag
            v-if="pendingTotal > 0"
            class="filter-badge"
            type="danger"
            effect="light"
            @click="openPendingList"
          >
            待绑定 {{ pendingTotal }} 🔴
          </el-tag>
          <el-tag
            v-else-if="pendingLoaded"
            class="filter-badge"
            type="success"
            effect="light"
          >
            绑定已全部确认
          </el-tag>
        </div>
        <div class="filter-actions">
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".xlsx,.xls,.csv"
            :on-change="handleFileChange"
          >
            <el-button :loading="importing">导入</el-button>
          </el-upload>
          <!-- T6：绑定 CSV 导入 —— 与联动价导入分开，字段契约不同 -->
          <el-upload
            class="upload-btn"
            :show-file-list="false"
            :auto-upload="false"
            accept=".csv"
            :on-change="handleBindingCsvChange"
          >
            <el-button :loading="bindingImporting">绑定 CSV</el-button>
          </el-upload>
          <el-button type="primary" @click="openCreate">新增</el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="filters.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="filters.materialCode" placeholder="MAT-1001" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchList">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="derivedRows" stripe v-loading="loading">
        <el-table-column prop="orgCode" label="组织" width="90" />
        <el-table-column prop="sourceName" label="来源" width="120" />
        <el-table-column prop="supplierName" label="供应商名称" min-width="140" />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" />
        <el-table-column prop="purchaseClass" label="采购分类" width="120" />
        <el-table-column prop="materialName" label="物料名称" min-width="140" />
        <el-table-column prop="materialCode" label="物料代码" width="140" />
        <el-table-column label="联动公式" min-width="260">
          <template #default="{ row }">
            <div class="expr-primary">{{ row.formulaExpr }}</div>
            <!-- V36 起：后端 FormulaDisplayRenderer 已派生 formulaExprCn（认得
                 __material/__scrap 占位符）；优先展示后端派生值，客户端
                 toChineseExpr 仅作为兜底（离线模式/旧 DTO 缺字段时）。 -->
            <div class="expr-secondary">
              {{ row.formulaExprCn || toChineseExpr(row.formulaExpr, formulaIndex) }}
            </div>
            <div v-if="row.formulaIssue" class="expr-issue">
              缺少: {{ row.formulaIssue }}
            </div>
            <!-- 方案 A：后端 toDto 跑过 FormulaNormalizer，坏公式行级标红 -->
            <div v-if="row.formulaValid === false" class="expr-issue">
              ⚠️ 公式语法错误：{{ row.formulaError }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="specModel" label="规格型号" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="blankWeight" label="下料量" width="110" />
        <el-table-column prop="netWeight" label="净重" width="110" />
        <el-table-column prop="processFee" label="加工费" width="110" />
        <el-table-column prop="agentFee" label="代理费" width="110" />
        <!-- T24：Excel 金标 = 人工录入的单价，用作对照 -->
        <el-table-column prop="manualPrice" label="Excel 金标" width="120">
          <template #default="{ row }">
            <span v-if="row.manualPrice !== null && row.manualPrice !== ''">
              {{ formatNumber(row.manualPrice) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <!-- T24：系统结果 = 客户端按 formulaExpr 计算出的 calcPrice -->
        <el-table-column label="系统结果" width="120">
          <template #default="{ row }">
            <span v-if="row.calcPrice !== null">
              {{ formatNumber(row.calcPrice) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <!-- T24：差异 = |系统结果 - Excel 金标|，> 0.01 时红色高亮 -->
        <el-table-column label="差异" width="110">
          <template #default="{ row }">
            <span
              v-if="row.diffValue !== null"
              :class="{ 'diff-exceeds': row.diffExceeds }"
            >
              {{ formatNumber(row.diffValue) }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="是否含税" width="100">
          <template #default="{ row }">
            {{ row.taxIncluded ? '含税' : '未税' }}
          </template>
        </el-table-column>
        <el-table-column prop="effectiveFrom" label="生效日期" width="120" />
        <el-table-column prop="effectiveTo" label="失效日期" width="120" />
        <el-table-column prop="orderType" label="订单类型" width="120" />
        <el-table-column prop="quota" label="配额" width="100" />
        <el-table-column prop="pricingMonth" label="月份" width="110" />
        <el-table-column prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditRow(row)">
              编辑
            </el-button>
            <el-button type="primary" link @click="openFormulaEditor(row)">
              公式
            </el-button>
            <!-- T24：查看 trace —— 打开右侧抽屉展示计算追踪 -->
            <el-button type="primary" link @click="openTrace(row)">
              查看 Trace
            </el-button>
            <!-- T6：行局部变量绑定 —— 打开抽屉管理 B 组 token → 影响因素 的映射 -->
            <el-button type="primary" link @click="openBinding(row)">
              变量绑定
              <el-badge
                v-if="row.unbound"
                is-dot
                class="binding-dot"
                type="danger"
              />
            </el-button>
            <el-button type="danger" link @click="removeRow(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px">
      <el-form :model="formModel" label-width="90px">
        <el-form-item label="价格月份">
          <el-date-picker
            v-model="formModel.pricingMonth"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </el-form-item>
        <el-form-item label="组织">
          <el-input v-model="formModel.orgCode" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="formModel.sourceName" />
        </el-form-item>
        <el-form-item label="供应商名称">
          <el-input v-model="formModel.supplierName" />
        </el-form-item>
        <el-form-item label="供应商代码">
          <el-input v-model="formModel.supplierCode" />
        </el-form-item>
        <el-form-item label="采购分类">
          <el-input v-model="formModel.purchaseClass" />
        </el-form-item>
        <el-form-item label="物料名称">
          <el-input v-model="formModel.materialName" />
        </el-form-item>
        <el-form-item label="物料代码">
          <el-input v-model="formModel.materialCode" />
        </el-form-item>
        <el-form-item label="规格型号">
          <el-input v-model="formModel.specModel" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formModel.unit" />
        </el-form-item>
        <el-form-item label="联动公式">
          <el-input
            v-model="formModel.formulaExpr"
            type="textarea"
            :rows="3"
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <el-form-item label="中文说明">
          <el-input
            :model-value="formulaPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="下料量">
          <el-input v-model="formModel.blankWeight" />
        </el-form-item>
        <el-form-item label="净重">
          <el-input v-model="formModel.netWeight" />
        </el-form-item>
        <el-form-item label="加工费">
          <el-input v-model="formModel.processFee" />
        </el-form-item>
        <el-form-item label="代理费">
          <el-input v-model="formModel.agentFee" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input v-model="formModel.manualPrice" />
        </el-form-item>
        <el-form-item label="是否含税">
          <el-select v-model="formModel.taxIncluded" placeholder="选择">
            <el-option label="含税" :value="true" />
            <el-option label="未税" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="formModel.effectiveFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="失效日期">
          <el-date-picker
            v-model="formModel.effectiveTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-input v-model="formModel.orderType" />
        </el-form-item>
        <el-form-item label="配额">
          <el-input v-model="formModel.quota" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRow">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="formulaDialogVisible" title="编辑联动公式" width="640px">
      <div class="formula-meta" v-if="formulaRow">
        <span>物料代码: {{ formulaRow.materialCode }}</span>
        <span>规格型号: {{ formulaRow.specModel || '-' }}</span>
      </div>
      <el-form :model="formulaModel" label-width="90px">
        <el-form-item label="中文公式">
          <el-input
            v-model="formulaModel.formulaExprCn"
            type="textarea"
            :rows="3"
            placeholder="例如 (铜基价*0.59+锌基价*0.41)*下料量+加工费"
          />
        </el-form-item>
        <el-form-item label="表达式(编码)">
          <el-input
            v-model="formulaModel.formulaExpr"
            type="textarea"
            :rows="3"
            readonly
            placeholder="例如 (Cu*0.59*1.02+Zn*0.41*1.03+1.45)*blank_weight+process_fee+agent_fee"
          />
        </el-form-item>
        <div v-if="formulaConvertWarning" class="formula-warning">
          {{ formulaConvertWarning }}
        </div>
        <el-form-item label="中文预览">
          <el-input
            :model-value="formulaEditorPreview"
            type="textarea"
            :rows="2"
            readonly
          />
        </el-form-item>
        <el-form-item label="变量">
          <div class="formula-vars">
            <el-tag
              v-for="item in formulaVarOptions"
              :key="item.code"
              class="formula-var-tag"
              @click="appendVariable(item.code)"
            >
              {{ item.label }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formulaDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFormula">保存</el-button>
      </template>
    </el-dialog>

    <!-- T24：trace 抽屉 —— 展示后端 /items/{id}/trace 返回的结构化计算追踪 -->
    <el-drawer
      v-model="traceDrawerVisible"
      title="计算追踪 Trace"
      direction="rtl"
      size="520px"
    >
      <div v-loading="traceLoading" class="trace-drawer">
        <!-- 顶部基础信息：row id + 物料 -->
        <div v-if="traceRow" class="trace-header">
          <div><span class="trace-label">记录 ID</span>{{ traceRow.id }}</div>
          <div>
            <span class="trace-label">物料</span>{{ traceRow.materialCode || '-' }}
          </div>
          <div>
            <span class="trace-label">价格月份</span>{{ traceRow.pricingMonth || '-' }}
          </div>
        </div>

        <!-- 无 trace 或解析失败的降级展示 -->
        <el-alert
          v-if="traceError"
          type="info"
          :closable="false"
          :title="traceError"
          class="trace-empty"
        />

        <!-- 规范化 / 变量 / 求值 / 错误 四段时间轴 -->
        <el-timeline v-if="traceSteps.length > 0" class="trace-timeline">
          <el-timeline-item
            v-for="(step, index) in traceSteps"
            :key="index"
            :type="step.step === 'error' ? 'danger' : 'primary'"
            :timestamp="step.title"
            placement="top"
          >
            <!-- normalize：原始表达式 → 规范化表达式 -->
            <div v-if="step.step === 'normalize'" class="trace-block">
              <div class="trace-row">
                <span class="trace-label">原始</span>
                <code>{{ step.rawExpr || '-' }}</code>
              </div>
              <div class="trace-row">
                <span class="trace-label">规范化</span>
                <code>{{ step.normalizedExpr || '-' }}</code>
              </div>
            </div>

            <!-- resolve：变量赋值列表 -->
            <div v-else-if="step.step === 'resolve'" class="trace-block">
              <el-table
                :data="step.variables"
                size="small"
                border
                stripe
                class="trace-vars-table"
              >
                <el-table-column prop="code" label="变量" width="180" />
                <el-table-column prop="value" label="取值" />
              </el-table>
            </div>

            <!-- evaluate：系统结果 + legacy 对照 + diff -->
            <div v-else-if="step.step === 'evaluate'" class="trace-block">
              <div class="trace-row">
                <span class="trace-label">结果</span>
                <strong>{{ step.result ?? '-' }}</strong>
              </div>
              <div v-if="step.legacyResult !== null" class="trace-row">
                <span class="trace-label">Legacy</span>
                <span>{{ step.legacyResult }}</span>
              </div>
              <div v-if="step.diff !== null" class="trace-row">
                <span class="trace-label">Diff</span>
                <span>{{ step.diff }}</span>
              </div>
              <div v-if="step.mode" class="trace-row">
                <span class="trace-label">模式</span>
                <el-tag size="small">{{ step.mode }}</el-tag>
              </div>
            </div>

            <!-- error：致命错误 -->
            <div v-else-if="step.step === 'error'" class="trace-block">
              <el-alert
                type="error"
                :closable="false"
                :title="step.error"
              />
            </div>
          </el-timeline-item>
        </el-timeline>

        <!-- 原始 JSON（折叠） -->
        <div v-if="traceRaw" class="trace-raw">
          <el-button link type="primary" @click="traceRawVisible = !traceRawVisible">
            {{ traceRawVisible ? '收起原始 JSON' : '展开原始 JSON' }}
          </el-button>
          <pre v-if="traceRawVisible" class="trace-raw-pre">{{
            JSON.stringify(traceRaw, null, 2)
          }}</pre>
        </div>
      </div>
    </el-drawer>

    <!-- T6：行局部变量绑定 —— 抽屉组件，表格行"变量绑定"按钮触发 -->
    <PriceLinkedBindingDrawer
      v-model:visible="bindingDrawerVisible"
      :row="bindingRow"
      @changed="onBindingChanged"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchLinkedItems,
  createLinkedItem,
  updateLinkedItem,
  deleteLinkedItem,
  importLinkedItems,
  fetchTrace,
  previewFormula,
} from '../api/priceLinkedItems'
import { formulaVariables, toChineseExpr, toCodeExpr, buildFormulaIndex } from '../utils/formula'
import { fetchPriceVariables, fetchRowLocalPlaceholders } from '../api/priceVariables'
// T6：行局部变量绑定 —— pending 徽章 + CSV 导入 + drawer
import {
  fetchPending,
  importBindings,
} from '../api/priceLinkedBindings'
import PriceLinkedBindingDrawer from '../components/PriceLinkedBindingDrawer.vue'
// T24：trace drawer + 系统结果/Excel 金标/差异 所需的纯函数辅助层
import {
  DIFF_THRESHOLD,
  buildTraceTimeline,
  diffWithGolden,
  parseTraceJson,
} from './priceLinkedResultUtils'

const loading = ref(false)
const tableRows = ref([])
// 系统结果来自后端 /items/{id}/trace —— key=row.id，value={calcPrice, error, variables}
// Plan B 改造后公式以 [code] 形式入库，JS new Function 无法解析 [xx] 语法（会被当数组字面量导致默默算错），
// 所以不再客户端本地 eval，改为 fetchList 后并行拉 trace 展示后端口径的计算结果。
const rowTraceMap = ref({})
const rowTraceLoading = ref(false)
const dialogVisible = ref(false)
const importing = ref(false)
const editingId = ref(null)
const formulaDialogVisible = ref(false)
const formulaEditingId = ref(null)
const formulaRow = ref(null)
// T-sanity：打开编辑器时快照的"旧 formulaExpr"，用于提交时与新公式对比影响幅度
const originalFormulaExpr = ref('')

// T24：trace drawer 状态 —— 展示 /items/{id}/trace 的结构化内容
const traceDrawerVisible = ref(false)
const traceLoading = ref(false)
const traceRow = ref(null)
const traceRaw = ref(null)
const traceError = ref('')
const traceSteps = ref([])
const traceRawVisible = ref(false)

// T6：行局部变量绑定相关状态
// pendingTotal —— 顶部徽章展示的"待绑定"联动行总数
// pendingItemIds —— Set<linkedItemId>，用于给表格行标一个红点
// pendingLoaded —— 首次拉取完成标记，避免把"加载中"误判为"已全部确认"
const pendingTotal = ref(0)
const pendingItemIds = ref(new Set())
const pendingLoaded = ref(false)
const bindingImporting = ref(false)
const bindingDrawerVisible = ref(false)
const bindingRow = ref(null)

const formModel = ref({
  pricingMonth: '',
  orgCode: '',
  sourceName: '',
  supplierName: '',
  supplierCode: '',
  purchaseClass: '',
  materialName: '',
  materialCode: '',
  specModel: '',
  unit: '',
  formulaExpr: '',
  blankWeight: '',
  netWeight: '',
  processFee: '',
  agentFee: '',
  manualPrice: '',
  taxIncluded: true,
  effectiveFrom: '',
  effectiveTo: '',
  orderType: '',
  quota: '',
})

const formulaModel = ref({
  formulaExpr: '',
  formulaExprCn: '',
})

// V36 统一索引：同时覆盖变量 codeToName 和反向 aliasToCode（含行局部占位符）。
// 两个函数 toChineseExpr / toCodeExpr 都接受 index 对象作为第二参数。
// 页面历史用 variableMap.value（扁平 code→name）给旧的"变量选项列表"等场景展示，
// 保留以免影响未迁移的下游逻辑；新代码应优先用 formulaIndex。
const formulaIndex = ref(buildFormulaIndex({ variables: [], placeholders: [] }))
const variableMap = ref({ ...formulaVariables })
const variableList = ref([])

const dialogTitle = computed(() =>
  editingId.value ? '编辑联动价' : '新增联动价',
)

const formulaPreview = computed(() =>
  toChineseExpr(formModel.value.formulaExpr, formulaIndex.value),
)
const formulaEditorPreview = computed(() =>
  toChineseExpr(formulaModel.value.formulaExpr, formulaIndex.value),
)

const normalizeFormulaExpr = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return { formulaExpr: '', formulaExprCn: '' }
  }
  const formulaExpr = toCodeExpr(trimmed, formulaIndex.value)
  return {
    formulaExpr,
    formulaExprCn: toChineseExpr(formulaExpr, formulaIndex.value),
  }
}

const formulaVarOptions = computed(() =>
  Object.entries(formulaIndex.value).map(([code, label]) => ({
    code,
    name: label,
    label: `${label}(${code})`,
  })),
)

const formulaConvertWarning = computed(() => {
  const encoded = formulaModel.value.formulaExpr || ''
  return /[\u4e00-\u9fa5]/.test(encoded)
    ? '编码表达式含未识别中文变量，请补充变量映射'
    : ''
})

const filters = ref({
  pricingMonth: '',
  materialCode: '',
})

const buildParams = () => ({
  pricingMonth: filters.value.pricingMonth,
  materialCode: filters.value.materialCode?.trim(),
})

const fetchList = async () => {
  loading.value = true
  try {
    const data = await fetchLinkedItems(buildParams())
    tableRows.value = Array.isArray(data) ? data : []
    if (!filters.value.pricingMonth && tableRows.value.length > 0) {
      filters.value.pricingMonth = tableRows.value[0].pricingMonth || ''
    }
  } catch (error) {
    ElMessage.error(error?.message || '获取联动价失败')
  } finally {
    loading.value = false
  }
  // 列表刷完后异步批量拉 trace —— 不阻塞主表渲染，后端算好再填"系统结果"列
  loadRowTraces()
}

/**
 * 并行拉所有含公式行的 trace —— 后端 /items/{id}/trace 返回规范公式真实解析结果。
 * 放弃了之前客户端 new Function eval 的路径（Plan B 改成 [code] 后 JS 把它当数组字面量，
 * 数值结果会被 `+[...]` 静默转成字符串，最终显示"-"）。
 * 失败行写入 error，UI 上会变红提示，不中断其他行。
 */
const loadRowTraces = async () => {
  const rows = tableRows.value.filter((r) => r?.id && r?.formulaExpr)
  if (rows.length === 0) {
    rowTraceMap.value = {}
    return
  }
  rowTraceLoading.value = true
  const next = {}
  await Promise.all(
    rows.map(async (row) => {
      try {
        const resp = await fetchTrace(row.id)
        const parsed = parseTraceJson(resp?.traceJson)
        if (!parsed) {
          next[row.id] = { calcPrice: null, error: '', variables: {} }
          return
        }
        next[row.id] = {
          calcPrice: parsed.result != null ? Number(parsed.result) : null,
          error: parsed.error || '',
          variables: parsed.variables || {},
        }
      } catch (error) {
        next[row.id] = {
          calcPrice: null,
          error: error?.message || '',
          variables: {},
        }
      }
    }),
  )
  rowTraceMap.value = next
  rowTraceLoading.value = false
}

const fetchVariables = async () => {
  try {
    // V36：并行拉变量 + 行局部占位符，合并成 formulaIndex
    const [variables, placeholders] = await Promise.all([
      fetchPriceVariables({ status: 'active' }),
      fetchRowLocalPlaceholders().catch((err) => {
        // 占位符接口在部分老后端不存在，降级为空数组（兜底只走变量）
        console.warn('fetchRowLocalPlaceholders failed, fallback empty:', err?.message)
        return []
      }),
    ])
    variableList.value = Array.isArray(variables) ? variables : []
    const placeholderList = Array.isArray(placeholders) ? placeholders : []

    // 统一索引 —— codeToName / aliasToCode 一次构建，后续 toChineseExpr/toCodeExpr 都用它
    formulaIndex.value = buildFormulaIndex({
      variables: variableList.value,
      placeholders: placeholderList,
    })
    // 兼容层：variableMap 仍作为 code→name 扁平 map 给"变量选择器"等现有 UI 用
    variableMap.value = { ...formulaIndex.value.codeToName }

    return variableMap.value
  } catch (error) {
    ElMessage.warning(error?.message || '获取变量列表失败')
    return variableMap.value
  }
}

const resetFilters = () => {
  filters.value = {
    pricingMonth: '',
    materialCode: '',
  }
  fetchList()
}

const openCreate = () => {
  editingId.value = null
  formModel.value = {
    pricingMonth: filters.value.pricingMonth,
    orgCode: '',
    sourceName: '',
    supplierName: '',
    supplierCode: '',
    purchaseClass: '',
    materialName: '',
    materialCode: '',
    specModel: '',
    unit: '',
    formulaExpr: '',
    blankWeight: '',
    netWeight: '',
    processFee: '',
    agentFee: '',
    manualPrice: '',
    taxIncluded: true,
    effectiveFrom: '',
    effectiveTo: '',
    orderType: '',
    quota: '',
  }
  dialogVisible.value = true
}

const openEditRow = (row) => {
  editingId.value = row.id
  formModel.value = {
    pricingMonth: row.pricingMonth,
    orgCode: row.orgCode,
    sourceName: row.sourceName,
    supplierName: row.supplierName,
    supplierCode: row.supplierCode,
    purchaseClass: row.purchaseClass,
    materialName: row.materialName,
    materialCode: row.materialCode,
    specModel: row.specModel,
    unit: row.unit,
    formulaExpr: row.formulaExpr || '',
    blankWeight: row.blankWeight ?? '',
    netWeight: row.netWeight ?? '',
    processFee: row.processFee ?? '',
    agentFee: row.agentFee ?? '',
    manualPrice: row.manualPrice ?? '',
    taxIncluded: row.taxIncluded === null ? true : !!row.taxIncluded,
    effectiveFrom: row.effectiveFrom || '',
    effectiveTo: row.effectiveTo || '',
    orderType: row.orderType,
    quota: row.quota ?? '',
  }
  dialogVisible.value = true
}

const openFormulaEditor = (row) => {
  formulaEditingId.value = row.id
  formulaRow.value = row
  const normalizedFormulaExpr = toCodeExpr(
    row.formulaExpr || '',
    formulaIndex.value,
  )
  const currentFormulaExprCn = row.formulaExprCn?.trim() || ''
  const resolvedFormulaExprCn =
    currentFormulaExprCn &&
    toCodeExpr(currentFormulaExprCn, formulaIndex.value) ===
      normalizedFormulaExpr
      ? currentFormulaExprCn
      : toChineseExpr(normalizedFormulaExpr, formulaIndex.value)
  formulaModel.value = {
    formulaExpr: normalizedFormulaExpr,
    formulaExprCn: resolvedFormulaExprCn,
  }
  // 快照旧公式 —— submitFormula 做"变更影响对比"用
  originalFormulaExpr.value = normalizedFormulaExpr
  formulaDialogVisible.value = true
}

const appendVariable = (code) => {
  const name = variableMap.value[code] || code
  const current = formulaModel.value.formulaExprCn || ''
  const suffix = current && !current.endsWith(' ') ? ' ' : ''
  formulaModel.value.formulaExprCn = `${current}${suffix}${name} `
}

/**
 * T-sanity：保存前变更影响预览
 * - 调用后端 preview 拿新公式结果；若有旧公式则并行拿旧结果做对比
 * - 触发确认对话框的两个条件（任一满足即弹）：
 *   1. 后端 warnings 非空（如"出现 /1000 疑似旧口径"）
 *   2. 结果变化幅度 > SANITY_DIFF_THRESHOLD（默认 5%）
 * - 首次建档（旧公式空）只校验 warnings，不做幅度对比
 * - preview 自身报错不阻断保存，给提示但允许继续
 */
const SANITY_DIFF_THRESHOLD = 0.05

const submitFormula = async () => {
  if (!formulaEditingId.value) {
    return
  }
  const newFormulaExpr = formulaModel.value.formulaExpr?.trim() || ''
  const oldFormulaExpr = originalFormulaExpr.value?.trim() || ''
  const payload = {
    formulaExpr: newFormulaExpr,
    formulaExprCn: formulaModel.value.formulaExprCn?.trim() || '',
  }
  if (!newFormulaExpr) {
    ElMessage.warning('公式不能为空')
    return
  }

  // === 保存前预览 + 影响对比 ===
  const row = formulaRow.value || {}
  const previewBody = {
    materialCode: row.materialCode || '',
    pricingMonth: row.pricingMonth || '',
    taxIncluded: row.taxIncluded ?? null,
  }
  let newPreview = null
  let oldPreview = null
  try {
    const tasks = [previewFormula({ ...previewBody, formulaExpr: newFormulaExpr })]
    if (oldFormulaExpr && oldFormulaExpr !== newFormulaExpr) {
      tasks.push(previewFormula({ ...previewBody, formulaExpr: oldFormulaExpr }))
    }
    const results = await Promise.all(tasks)
    newPreview = results[0]
    oldPreview = results[1] || null
  } catch (err) {
    // preview 本身失败不阻断保存，但提示用户
    ElMessage.warning('保存前预览失败：' + (err?.message || '未知错误') + '；将直接保存')
  }

  // 收集告警文案：后端 warnings + 前端算的幅度差
  const notices = []
  if (newPreview?.error) {
    notices.push(`⚠️ 新公式解析失败：${newPreview.error}`)
  }
  if (Array.isArray(newPreview?.warnings)) {
    for (const w of newPreview.warnings) {
      // 过滤掉纯上下文类提示，只留"公式本身的可疑写法"
      if (w && !/materialCode|未在 lp_price_linked_item/.test(w)) {
        notices.push(w)
      }
    }
  }

  const oldResult = toFiniteNumber(oldPreview?.result)
  const newResult = toFiniteNumber(newPreview?.result)
  let changePct = null
  if (
    oldFormulaExpr &&
    oldFormulaExpr !== newFormulaExpr &&
    oldResult != null &&
    newResult != null
  ) {
    const denom = Math.abs(oldResult)
    if (denom > 1e-9) {
      changePct = (newResult - oldResult) / denom
      if (Math.abs(changePct) > SANITY_DIFF_THRESHOLD) {
        notices.push(
          `⚠️ 本次改动会让系统结果从 ${formatNum(oldResult)} 变成 ${formatNum(newResult)}，` +
            `变化幅度 ${(changePct * 100).toFixed(1)}%，请确认。`,
        )
      }
    } else if (Math.abs(newResult) > 1e-9) {
      // 旧结果 ~0 而新结果非零 —— 也算显著变动
      notices.push(
        `⚠️ 原结果接近 0（${formatNum(oldResult)}），改动后变为 ${formatNum(newResult)}，请确认。`,
      )
    }
  }

  if (notices.length > 0) {
    try {
      await ElMessageBox.confirm(notices.join('\n\n'), '保存前确认', {
        confirmButtonText: '仍要保存',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false,
        customClass: 'formula-sanity-box',
      })
    } catch (_) {
      // 用户点取消 —— 不保存
      return
    }
  }

  try {
    const updated = await updateLinkedItem(formulaEditingId.value, payload)
    tableRows.value = tableRows.value.map((item) =>
      item.id === formulaEditingId.value ? updated : item,
    )
    ElMessage.success('公式已更新')
    formulaDialogVisible.value = false
    // 公式改了之后，"系统结果"列和"缺少:"红色提示都来自 rowTraceMap —— 必须重拉 trace，
    // 否则列表还显示旧公式的 calcPrice / error
    loadRowTraces()
  } catch (error) {
    ElMessage.error(error?.message || '公式保存失败')
  }
}

/** 兜底数字转换 —— 字符串 / BigDecimal 字面量 / null 都要处理 */
const toFiniteNumber = (v) => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 展示用格式化，保留 6 位（浮点尾数级别），去掉末尾 0 */
const formatNum = (n) => {
  if (n == null) return '-'
  const s = Number(n).toFixed(6)
  return s.replace(/\.?0+$/, '')
}

watch(
  [() => formulaModel.value.formulaExprCn, () => formulaIndex.value],
  ([value, index]) => {
    formulaModel.value.formulaExpr = toCodeExpr(value, index)
  },
  { immediate: true },
)

const toNumber = (value) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const submitRow = async () => {
  if (!formModel.value.pricingMonth || !formModel.value.materialCode) {
    ElMessage.warning('月份和物料代码必填')
    return
  }
  const normalizedFormula = normalizeFormulaExpr(formModel.value.formulaExpr)
  const payload = {
    pricingMonth: formModel.value.pricingMonth,
    orgCode: formModel.value.orgCode,
    sourceName: formModel.value.sourceName,
    supplierName: formModel.value.supplierName,
    supplierCode: formModel.value.supplierCode,
    purchaseClass: formModel.value.purchaseClass,
    materialName: formModel.value.materialName,
    materialCode: formModel.value.materialCode,
    specModel: formModel.value.specModel,
    unit: formModel.value.unit,
    formulaExpr: normalizedFormula.formulaExpr,
    formulaExprCn: normalizedFormula.formulaExprCn,
    blankWeight: toNumber(formModel.value.blankWeight),
    netWeight: toNumber(formModel.value.netWeight),
    processFee: toNumber(formModel.value.processFee),
    agentFee: toNumber(formModel.value.agentFee),
    manualPrice: toNumber(formModel.value.manualPrice),
    taxIncluded: formModel.value.taxIncluded,
    effectiveFrom: formModel.value.effectiveFrom || null,
    effectiveTo: formModel.value.effectiveTo || null,
    orderType: formModel.value.orderType,
    quota: toNumber(formModel.value.quota),
  }
  try {
    if (editingId.value) {
      const updated = await updateLinkedItem(editingId.value, payload)
      const nextRow = {
        ...updated,
        formulaExpr: normalizedFormula.formulaExpr,
        formulaExprCn: normalizedFormula.formulaExprCn,
      }
      tableRows.value = tableRows.value.map((item) =>
        item.id === editingId.value ? nextRow : item,
      )
      ElMessage.success('已更新')
    } else {
      const created = await createLinkedItem(payload)
      const nextRow = {
        ...created,
        formulaExpr: normalizedFormula.formulaExpr,
        formulaExprCn: normalizedFormula.formulaExprCn,
      }
      tableRows.value = [nextRow, ...tableRows.value]
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    // 这个 form 能改公式 / blankWeight / netWeight / taxIncluded，都影响后端 trace 口径，
    // 保存后必须重拉，否则"系统结果"列和"缺少:"红提示还是旧的
    loadRowTraces()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  }
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  try {
    await deleteLinkedItem(row.id)
    ElMessage.success('已删除')
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

const normalizeMonth = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`
  }
  return text
}

const getCurrentMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const normalizeDate = (value) => {
  if (!value) {
    return ''
  }
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return text.replace(/\//g, '-')
}

const parseNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isNaN(parsed) ? null : parsed
}

const parseBoolean = (value) => {
  if (value === true || value === false) {
    return value
  }
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) {
    return null
  }
  if (['1', 'true', 'yes', 'y', '是', '含税'].includes(text)) {
    return true
  }
  if (['0', 'false', 'no', 'n', '否', '未税'].includes(text)) {
    return false
  }
  return null
}

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }
  return Number(value).toFixed(4)
}

const derivedRows = computed(() =>
  tableRows.value.map((row) => {
    // T6：若 /bindings/pending 把该行标为"待绑定"，就在操作列打红点提示
    const unbound = pendingItemIds.value.has(row.id)
    // 系统结果口径统一来自后端 trace —— 见 loadRowTraces
    const trace = rowTraceMap.value[row.id]
    const calcPrice =
      trace && trace.calcPrice != null && !Number.isNaN(trace.calcPrice)
        ? Number(Number(trace.calcPrice).toFixed(4))
        : null
    const formulaIssue = trace?.error || ''
    // T24：系统结果 vs Excel 金标（row.manualPrice）差异（无公式行 calcPrice=null，diff 兼容 null）
    const { diff, exceeds } = diffWithGolden(calcPrice, row.manualPrice)
    return {
      ...row,
      unbound,
      calcPrice,
      formulaIssue,
      diffValue: diff,
      diffExceeds: exceeds,
    }
  }),
)

/**
 * T24：打开 trace 抽屉 —— 拉取后端结构化计算追踪并扁平化为时间轴。
 * 历史数据 traceJson 可能为 null / 解析失败，降级为"暂无追踪"。
 */
const openTrace = async (row) => {
  traceRow.value = row
  traceRaw.value = null
  traceSteps.value = []
  traceError.value = ''
  traceRawVisible.value = false
  traceDrawerVisible.value = true
  if (!row?.id) {
    traceError.value = '该行缺少计算 ID，无法拉取 trace'
    return
  }
  traceLoading.value = true
  try {
    const resp = await fetchTrace(row.id)
    const parsed = parseTraceJson(resp?.traceJson)
    if (!parsed) {
      traceError.value = '暂无追踪数据（该记录可能是旧数据或未启用 trace）'
      return
    }
    traceRaw.value = parsed
    traceSteps.value = buildTraceTimeline(parsed)
    if (traceSteps.value.length === 0) {
      traceError.value = 'trace 解析成功，但内容为空'
    }
  } catch (error) {
    // 404 / 网络异常 —— 不阻塞抽屉，只展示提示
    traceError.value = error?.message || '拉取 trace 失败'
  } finally {
    traceLoading.value = false
  }
}

// ============================ T6：行局部变量绑定 ============================

/**
 * 拉取"待绑定"列表 —— 驱动顶部徽章 + 每行红点。
 * 不阻塞主列表加载；失败时降级（徽章不显示，不报错打扰用户）。
 */
const loadPending = async () => {
  try {
    const resp = await fetchPending()
    pendingTotal.value = resp?.total || 0
    const ids = new Set()
    for (const it of resp?.items || []) {
      if (it?.linkedItemId != null) {
        ids.add(it.linkedItemId)
      }
    }
    pendingItemIds.value = ids
  } catch (error) {
    // /bindings/pending 404 / 503 / 权限不足 —— 徽章保持 0，不打扰用户
    pendingTotal.value = 0
    pendingItemIds.value = new Set()
  } finally {
    pendingLoaded.value = true
  }
}

/** 点击徽章 → 跳回第一条 unbound 行；这里简化为滚动到表格顶部并给用户提示 */
const openPendingList = () => {
  if (pendingItemIds.value.size === 0) {
    ElMessage.info('当前没有待绑定的联动行')
    return
  }
  ElMessage.info(
    `共 ${pendingTotal.value} 行待绑定，请在下表定位带红点的行点击"变量绑定"`,
  )
}

/** 打开变量绑定抽屉 */
const openBinding = (row) => {
  bindingRow.value = row
  bindingDrawerVisible.value = true
}

/** 绑定变更（新增 / 编辑 / 删除）回调 —— 刷新 pending 徽章 + 重算 trace */
const onBindingChanged = () => {
  loadPending()
  // binding 一改，__material / __scrap 的解析结果就变了，rowTraceMap 缓存立刻失效，
  // 不重拉的话列表"系统结果"列和红色"缺少:"错误会停在旧状态（用户困惑）
  loadRowTraces()
}

/** 绑定 CSV 导入 —— 走后端 /bindings/import multipart 端点 */
const handleBindingCsvChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  bindingImporting.value = true
  try {
    const resp = await importBindings(rawFile)
    const errors = Array.isArray(resp?.errors) ? resp.errors : []
    const summary = `共 ${resp?.total ?? 0} 行：新增 ${resp?.inserted ?? 0}，更新 ${resp?.updated ?? 0}，过期 ${resp?.expired ?? 0}，失败 ${errors.length}`
    if (errors.length === 0) {
      ElMessage.success(`绑定导入成功 — ${summary}`)
    } else {
      const firstFew = errors
        .slice(0, 3)
        .map((e) => `第${e.line}行：${e.reason}`)
        .join('；')
      const more = errors.length > 3 ? `…等 ${errors.length} 条` : ''
      ElMessageBox.alert(`${summary}\n\n${firstFew}${more}`, '绑定导入结果', {
        type: errors.length === resp?.total ? 'error' : 'warning',
      })
    }
    // 导入后刷新徽章；主列表不刷，用户可继续查看
    loadPending()
  } catch (error) {
    ElMessage.error(error?.message || '绑定 CSV 导入失败')
  } finally {
    bindingImporting.value = false
  }
}

const handleFileChange = async (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    return
  }
  importing.value = true
  try {
    if (!variableList.value.length) {
      await fetchVariables()
    }
    let XLSX = null
    try {
      const mod = await import('xlsx')
      XLSX = mod
    } catch (error) {
      ElMessage.error('未安装xlsx，请先运行 npm install xlsx')
      return
    }
    const buffer = await rawFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const headerMap = {
      价格月份: 'pricingMonth',
      组织: 'orgCode',
      来源: 'sourceName',
      供应商名称: 'supplierName',
      供应商代码: 'supplierCode',
      采购分类: 'purchaseClass',
      物料名称: 'materialName',
      物料代码: 'materialCode',
      规格型号: 'specModel',
      单位: 'unit',
      联动公式: 'formulaExpr',
      下料重: 'blankWeight',
      下料重量: 'blankWeight',
      净重: 'netWeight',
      加工费: 'processFee',
      代理费: 'agentFee',
      单价: 'manualPrice',
      是否含税: 'taxIncluded',
      生效日期: 'effectiveFrom',
      失效日期: 'effectiveTo',
      订单类型: 'orderType',
      配额: 'quota',
    }
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => headerMap[String(cell).trim()]),
    )
    if (headerIndex === -1) {
      ElMessage.error('未找到表头，请确认Excel格式是否正确')
      return
    }
    const headerRow = rows[headerIndex]
    const fieldIndex = {}
    headerRow.forEach((cell, index) => {
      const field = headerMap[String(cell).trim()]
      if (field) {
        fieldIndex[field] = index
      }
    })
    const fallbackMonth = filters.value.pricingMonth || getCurrentMonth()
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => {
        const pricingMonth =
          normalizeMonth(row[fieldIndex.pricingMonth]) || fallbackMonth
        const formulaExprCn = String(row[fieldIndex.formulaExpr] || '').trim()
        return {
          pricingMonth,
          orgCode: String(row[fieldIndex.orgCode] || '').trim(),
          sourceName: String(row[fieldIndex.sourceName] || '').trim(),
          supplierName: String(row[fieldIndex.supplierName] || '').trim(),
          supplierCode: String(row[fieldIndex.supplierCode] || '').trim(),
          purchaseClass: String(row[fieldIndex.purchaseClass] || '').trim(),
          materialName: String(row[fieldIndex.materialName] || '').trim(),
          materialCode: String(row[fieldIndex.materialCode] || '').trim(),
          specModel: String(row[fieldIndex.specModel] || '').trim(),
          unit: String(row[fieldIndex.unit] || '').trim(),
          formulaExprCn,
          formulaExpr: toCodeExpr(formulaExprCn, formulaIndex.value),
          blankWeight: parseNumber(row[fieldIndex.blankWeight]),
          netWeight: parseNumber(row[fieldIndex.netWeight]),
          processFee: parseNumber(row[fieldIndex.processFee]),
          agentFee: parseNumber(row[fieldIndex.agentFee]),
          manualPrice: parseNumber(row[fieldIndex.manualPrice]),
          taxIncluded: parseBoolean(row[fieldIndex.taxIncluded]),
          effectiveFrom: normalizeDate(row[fieldIndex.effectiveFrom]) || null,
          effectiveTo: normalizeDate(row[fieldIndex.effectiveTo]) || null,
          orderType: String(row[fieldIndex.orderType] || '').trim(),
          quota: parseNumber(row[fieldIndex.quota]),
        }
      })
      .filter((row) => row.materialCode)
    if (dataRows.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }
    const importMonth = dataRows[0].pricingMonth || fallbackMonth
    await importLinkedItems({
      pricingMonth: importMonth,
      rows: dataRows,
    })
    filters.value.pricingMonth = importMonth
    ElMessage.success(`已导入${dataRows.length}条联动价`)
    fetchList()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(fetchList)
onMounted(fetchVariables)
onMounted(loadPending)
</script>

<style scoped>
.linked-result {
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
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* T6：顶部"待绑定"徽章 —— 点击可跳转到红点行 */
.filter-badge {
  cursor: pointer;
  user-select: none;
}

/* T6：行操作列"变量绑定"按钮上的红点 —— pending 行有未绑定 token */
.binding-dot {
  margin-left: 4px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.expr-primary {
  font-family: 'SFMono-Regular', Menlo, monospace;
  color: #111827;
}

.expr-secondary {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

.expr-issue {
  margin-top: 2px;
  font-size: 12px;
  color: #dc2626;
}

.text-muted {
  color: #9ca3af;
}

.formula-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  color: #6b7280;
  font-size: 12px;
}

.formula-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.formula-var-tag {
  cursor: pointer;
}

.formula-warning {
  margin: -8px 0 12px 90px;
  font-size: 12px;
  color: #dc2626;
}

.upload-btn {
  margin-left: 8px;
}

/* T24：差异超阈值（> 0.01）红色高亮 */
.diff-exceeds {
  color: #dc2626;
  font-weight: 600;
}

/* T24：trace 抽屉排版 */
.trace-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
  color: #1f2a37;
}

.trace-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.trace-label {
  display: inline-block;
  min-width: 72px;
  color: #6b7280;
  margin-right: 8px;
}

.trace-empty {
  margin: 8px 0;
}

.trace-timeline {
  padding-left: 4px;
}

.trace-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trace-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trace-row code {
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  color: #111827;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}

.trace-vars-table {
  margin-top: 4px;
}

.trace-raw {
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
}

.trace-raw-pre {
  margin: 8px 0 0;
  padding: 10px;
  max-height: 320px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
