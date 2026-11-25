<template>
  <div class="inquiry-page price-source-page">
    <el-card>
      <template #header><div class="heading"><div><h2>询价</h2><p>支持固定、联动和区间询价；料号与供方可留空，按型号／规格匹配。</p></div>
        <WorkbookActions kind="inquiry" :fetch-page="mode === 'current' && allowed('list') ? fetchInquiryPrices : undefined" :query="{ priceMonth, search: keyword || undefined, model: model || undefined, view: mode }" size-key="size" :export-page-size="100" import-permission="price:inquiry:import" />
        <el-button v-if="allowed('import')" type="primary" :disabled="!priceMonth" @click="openImport">导入询价</el-button></div></template>
      <el-form inline @submit.prevent="search">
        <el-form-item label="价格月份"><el-date-picker v-model="priceMonth" type="month" value-format="YYYY-MM" format="YYYY-MM" :clearable="false" :disabled="session.state.busy" aria-label="价格月份" /></el-form-item>
        <el-form-item label="物料"><el-input v-model="keyword" placeholder="料号、名称或规格型号" clearable @keyup.enter="search" /></el-form-item>
        <el-form-item v-if="mode === 'current'" label="型号"><el-input v-model="model" placeholder="输入型号，支持部分匹配" clearable @keyup.enter="search" @clear="search" /></el-form-item>
        <el-button @click="search">查询</el-button><el-button @click="load">刷新列表</el-button>
      </el-form>
      <p class="hint">取价顺序：SRM固定价 → 阶梯价 → 发票价 → 订单价 → 询价。商用和板换均使用商用基价。导错文件可在“导入历史”整批失效；失效后不再取价，重新上传正确文件。</p>
      <el-tabs v-model="mode" @tab-change="search"><el-tab-pane label="当月询价" name="current" /><el-tab-pane v-if="allowed('query')" label="导入历史" name="history" /></el-tabs>
      <p v-if="mode === 'history'" class="hint">记录数按导入后的询价计数。同一料号或型号、同一供方的多档区间价合为一条。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-if="mode === 'current'" :data="rows" v-loading="loading" border row-key="source.id" max-height="620" empty-text="该月暂无询价" aria-label="当月询价">
        <el-table-column prop="source.rule.materialCode" label="料号" min-width="150" /><el-table-column prop="source.rule.materialName" label="名称" min-width="100" />
        <el-table-column prop="source.rule.specification" label="规格型号" min-width="190" show-overflow-tooltip /><el-table-column prop="source.rule.supplierName" label="供方名称" min-width="150" />
        <el-table-column prop="source.rule.priceType" label="价格类型" width="90" /><el-table-column prop="price" label="不含税单价" min-width="210" :formatter="formatPrice" show-overflow-tooltip />
        <el-table-column label="状态" min-width="145"><template #default="{ row }"><el-tag :type="statusType(row)" :title="row.message || undefined">{{ statusLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column label="行情区间" min-width="260" show-overflow-tooltip><template #default="{ row }">{{ rangeText(row.source.rule, row.calculation?.financeFactors) }}</template></el-table-column>
        <el-table-column prop="source.batchId" label="导入批次" width="95" /><el-table-column prop="source.importedAt" label="导入时间" min-width="185" show-overflow-tooltip />
        <el-table-column v-if="allowed('query') || allowed('import')" label="操作" width="128" fixed="right">
          <template #default="{ row }">
            <el-button v-if="allowed('query')" link type="primary" @click="showCalculation(row)">查看</el-button>
            <PriceRowVoidButton v-if="allowed('import')" :path="`/api/v1/inquiry-prices/rows/${row.source.id}/void`"
              :description="[row.source.rule.materialCode, row.source.rule.specification, row.source.rule.supplierName].filter(Boolean).join(' / ')"
              @withdrawn="load" />
          </template>
        </el-table-column>
      </el-table>
      <el-table v-else :data="rows" v-loading="loading" border row-key="id" empty-text="暂无导入历史" aria-label="询价导入历史">
        <el-table-column prop="id" label="批次" width="90" /><el-table-column prop="price_month" label="导入月份" width="110" /><el-table-column prop="file_name" label="原文件" min-width="230" />
        <el-table-column prop="row_count" label="记录数" width="95" /><el-table-column prop="created_by" label="导入人" min-width="110" /><el-table-column prop="created_at" label="导入时间" min-width="180" />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.status === 'VOIDED' ? 'info' : 'success'">{{ row.status === 'VOIDED' ? '已失效' : '已导入' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="250"><template #default="{ row }"><el-button link type="primary" @click="showBatch(row.id)">明细</el-button><el-button v-if="allowed('download')" link @click="download(row)">下载原件</el-button><el-button v-if="allowed('import') && row.status !== 'VOIDED'" link type="danger" :disabled="!!voidBusyId" :loading="voidBusyId === row.id" @click="voidImport(row)">失效</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="total" v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </el-card>
    <el-dialog v-model="importOpen" title="导入询价" width="1050px" :close-on-click-modal="false" :show-close="!session.state.busy" :close-on-press-escape="!session.state.busy" @closed="session.reset">
      <p>价格月份：{{ priceMonth }}。按表头识别，工作表名称不限。导入后按该月商用基价刷新，没有基价时联动价和区间价等待发布后刷新，固定价仍可使用。</p>
      <p>行情因素填写财务基价里的完整名称，例如「1#电解铜」。同一型号和供方的各档分别填一行，型号、供方、行情因素和单位保持一致，导入后合为一条询价。</p>
      <input :key="fileKey" type="file" accept=".xls,.xlsx" aria-label="选择询价Excel文件" :disabled="session.state.busy" @change="selectFile" />
      <el-alert v-if="session.state.error" :title="session.state.error" type="error" :closable="false" />
      <template v-if="session.state.preview">
        <p>文件：{{ session.state.fileName }}；{{ session.state.preview.rows.length }}条；工作表：{{ session.state.preview.sheets.join('、') }}</p>
        <el-table :data="session.state.preview.rows.slice(0, 100)" border max-height="370" aria-label="询价导入预览">
          <el-table-column prop="materialCode" label="料号" min-width="150" /><el-table-column prop="specification" label="规格型号" min-width="185" /><el-table-column prop="supplierName" label="供方名称" min-width="120" />
          <el-table-column prop="priceType" label="价格类型" width="90" /><el-table-column prop="originalPrice" label="原表价格" min-width="165" /><el-table-column prop="formula" label="原公式" min-width="250" show-overflow-tooltip />
          <el-table-column label="行情区间" min-width="260"><template #default="{ row }">{{ rangeText(row) }}</template></el-table-column>
          <el-table-column prop="sheetName" label="工作表" min-width="120" /><el-table-column prop="sourceRow" label="行号" width="70" />
        </el-table>
        <p class="hint">原表价格用于核对；联动价和区间价的实际取价以导入后的当月刷新结果为准。预览最多显示100条，确认后保存全部记录。</p>
      </template>
      <template #footer><el-button :disabled="session.state.busy" @click="importOpen = false">取消</el-button><el-button type="primary" :loading="session.state.busy" :disabled="!session.state.preview || !allowed('import')" @click="session.publish">确认导入</el-button></template>
    </el-dialog>
    <el-dialog v-model="calculationOpen" title="询价取价依据" width="850px" destroy-on-close>
      <template v-if="calculation">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="料号">{{ calculation.source.rule.materialCode || '未填' }}</el-descriptions-item><el-descriptions-item label="规格型号">{{ calculation.source.rule.specification }}</el-descriptions-item>
          <el-descriptions-item label="价格月份">{{ calculation.priceMonth }}</el-descriptions-item><el-descriptions-item label="不含税单价">{{ formatPrice(null, null, calculation.price) }}</el-descriptions-item>
          <el-descriptions-item label="价格类型">{{ calculation.source.rule.priceType }}</el-descriptions-item><el-descriptions-item label="状态">{{ statusLabel(calculation) }}</el-descriptions-item>
          <el-descriptions-item label="原始来源" :span="2">{{ calculation.source.fileName }} / {{ calculation.source.rule.sheetName }} / 第{{ calculation.source.rule.sourceRow }}行</el-descriptions-item>
          <el-descriptions-item :label="calculation.source.rule.range ? '行情区间' : '原公式'" :span="2">{{ calculation.source.rule.range ? rangeText(calculation.source.rule, calculation.calculation.financeFactors) : calculation.source.rule.formula || '固定价：批量价总价' }}</el-descriptions-item>
          <el-descriptions-item v-if="calculation.calculation.financeBatchId" label="商用基价" :span="2">{{ calculation.calculation.financeMonth }} / {{ calculation.calculation.financeScheme }} / 修订{{ calculation.calculation.financeRevision }}</el-descriptions-item>
        </el-descriptions>
        <el-alert v-if="calculation.message" :title="calculation.message" type="warning" :closable="false" />
        <el-table v-if="factorRows.length" :data="factorRows" border class="factors"><el-table-column prop="name" label="影响因素" /><el-table-column prop="value" label="本次使用基价" /></el-table>
        <el-button v-if="allowed('download')" class="original" @click="download({ id: calculation.source.batchId, file_name: calculation.source.fileName })">下载原件</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="detailOpen" :title="`询价批次 ${detailId} 原始明细`" width="1050px" destroy-on-close>
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <el-table :data="details" v-loading="detailLoading" border max-height="500" aria-label="询价批次明细">
        <el-table-column prop="rule.materialCode" label="料号" min-width="150" /><el-table-column prop="rule.specification" label="规格型号" min-width="190" /><el-table-column prop="rule.supplierName" label="供方名称" min-width="140" />
        <el-table-column prop="rule.priceType" label="类型" width="85" /><el-table-column prop="rule.originalPrice" label="原表价格" min-width="165" /><el-table-column prop="rule.formula" label="原公式" min-width="260" show-overflow-tooltip />
        <el-table-column label="行情区间" min-width="260"><template #default="{ row }">{{ rangeText(row.rule) }}</template></el-table-column>
        <el-table-column prop="rule.sheetName" label="工作表" min-width="120" /><el-table-column prop="rule.sourceRow" label="行号" width="70" />
        <el-table-column label="状态" width="95"><template #default="{ row }">{{ row.batchStatus === 'VOIDED' ? '已失效' : '已导入' }}</template></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>
<script setup>
import '../styles/priceSources.css'
import WorkbookActions from '../components/WorkbookActions.vue'
import PriceRowVoidButton from '../components/PriceRowVoidButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchInquiryPrices, fetchInquiryHistory, fetchInquiryBatch, downloadInquiryOriginal, inquiryImportApi, voidInquiryImport } from '../api/inquiryPrices'
import { createInquiryImport } from './inquiryPriceImport'
const user = useUserStore()
const allowed = permission => user.permissions.includes('*:*:*') || user.permissions.includes(`price:inquiry:${permission}`)
const today = new Date()
const priceMonth = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`), keyword = ref(''), mode = ref('current'), page = ref(1)
const model = ref('')
const rows = ref([]), total = ref(0), error = ref(''), loading = ref(false)
const importOpen = ref(false), fileKey = ref(0), detailOpen = ref(false), detailId = ref(null), details = ref([]), detailError = ref(''), detailLoading = ref(false)
const voidBusyId = ref(null)
const calculationOpen = ref(false), calculation = ref(null)
const factorRows = computed(() => Object.values(calculation.value?.calculation?.financeFactors || {}).map(factor => ({ name: factor.factorName || factor.shortName, value: `${factor.price} ${factor.unit || ''}` })))
const scope = computed(() => `${user.userId || ''}/${user.businessUnitType || ''}/${priceMonth.value}`)
let listSequence = 0, detailSequence = 0, alive = true
const session = createInquiryImport({ api: inquiryImportApi, scope: () => scope.value, month: () => priceMonth.value, onImported: result => {
  importOpen.value = false
  const refresh = result.refresh
  ElMessage.success(`导入成功：${result.rows}条${refresh ? `；有效询价刷新${refresh.ready}条，待基价${refresh.waiting}条，异常${refresh.invalid}条` : ''}`)
  mode.value = 'current'; page.value = 1; load()
} })
watch([scope, () => user.permissions.join(',')], () => {
  listSequence++; detailSequence++; session.reset(); importOpen.value = false; detailOpen.value = false; calculationOpen.value = false; calculation.value = null
  rows.value = []; total.value = 0; details.value = []; page.value = 1
  if (!allowed('query')) mode.value = 'current'
  load()
}, { immediate: true })
onBeforeUnmount(() => { alive = false; listSequence++; detailSequence++; session.reset() })
async function load() {
  const ticket = ++listSequence, owner = scope.value
  if (!allowed('list') || !priceMonth.value || mode.value === 'history' && !allowed('query')) return
  loading.value = true; error.value = ''; rows.value = []; total.value = 0
  try {
    const fetch = mode.value === 'history' ? fetchInquiryHistory : fetchInquiryPrices
    const result = await fetch({ priceMonth: priceMonth.value, search: keyword.value || undefined, model: model.value.trim(), page: page.value, size: 20 })
    if (alive && ticket === listSequence && owner === scope.value) { rows.value = result.records; total.value = result.total }
  } catch (failure) { if (alive && ticket === listSequence) error.value = failure.message || '询价查询失败' }
  finally { if (alive && ticket === listSequence) loading.value = false }
}
function search() { page.value = 1; load() }
function formatPrice(row, column, value) { const text = String(value ?? ''); return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text }
function missedMarketRange(row) {
  return row.status === 'INVALID' && !!row.source.rule.range && row.message?.endsWith('未命中询价区间')
}
function statusLabel(row) {
  if (missedMarketRange(row)) return '未命中当月行情'
  return ({ READY: '可取价', WAITING_BASE: '等待当月商用基价', INVALID: '刷新异常' })[row.status] || row.status
}
function statusType(row) {
  if (row.status === 'READY') return 'success'
  if (row.status === 'INVALID' && !missedMarketRange(row)) return 'danger'
  return 'warning'
}
function openImport() { session.reset(); fileKey.value++; importOpen.value = true }
function selectFile(event) { session.select(event.target.files?.[0]) }
function showCalculation(row) { if (allowed('query')) { calculation.value = row; calculationOpen.value = true } }
async function showBatch(id) {
  if (!allowed('query')) return
  const ticket = ++detailSequence, owner = scope.value
  detailId.value = id; details.value = []; detailError.value = ''; detailOpen.value = true; detailLoading.value = true
  try { const result = await fetchInquiryBatch(id); if (alive && ticket === detailSequence && owner === scope.value) details.value = result }
  catch (failure) { if (alive && ticket === detailSequence) detailError.value = failure.message || '批次明细读取失败' }
  finally { if (alive && ticket === detailSequence) detailLoading.value = false }
}
async function download(row) {
  const owner = scope.value
  try { await downloadInquiryOriginal(row.id, row.file_name, { isCurrent: () => alive && owner === scope.value && allowed('download') }) }
  catch (failure) { if (alive && owner === scope.value) error.value = failure.message || '原件下载失败' }
}
function rangeText(rule, factors) {
  const range = rule?.range
  if (!range) return ''
  const factorName = factors?.[range.factorKey]?.factorName
    || (range.factorKey === 'AVG|1#CU' ? '1#电解铜' : range.factorKey)
  return `${factorName}（${range.marketUnit}）：` + range.bands.map(band =>
    `[${band.lower}, ${band.upper ?? '∞'})：${band.price}元`).join('；')
}
async function voidImport(row) {
  const owner = scope.value
  try {
    await ElMessageBox.confirm(`失效“${row.file_name}”整批${row.row_count}组询价？失效后不再参与取价，历史成本保留，之后可重新导入正确文件。`, '失效本次导入', {
      type: 'warning', confirmButtonText: '确认失效', cancelButtonText: '取消',
    })
    if (!alive || scope.value !== owner || !allowed('import')) return
    voidBusyId.value = row.id
    await voidInquiryImport(row.id)
    if (alive && scope.value === owner) { ElMessage.success('本次导入已失效，不再参与取价'); await load() }
  } catch (failure) {
    if (alive && scope.value === owner && failure !== 'cancel' && failure !== 'close')
      ElMessage.error(failure?.message || '失效失败，请刷新后重试')
  } finally { voidBusyId.value = null }
}
</script>
<style scoped>
.inquiry-page { padding: 20px; }.heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; } h2 { margin: 0; }.heading p, .hint { color: #606266; font-size: 14px; }.el-pagination, .el-alert, .factors, .original { margin-top: 16px; }
</style>
