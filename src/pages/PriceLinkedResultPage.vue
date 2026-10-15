<template>
  <div class="linked-result">
    <el-alert v-if="correctionContextInvalid" title="补录修正上下文不完整，请回原产品核算页重新进入" type="error" :closable="false" />
    <el-alert v-else-if="correctionContext" :title="`正在处理报价 ${correctionContext.oaNo} 产品行 ${correctionContext.oaFormItemId}／${correctionContext.pricingMonth} 的自行公式。导入后请返回原产品检查价格。`" type="info" :closable="false" />
    <el-card v-if="lastImportResult?.technicalResults?.length" class="technical-import-results">
      <template #header>补录公式逐项结果</template>
      <el-table :data="lastImportResult.technicalResults" border>
        <el-table-column prop="materialNo" label="料号" />
        <el-table-column prop="sheetName" label="工作表" />
        <el-table-column prop="rowNumber" label="行号" width="80" />
        <el-table-column prop="linkedItemId" label="公式记录" width="110" />
        <el-table-column prop="message" label="处理结果" min-width="300" />
      </el-table>
    </el-card>
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <div class="filter-title">
          联动价格表
          <el-button v-if="pendingTotal > 0 || onlyBindingIssues" link type="warning" @click="openPendingList">{{ onlyBindingIssues ? '显示全部' : `本页异常 ${pendingTotal}` }}</el-button>
        </div>
        <div class="filter-actions">
          <el-button v-if="returnToWorkbenchVisible" @click="returnToWorkbench">
            返回核算工作台
          </el-button>
          <el-button
            v-hasPermi="['price:linked-item:import']"
            type="primary"
            :loading="importing"
            @click="openMonthlyImport"
          >
            {{ correctionContext ? '导入补录公式' : '导入联动原稿' }}
          </el-button>
          <el-button v-hasPermi="['price:finance-base:list', 'cost:finance-cu-base:query']" @click="goFactorMonthlySummary">财务基价</el-button>
          <el-button
            v-hasPermi="['price:linked-item:add']"
            @click="openCreate"
          >
            新增
          </el-button>
        </div>
      </div>
      <el-form :inline="true" label-width="90px">
        <el-form-item label="业务单元">
          <span>{{ businessUnitLabel(filters.businessUnitType) }}</span>
        </el-form-item>
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
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table
        :data="visibleRows"
        stripe
        v-loading="loading"
        class="linked-main-table"
        max-height="calc(100vh - 360px)"
        scrollbar-always-on
      >
        <el-table-column prop="materialCode" label="料号" width="145" fixed="left" />
        <el-table-column prop="materialName" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="supplierName" label="供应商名称" min-width="165" show-overflow-tooltip />
        <el-table-column prop="supplierCode" label="供应商代码" width="120" />
        <el-table-column prop="specModel" label="规格" min-width="120" show-overflow-tooltip />
        <el-table-column prop="unit" label="单位" width="65" />
        <el-table-column label="原稿未税单价" width="135" align="right">
          <template #default="{ row }">{{ priceText(row.sourceTaxExcludedPrice) }}</template>
        </el-table-column>
        <el-table-column label="财务未税单价" width="150" align="right">
          <template #default="{ row }">
            <el-tooltip v-if="row.formulaIssue" :content="row.formulaIssue"><span class="expr-issue">{{ rowTraceMap[row.id]?.status === 'WAIT_FINANCE_BASE' ? '待基价' : '待处理' }}</span></el-tooltip>
            <span v-else>{{ priceText(row.calcPrice) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pricingMonth" label="原稿月份" width="110" />
        <el-table-column label="财务来源月" width="110"><template #default="{ row }">{{ rowTraceMap[row.id]?.financeMonth || '—' }}</template></el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button v-hasPermi="['price:linked-item:list']" link type="primary" @click="openImportBasis(row)">详情</el-button>
            <el-popover v-if="row.expressionVersion !== 'ORIGINAL_V1'" placement="bottom" trigger="click" width="210">
              <template #reference><el-button link>维护</el-button></template>
              <div class="legacy-actions">
                <el-button v-hasPermi="['price:linked-item:edit']" link @click="openEditRow(row)">编辑</el-button>
                <el-button v-hasPermi="['price:linked-item:edit']" link @click="openFormulaEditor(row)">公式</el-button>
                <el-button link @click="openTrace(row)">计算依据</el-button>
                <el-button v-hasPermi="['price:linked:binding:view']" link @click="openBinding(row)">处理绑定</el-button>
                <el-button v-hasPermi="['price:linked-item:remove']" link type="danger" @click="removeRow(row)">删除</el-button>
              </div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>
      <BasePagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
      />
    </el-card>

    <OriginalLinkedImportDialog v-model="originalImportVisible" :pricing-month="filters.pricingMonth"
      :business-unit-type="filters.businessUnitType" @imported="onOriginalImported" />
    <OriginalPriceDetailDialog :rule-id="originalDetailId" kind="linked" :pricing-month="filters.pricingMonth"
      @close="originalDetailId = null" />

    <el-dialog
      v-model="importDialogVisible"
      destroy-on-close
      title="导入月度联动价与影响因素 Excel"
      width="960px"
    >
      <el-alert
        v-if="correctionContext"
        class="import-template-help"
        type="warning"
        :closable="false"
        title="补录公式导入：请在“联动价-部品6”整理技术公式，并在“影响因素10”核对影响因素及绑定；保留下载文件的“补录说明”Sheet。预检通过并确认导入后，返回核算页重新检查价格。"
      />
      <el-alert
        class="import-template-help"
        type="info"
        :closable="false"
        title="支持标准模板和采购价联动类型 2；系统按 Sheet 内容识别，不按文件名判断。公共因素使用已发布财务基价，原稿不覆盖财务价格。"
      />
      <el-form :model="importForm" label-width="120px">
        <el-form-item label="导入月份" required>
          <el-date-picker
            v-model="importForm.pricingMonth"
            :disabled="Boolean(correctionContext)"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择月份"
            @change="handleMonthlyImportContextChange"
          />
        </el-form-item>
        <el-form-item label="业务单元" required>
          <el-input
            v-model="importForm.businessUnitType"
            :disabled="Boolean(correctionContext)"
            placeholder="COMMERCIAL"
            @change="handleMonthlyImportContextChange"
          />
        </el-form-item>
        <el-form-item v-if="correctionContext" label="公式生效日期" required>
          <el-date-picker
            v-model="importForm.formulaEffectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择公式生效日期"
            @change="handleMonthlyImportContextChange"
          />
        </el-form-item>
        <el-form-item v-if="correctionContext" label="影响因素价格冲突" required>
          <el-radio-group
            v-model="importForm.factorPriceConflictStrategy"
            @change="handleMonthlyImportContextChange"
          >
            <el-radio-button label="KEEP_EXISTING">
              保留已有价格，冲突行跳过
            </el-radio-button>
            <el-radio-button label="OVERWRITE">
              仅覆盖冲突价格行
            </el-radio-button>
          </el-radio-group>
          <div class="strategy-help">
            <div>影响因素：缺失新增，相同跳过，价格不同按上方策略处理。</div>
            <div>覆盖只更新本次 Excel 命中的冲突行，不会清空数据库，也不会删除 Excel 未包含的价格。</div>
            <div>联动公式：新料号新增，公式变化生成新版本，公式相同跳过。</div>
          </div>
        </el-form-item>
        <el-form-item label="Excel 文件" required>
          <el-upload
            ref="monthlyUploadRef"
            class="monthly-upload"
            :disabled="importing"
            drag
            :limit="1"
            :show-file-list="true"
            :auto-upload="false"
            accept=".xlsx,.xls"
            :on-change="handleMonthlyImportFileChange"
            :on-remove="clearMonthlyImportFile"
          >
            <div class="upload-placeholder">
              <div class="upload-title">选择 Excel 后自动预检</div>
              <div class="upload-hint">
                公共原稿逐行核对实际公式和财务基价；存在错误时整批不发布。
              </div>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>

      <section
        v-if="selectedImportFile"
        v-loading="importPreviewLoading"
        class="import-preview-panel"
      >
        <el-alert
          v-if="importPreviewError"
          type="error"
          :closable="false"
          :title="importPreviewError"
          show-icon
        />
        <template v-else-if="importPreviewResult">
          <div class="preview-header">
            <div>
              <div class="section-title">文件预检结果</div>
              <div class="section-subtitle">
                {{ importPreviewResult.detectionMessage || '模板结构识别完成' }}
              </div>
            </div>
            <el-tag
              :type="importPreviewResult.canConfirm ? 'success' : 'danger'"
              effect="light"
            >
              {{ importPreviewResult.canConfirm ? '可以确认导入' : '存在阻断错误' }}
            </el-tag>
          </div>
          <div class="preview-summary-grid">
            <div
              v-for="item in type2PreviewSummaryItems"
              :key="item.key"
              class="preview-summary-item"
            >
              <span>{{ item.label }}</span>
              <el-tag v-if="item.tag" :type="item.tag" effect="plain">
                {{ item.value }}
              </el-tag>
              <strong v-else>{{ item.value }}</strong>
            </div>
          </div>
          <el-table
            v-if="type2PreviewErrorRows.length"
            :data="type2PreviewErrorRows"
            class="preview-error-table"
            size="small"
            border
            max-height="220"
          >
            <el-table-column prop="sourceSheetName" label="Sheet" width="140" />
            <el-table-column prop="rowNumber" label="行号" width="80" />
            <el-table-column prop="materialCode" label="料号" width="140" />
            <el-table-column prop="supplierCode" label="供应商" width="120" />
            <el-table-column prop="errorCode" label="错误类型" width="170" />
            <el-table-column prop="message" label="原因" min-width="260" />
          </el-table>
        </template>
        <el-empty
          v-else
          :image-size="60"
          description="正在等待预检结果"
        />
      </section>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!canConfirmMonthlyImport"
          @click="submitMonthlyImport"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>

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
    <PriceLinkedImportBasisDrawer
      v-model:visible="importBasisDrawerVisible"
      :row="importBasisRow"
    />
  </div>
</template>

<script setup>
import OriginalLinkedImportDialog from '../components/OriginalLinkedImportDialog.vue'
import OriginalPriceDetailDialog from '../components/OriginalPriceDetailDialog.vue'
import { businessUnitLabel, priceText } from '../components/originalPriceDisplay'
import { fetchLinkedEffectivePrices } from '../api/originalPriceTrials'
import { technicalPriceContext, priceWorkbenchReturn } from '../utils/technicalPriceCorrection'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import {
  fetchLinkedItemsPage,
  createLinkedItem,
  updateLinkedItem,
  deleteLinkedItem,
  importLinkedItemsExcel,
  previewLinkedItemsExcel,
  fetchTrace,
  previewFormula,
} from '../api/priceLinkedItems'
import { formulaVariables, toChineseExpr, toCodeExpr, buildFormulaIndex } from '../utils/formula'
import { fetchPriceVariables, fetchRowLocalPlaceholders } from '../api/priceVariables'
// T6：行局部变量绑定 —— pending 徽章 + CSV 导入 + drawer
import {
  fetchPending,
} from '../api/priceLinkedBindings'
import PriceLinkedBindingDrawer from '../components/PriceLinkedBindingDrawer.vue'
import PriceLinkedImportBasisDrawer from '../components/PriceLinkedImportBasisDrawer.vue'
import BasePagination from '../components/BasePagination.vue'
import {
  buildType2PreviewSummary,
  canConfirmLinkedPreview,
  currentPricingMonth,
  linkedImportResultText,
  normalizeType2PreviewErrors,
} from './priceLinkedType2PreviewUtils'
// T24：trace drawer + 系统结果/Excel 金标/差异 所需的纯函数辅助层
import {
  buildTraceTimeline,
  parseTraceJson,
} from './priceLinkedResultUtils'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableRows = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
// 公共原稿批量读有效价；技术补录及旧公式沿用各自依据入口。
const rowTraceMap = ref({})
const dialogVisible = ref(false)
const importing = ref(false)
const monthlyUploadRef = ref(null)
const importDialogVisible = ref(false)
const selectedImportFile = ref(null)
const importPreviewLoading = ref(false)
const importPreviewResult = ref(null)
const importPreviewError = ref('')
const lastImportResult = ref(null)
const importPreviewRequestToken = ref(0)
const correctionContext = computed(() => technicalPriceContext(route.query))
const correctionContextInvalid = computed(() => Boolean(route.query.technicalVersionId) && !correctionContext.value)
const returnToWorkbenchVisible = computed(() => Boolean(priceWorkbenchReturn(route.query)))

const returnToWorkbench = () => {
  const target = priceWorkbenchReturn(route.query)
  if (!target) return
  router.push(target)
}
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

// 本页异常筛选；后端绑定列表提供存在歧义的规则身份。
const pendingTotal = computed(() => derivedRows.value.filter(row => row.unbound || row.formulaIssue).length)
const pendingItemIds = ref(new Set())
const onlyBindingIssues = ref(false)
const originalImportVisible = ref(false)
const originalDetailId = ref(null)
const bindingDrawerVisible = ref(false)
const bindingRow = ref(null)
const importBasisDrawerVisible = ref(false)
const importBasisRow = ref(null)
const userStore = useUserStore()
const canRead = permission => userStore.permissions?.includes('*:*:*') || userStore.permissions?.includes(permission)

const currentMonthText = () => currentPricingMonth()

const firstDayOfMonth = (monthText) => {
  const value = String(monthText || '').trim()
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : ''
}

// V4-10 历史兼容回归：支持从 URL query 直接打开历史月份，避免刷新或分享
// /price/linked/result?pricingMonth=2026-02 时又回到当前月份。
const queryString = (key, fallback = '') => {
  const value = route.query?.[key]
  if (Array.isArray(value)) {
    return value[0] || fallback
  }
  return value || fallback
}

const importForm = ref({
  pricingMonth: queryString('pricingMonth', currentMonthText()),
  businessUnitType: queryString('businessUnitType', userStore.businessUnitType || ''),
  overwriteManual: false,
  formulaEffectiveDate: firstDayOfMonth(queryString('pricingMonth', currentMonthText())),
  factorPriceConflictStrategy: 'KEEP_EXISTING',
})

const type2PreviewSummaryItems = computed(() =>
  buildType2PreviewSummary(importPreviewResult.value || {}),
)

const type2PreviewErrorRows = computed(() =>
  normalizeType2PreviewErrors(importPreviewResult.value?.errors),
)

const canConfirmMonthlyImport = computed(() =>
  canConfirmLinkedPreview({
    file: selectedImportFile.value,
    loading: importPreviewLoading.value,
    error: importPreviewError.value,
    preview: importPreviewResult.value,
  }),
)

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
  businessUnitType: queryString('businessUnitType', userStore.businessUnitType || ''),
  pricingMonth: queryString('pricingMonth', currentMonthText()),
  materialCode: queryString('materialCode', ''),
})

const buildParams = () => ({
  pricingMonth: filters.value.pricingMonth,
  materialCode: filters.value.materialCode?.trim(),
  page: currentPage.value,
  pageSize: pageSize.value,
})

const normalizePageRows = (data) => {
  if (Array.isArray(data)) {
    return { rows: data, total: data.length }
  }
  const rows = data?.list || data?.records || []
  return {
    rows: Array.isArray(rows) ? rows : [],
    total: Number(data?.total || 0),
  }
}

let listRequest = 0
let traceRequest = 0
const fetchList = async () => {
  const current = ++listRequest
  traceRequest++
  rowTraceMap.value = {}
  loading.value = true
  try {
    const data = await fetchLinkedItemsPage(buildParams())
    if (current !== listRequest) return
    const page = normalizePageRows(data)
    tableRows.value = page.rows
    total.value = page.total
    if (tableRows.value.length === 0 && total.value > 0 && currentPage.value > 1) {
      currentPage.value = Math.max(1, Math.ceil(total.value / pageSize.value))
      return
    }
    if (!filters.value.pricingMonth && tableRows.value.length > 0) {
      filters.value.pricingMonth = tableRows.value[0].pricingMonth || ''
    }
  } catch (error) {
    if (current !== listRequest) return
    tableRows.value = []
    total.value = 0
    rowTraceMap.value = {}
    ElMessage.error(error?.message || '获取联动价失败')
  } finally {
    if (current === listRequest) loading.value = false
  }
  if (current !== listRequest) return
  // 批量读取已保存的有效价，旧查询不得覆盖新月份。
  loadRowTraces()
}

const loadRowTraces = async () => {
  const current = ++traceRequest
  const pricingMonth = filters.value.pricingMonth
  const rows = tableRows.value.filter((r) => r?.id && r?.formulaExpr)
  if (rows.length === 0) {
    rowTraceMap.value = {}
    return
  }
  const next = {}
  const originals = rows.filter(row => row.expressionVersion === 'ORIGINAL_V1')
  if (originals.length) {
    try {
      const prices = await fetchLinkedEffectivePrices(originals.map(row => row.id), pricingMonth)
      for (const price of prices) next[price.originalId] = {
        calcPrice: price.unitPrice, error: price.message || '', variables: {}, status: price.status,
        financeMonth: price.financeMonth,
      }
    } catch (error) {
      for (const row of originals) next[row.id] = { calcPrice: null, error: error?.message || '有效价读取失败', status: 'ERROR', variables: {} }
    }
  }
  await Promise.all(rows.filter(row => row.expressionVersion !== 'ORIGINAL_V1').map(async row => {
    try {
      const resp = await fetchTrace(row.id)
      const parsed = parseTraceJson(resp?.traceJson)
      next[row.id] = { calcPrice: parsed?.result ?? null, error: parsed?.error || '', variables: parsed?.variables || {} }
    } catch (error) {
      next[row.id] = { calcPrice: null, error: error?.message || '依据读取失败', variables: {} }
    }
  }))
  if (current !== traceRequest) return
  rowTraceMap.value = next
}

const fetchVariables = async () => {
  if (!canRead('price:variable:list')) return
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

const applyFilters = () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
}

const resetFilters = () => {
  filters.value = {
    businessUnitType: userStore.businessUnitType || '',
    pricingMonth: currentMonthText(),
    materialCode: '',
      }
  applyFilters()
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
      await updateLinkedItem(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createLinkedItem(payload)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    // 这个 form 能改公式 / blankWeight / netWeight / taxIncluded，都影响后端 trace 口径。
    // 分页后保存统一重拉当前页，避免新增行硬塞到当前页导致顺序和总数不一致。
    fetchList()
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

const derivedRows = computed(() =>
  tableRows.value.map((row) => {
    // 绑定与公式异常合并为本页筛选，保留每行的具体原因。
    const unbound = pendingItemIds.value.has(row.id)
    // 公共原稿来自有效价，其他来源保留原有trace。
    const trace = rowTraceMap.value[row.id]
    const calcPrice =
      trace && trace.calcPrice != null && !Number.isNaN(trace.calcPrice)
        ? Number(trace.calcPrice)
        : null
    const formulaIssue = trace?.error || ''
    return {
      ...row,
      unbound,
      calcPrice,
      formulaIssue,
    }
  }),
)

const visibleRows = computed(() => onlyBindingIssues.value ? derivedRows.value.filter(row => row.unbound || row.formulaIssue) : derivedRows.value)

/**
 * 联动价格表只保留本次导入核对能力。
 * 月度财务基价统一在财务基价页面维护。
 */
const goFactorMonthlySummary = () => {
  const orgs = [...new Set(tableRows.value.map(row => row.orgCode).filter(Boolean))]
  router.push({
    path: '/rules/finance-cu-base',
    query: {
      priceMonth: filters.value.pricingMonth || '',
      priceOrgCode: orgs.length === 1 ? orgs[0] : '',
      businessUnitType: filters.value.businessUnitType || '',
    },
  })
}

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

const openImportBasis = (row) => {
  if (row.expressionVersion === 'ORIGINAL_V1') { originalDetailId.value = row.id; return }
  importBasisRow.value = row
  importBasisDrawerVisible.value = true
}

// ============================ T6：行局部变量绑定 ============================

/**
 * 拉取"待绑定"列表 —— 驱动顶部徽章 + 每行红点。
 * 不阻塞主列表加载；失败时降级（徽章不显示，不报错打扰用户）。
 */
const loadPending = async () => {
  if (!canRead('price:linked:binding:view')) return
  try {
    const resp = await fetchPending()
    const ids = new Set()
    for (const it of resp?.items || []) {
      if (it?.linkedItemId != null) {
        ids.add(it.linkedItemId)
      }
    }
    pendingItemIds.value = ids
  } catch (error) {
    // /bindings/pending 404 / 503 / 权限不足 —— 徽章保持 0，不打扰用户
    pendingItemIds.value = new Set()
  }
}

/** 异常筛选只作用于当前页，不冒充全量异常列表。 */
const openPendingList = () => { onlyBindingIssues.value = !onlyBindingIssues.value }

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

const onOriginalImported = async (result) => {
  lastImportResult.value = result
  await fetchList()
}

const openMonthlyImport = () => {
  if (correctionContextInvalid.value) { ElMessage.error('补录修正上下文不完整，请返回原产品重新进入'); return }
  if (!correctionContext.value) { originalImportVisible.value = true; return }
  const pricingMonth = correctionContext.value?.pricingMonth || filters.value.pricingMonth || currentMonthText()
  importForm.value = {
    pricingMonth,
    businessUnitType:
      correctionContext.value?.businessUnitType || filters.value.businessUnitType || userStore.businessUnitType || '',
    overwriteManual: false,
    formulaEffectiveDate: firstDayOfMonth(pricingMonth),
    factorPriceConflictStrategy: 'KEEP_EXISTING',
  }
  selectedImportFile.value = null
  monthlyUploadRef.value?.clearFiles()
  invalidateMonthlyImportPreview()
  importDialogVisible.value = true
}

const previewOptions = () => ({
  technicalContext: correctionContext.value,
  businessUnitType: importForm.value.businessUnitType,
  overwriteManual: importForm.value.overwriteManual,
  formulaEffectiveDate: importForm.value.formulaEffectiveDate,
  factorPriceConflictStrategy: importForm.value.factorPriceConflictStrategy,
})

const invalidateMonthlyImportPreview = () => {
  importPreviewRequestToken.value += 1
  importPreviewLoading.value = false
  importPreviewResult.value = null
  importPreviewError.value = ''
}

const runMonthlyImportPreview = async () => {
  const rawFile = selectedImportFile.value
  if (
    !rawFile ||
    !isExcelFile(rawFile) ||
    !importForm.value.pricingMonth ||
    !importForm.value.businessUnitType ||
    (correctionContext.value && (!importForm.value.formulaEffectiveDate ||
      !importForm.value.factorPriceConflictStrategy))
  ) {
    return
  }
  const token = ++importPreviewRequestToken.value
  importPreviewLoading.value = true
  importPreviewResult.value = null
  importPreviewError.value = ''
  try {
    const preview = await previewLinkedItemsExcel(
      rawFile,
      importForm.value.pricingMonth,
      previewOptions(),
    )
    if (token !== importPreviewRequestToken.value) return
    importPreviewResult.value = preview || {}
  } catch (error) {
    if (token !== importPreviewRequestToken.value) return
    importPreviewError.value = error?.message || 'Excel 预检失败'
    ElMessage.error(importPreviewError.value)
  } finally {
    if (token === importPreviewRequestToken.value) {
      importPreviewLoading.value = false
    }
  }
}

const handleMonthlyImportFileChange = async (uploadFile) => {
  invalidateMonthlyImportPreview()
  selectedImportFile.value = uploadFile?.raw || null
  if (selectedImportFile.value && !isExcelFile(selectedImportFile.value)) {
    importPreviewError.value = '文件必须是 Excel 格式'
    return
  }
  await runMonthlyImportPreview()
}

const clearMonthlyImportFile = () => {
  selectedImportFile.value = null
  invalidateMonthlyImportPreview()
}

const handleMonthlyImportContextChange = async () => {
  invalidateMonthlyImportPreview()
  if (!selectedImportFile.value) return
  await nextTick()
  await runMonthlyImportPreview()
}

const isExcelFile = (file) => {
  const name = String(file?.name || '').toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

const submitMonthlyImport = async () => {
  if (correctionContextInvalid.value) { ElMessage.error('补录修正上下文不完整'); return }
  const rawFile = selectedImportFile.value
  if (!importForm.value.pricingMonth) {
    ElMessage.warning('导入月份必填')
    return
  }
  if (!importForm.value.businessUnitType) {
    ElMessage.warning('业务单元必填')
    return
  }
  if (correctionContext.value && !importForm.value.formulaEffectiveDate) {
    ElMessage.warning('公式生效日期必填')
    return
  }
  if (correctionContext.value && !importForm.value.factorPriceConflictStrategy) {
    ElMessage.warning('影响因素价格冲突策略必填')
    return
  }
  if (!rawFile) {
    ElMessage.warning('请选择 Excel 文件')
    return
  }
  if (!isExcelFile(rawFile)) {
    ElMessage.warning('文件必须是 Excel 格式')
    return
  }
  if (!canConfirmMonthlyImport.value) {
    ElMessage.warning('请等待文件预检通过后再确认导入')
    return
  }
  importing.value = true
  try {
    const result = await importLinkedItemsExcel(rawFile, importForm.value.pricingMonth, {
      technicalContext: correctionContext.value,
      businessUnitType: importForm.value.businessUnitType,
      overwriteManual: importForm.value.overwriteManual,
      formulaEffectiveDate: importForm.value.formulaEffectiveDate,
      factorPriceConflictStrategy: importForm.value.factorPriceConflictStrategy,
      previewFileSha256: importPreviewResult.value.fileSha256,
      previewFingerprint: importPreviewResult.value.previewFingerprint,
    })
    lastImportResult.value = result || {}
    filters.value.pricingMonth = importForm.value.pricingMonth
    filters.value.businessUnitType = importForm.value.businessUnitType
    importDialogVisible.value = false
    const hasWarnings = String(result?.importStatus || '').toUpperCase() === 'PARTIAL'
      || result?.errors?.length > 0 || result?.bindingErrors?.length > 0
      || result?.factorRows?.some(row => String(row.monthlyPriceAction || row.action || '').toUpperCase().includes('CONFLICT'))
    if (hasWarnings) {
      ElMessage.warning(linkedImportResultText(result || {}))
    } else {
      ElMessage.success(linkedImportResultText(result || {}))
    }
    fetchList()
    loadPending()
  } catch (error) {
    ElMessage.error(error?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

watch(
  () => importForm.value.pricingMonth,
  (month, oldMonth) => {
    const oldDefault = firstDayOfMonth(oldMonth)
    if (
      !importForm.value.formulaEffectiveDate ||
      importForm.value.formulaEffectiveDate === oldDefault
    ) {
      importForm.value.formulaEffectiveDate = firstDayOfMonth(month)
    }
  },
)

watch(
  () => userStore.businessUnitType,
  (value) => {
    if (!value) {
      return
    }
    if (!filters.value.businessUnitType) {
      filters.value.businessUnitType = value
    }
    if (!importForm.value.businessUnitType) {
      importForm.value.businessUnitType = value
    }
  },
)

watch(pageSize, () => {
  if (currentPage.value === 1) {
    fetchList()
  } else {
    currentPage.value = 1
  }
})

watch(currentPage, () => {
  fetchList()
})

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

.legacy-actions { display: flex; flex-wrap: wrap; gap: 12px; }

.filter-actions {
  display: flex;
  gap: 8px;
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

.linked-main-table {
  min-height: 320px;
}

.linked-main-table :deep(.el-scrollbar__bar.is-horizontal) {
  height: 10px;
}

.monthly-upload {
  width: 100%;
}

.import-template-help {
  margin-bottom: 16px;
}

.import-preview-panel {
  min-height: 90px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #f8fbff;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.preview-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.preview-summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.preview-summary-item span {
  color: #6b7280;
  font-size: 12px;
}

.preview-summary-item strong {
  color: #111827;
  font-size: 14px;
}

.preview-error-table {
  margin-top: 12px;
}

.upload-placeholder {
  padding: 12px 0;
}

.upload-title {
  font-size: 14px;
  color: #1f2a37;
}

.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.strategy-help {
  margin-top: 8px;
  line-height: 1.7;
  font-size: 12px;
  color: #6b7280;
}

/* T24：差异超阈值（> 0.01）红色高亮 */


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
