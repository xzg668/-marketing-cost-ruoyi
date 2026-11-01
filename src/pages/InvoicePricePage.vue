<template>
  <div class="invoice-page">
    <el-card>
      <template #header>
        <div class="heading"><div><h2>发票价格</h2><p>按料件取最新导入批次，同批次适用发票取最高未税单价。新导入用于后续核算，历史核算结果保留。</p></div>
          <el-button v-if="allowed('import')" type="primary" @click="openImport">导入发票价格</el-button></div>
      </template>
      <el-form inline @submit.prevent="search">
        <el-form-item label="取价组织"><el-select v-model="orgCode" aria-label="取价组织" style="width:160px" :disabled="session.state.busy"><el-option label="商用（210）" value="210" /><el-option label="板换（220）" value="220" /></el-select></el-form-item>
        <el-form-item label="料号"><el-input v-model="materialCode" placeholder="输入精确料号" clearable @keyup.enter="search" /></el-form-item>
        <el-button @click="search">查询</el-button><el-button @click="load">刷新</el-button>
      </el-form>
      <el-tabs v-model="mode" @tab-change="search"><el-tab-pane label="当前发票记录" name="current" /><el-tab-pane v-if="allowed('query')" label="导入历史" name="history" /></el-tabs>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="mode === 'current'">
        <p class="hint">显示各料件最新批次的发票记录。取价顺序：SRM固定价 → 阶梯价 → 发票价 → 订单价 → 询价。</p>
        <el-table :data="rows" v-loading="loading" border row-key="id" max-height="620" empty-text="暂无发票价格" aria-label="当前发票记录">
          <el-table-column prop="material_code" label="料号" min-width="155" /><el-table-column prop="material_name" label="名称" min-width="100" />
          <el-table-column prop="document_no" label="单据编号" min-width="165" /><el-table-column prop="supplier_code" label="供应商编码" min-width="125" />
          <el-table-column prop="supplier_name" label="供应商" min-width="180" show-overflow-tooltip /><el-table-column prop="unit_price" label="未税单价" min-width="180" :formatter="formatPrice" />
          <el-table-column prop="pricing_unit" label="单位" width="80" /><el-table-column prop="currency" label="币种" width="80" />
          <el-table-column prop="batch_id" label="导入批次" width="100" /><el-table-column prop="imported_at" label="导入时间" min-width="185" />
          <el-table-column v-if="allowed('query')" label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="showBatch(row.batch_id)">批次明细</el-button></template></el-table-column>
        </el-table>
      </template>
      <el-table v-else :data="rows" v-loading="loading" border row-key="id" empty-text="暂无导入记录" aria-label="发票导入历史">
        <el-table-column prop="id" label="批次" width="95" /><el-table-column prop="file_name" label="原文件" min-width="220" />
        <el-table-column prop="row_count" label="保存记录数" width="115" /><el-table-column prop="duplicate_count" label="批内合并数" width="115" />
        <el-table-column prop="created_by" label="导入人" min-width="115" /><el-table-column prop="created_at" label="导入时间" min-width="185" />
        <el-table-column label="操作" width="185"><template #default="{ row }"><el-button link type="primary" @click="showBatch(row.id)">明细</el-button><el-button v-if="allowed('download')" link @click="download(row)">下载原件</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="total" v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="load" />
    </el-card>
    <el-dialog v-model="importOpen" title="导入发票价格" width="1000px" :close-on-click-modal="false" :show-close="!session.state.busy" :close-on-press-escape="!session.state.busy" @closed="session.reset">
      <p>导入组织：{{ orgCode === '210' ? '商用（210）' : '板换（220）' }}。按表头读取，Sheet名称不限；同一发票按料号、单据编号、供应商编码去重。</p>
      <input :key="fileKey" type="file" accept=".xlsx,.xls" aria-label="选择发票Excel文件" :disabled="session.state.busy" @change="selectFile" />
      <el-alert v-if="session.state.error" :title="session.state.error" type="error" :closable="false" />
      <div v-if="session.state.preview" class="preview">
        <p>文件：{{ session.state.fileName }}；识别 {{ session.state.preview.sourceRows }} 行，保存 {{ session.state.preview.rows.length }} 条，合并重复 {{ session.state.preview.duplicateCount }} 条。</p>
        <p>工作表：{{ session.state.preview.sheets.join('、') }}</p>
        <el-table :data="session.state.preview.rows.slice(0, 100)" border max-height="360" aria-label="发票导入预览">
          <el-table-column prop="materialCode" label="料号" min-width="155" /><el-table-column prop="documentNo" label="单据编号" min-width="165" />
          <el-table-column prop="supplierCode" label="供应商编码" min-width="115" /><el-table-column prop="unitPrice" label="未税单价" min-width="165" />
          <el-table-column prop="unit" label="单位" width="80" /><el-table-column prop="currency" label="币种" width="80" />
          <el-table-column prop="sheetName" label="工作表" min-width="130" /><el-table-column prop="sourceRow" label="来源行" width="80" />
        </el-table>
        <p v-if="session.state.preview.rows.length > 100" class="hint">预览展示前100条，确认后导入全部校验通过的记录。</p>
      </div>
      <template #footer><el-button :disabled="session.state.busy" @click="importOpen = false">取消</el-button><el-button type="primary" :loading="session.state.busy" :disabled="!session.state.preview || !allowed('import')" @click="session.publish(orgCode)">确认导入</el-button></template>
    </el-dialog>
    <el-dialog v-model="detailOpen" :title="`发票批次 ${detailId} 明细`" width="1050px" destroy-on-close>
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <el-table :data="details" v-loading="detailLoading" border max-height="500" aria-label="发票批次历史明细">
        <el-table-column prop="materialCode" label="料号" min-width="155" /><el-table-column prop="documentNo" label="单据编号" min-width="160" />
        <el-table-column prop="supplierCode" label="供应商编码" min-width="115" /><el-table-column prop="supplierName" label="供应商" min-width="175" />
        <el-table-column prop="unitPrice" label="未税单价" min-width="165" /><el-table-column prop="unit" label="单位" width="75" />
        <el-table-column prop="currency" label="币种" width="75" /><el-table-column prop="voucherNo" label="凭证编号" min-width="180" />
        <el-table-column prop="sheetName" label="工作表" min-width="140" /><el-table-column prop="sourceRow" label="来源行" width="80" />
      </el-table>
    </el-dialog>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/modules/user'
import { fetchInvoicePrices, fetchInvoiceHistory, fetchInvoiceBatch, downloadInvoiceOriginal, invoiceImportApi } from '../api/invoicePrices'
import { createInvoiceImport } from './invoicePriceImport'
const user = useUserStore()
const allowed = permission => user.permissions.includes('*:*:*') || user.permissions.includes(`price:invoice:${permission}`)
const orgCode = ref('210'), materialCode = ref(''), mode = ref('current'), page = ref(1)
const rows = ref([]), total = ref(0), error = ref(''), loading = ref(false)
const importOpen = ref(false), fileKey = ref(0), detailOpen = ref(false), detailId = ref(null)
const details = ref([]), detailError = ref(''), detailLoading = ref(false)
const scope = computed(() => `${user.userId || ''}/${user.businessUnitType || ''}/${orgCode.value}`)
let listSequence = 0, detailSequence = 0, alive = true
const session = createInvoiceImport({ api: invoiceImportApi, scope: () => scope.value, onImported: result => {
  importOpen.value = false
  ElMessage.success(`导入成功：${result.rows}条，批次${result.batchId}`)
  mode.value = 'current'; page.value = 1; load()
} })
watch([scope, () => user.permissions.join(',')], () => {
  listSequence++; detailSequence++; session.reset(); importOpen.value = false; detailOpen.value = false
  rows.value = []; total.value = 0; details.value = []; page.value = 1
  if (!allowed('query')) mode.value = 'current'
  load()
}, { immediate: true })
onBeforeUnmount(() => { alive = false; listSequence++; detailSequence++; session.reset() })
async function load() {
  const ticket = ++listSequence, owner = scope.value
  if (!allowed('list') || mode.value === 'history' && !allowed('query')) return
  loading.value = true; error.value = ''; rows.value = []
  try {
    const fetch = mode.value === 'history' ? fetchInvoiceHistory : fetchInvoicePrices
    const result = await fetch({ orgCode: orgCode.value, materialCode: materialCode.value || undefined, page: page.value, size: 20 })
    if (alive && ticket === listSequence && owner === scope.value) { rows.value = result.records; total.value = result.total }
  } catch (failure) { if (alive && ticket === listSequence) { error.value = failure.message || '发票查询失败'; total.value = 0 } }
  finally { if (alive && ticket === listSequence) loading.value = false }
}
function search() { page.value = 1; load() }
function formatPrice(row, column, value) {
  const text = String(value ?? '')
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
function openImport() { session.reset(); fileKey.value++; importOpen.value = true }
function selectFile(event) { session.select(event.target.files?.[0]) }
async function showBatch(id) {
  if (!allowed('query')) return
  const ticket = ++detailSequence, owner = scope.value
  detailId.value = id; details.value = []; detailError.value = ''; detailOpen.value = true; detailLoading.value = true
  try { const result = await fetchInvoiceBatch(id); if (alive && ticket === detailSequence && owner === scope.value) details.value = result }
  catch (failure) { if (alive && ticket === detailSequence) detailError.value = failure.message || '历史明细读取失败' }
  finally { if (alive && ticket === detailSequence) detailLoading.value = false }
}
async function download(row) {
  const owner = scope.value
  try { await downloadInvoiceOriginal(row.id, row.file_name, { isCurrent: () => alive && owner === scope.value && allowed('download') }) }
  catch (failure) { if (alive && owner === scope.value) error.value = failure.message || '原件下载失败' }
}
</script>
<style scoped>
.invoice-page { padding: 20px; }.heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; } h2 { margin: 0; }.heading p, .hint { color: #606266; font-size: 14px; }.el-pagination, .preview, .el-alert { margin-top: 16px; }
</style>
