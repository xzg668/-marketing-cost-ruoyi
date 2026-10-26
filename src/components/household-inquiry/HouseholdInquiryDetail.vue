<template>
  <el-drawer v-model="visible" title="家用询价来源与版本" size="1100px" destroy-on-close>
    <el-alert title="这里展示保存的询价来源版本。来源更新不会改写已采用月价；历史原件始终来自该版本最初的发布批次。" type="info" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section v-if="selected" class="version-summary" aria-label="选定询价版本">
      <h3>{{ selected.materialCode }} · V{{ selected.revisionNo }}</h3>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称 / 规格">{{ selected.materialName }} / {{ selected.specification }}</el-descriptions-item>
        <el-descriptions-item label="来源年月">{{ selected.sourceMonth }}</el-descriptions-item>
        <el-descriptions-item label="原报价成本P">{{ inquiryDecimal(selected.unitPrice) }}</el-descriptions-item>
        <el-descriptions-item label="两项费用率H">{{ inquiryPercent(selected.householdRate) }}</el-descriptions-item>
        <el-descriptions-item label="来源价格口径">{{ selected.priceContext.unit }} / {{ selected.priceContext.currency }} / {{ inquiryTaxLabel(selected.priceContext.taxBasis) }}</el-descriptions-item>
        <el-descriptions-item label="原表行号">{{ selected.sourceRows.join('、') }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-actions" v-if="canDownload">
        <el-button :loading="financialLoading" @click="showFinancial">查看财务参考</el-button>
        <el-button :loading="downloading" @click="download">下载该版本原件</el-button>
      </div>
    </section>
    <h3>料号版本历史</h3>
    <el-table v-loading="loading" :data="history.rows" border row-key="id" aria-label="询价版本历史">
      <el-table-column label="版本" width="90"><template #default="{ row }">V{{ row.revisionNo }}</template></el-table-column>
      <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.current ? 'success' : 'info'">{{ row.current ? '当前来源' : '历史来源' }}</el-tag></template></el-table-column>
      <el-table-column prop="sourceMonth" label="来源年月" width="120" />
      <el-table-column label="原报价成本P" min-width="160"><template #default="{ row }">{{ inquiryDecimal(row.unitPrice) }}</template></el-table-column>
      <el-table-column label="两项费用率H" min-width="145"><template #default="{ row }">{{ inquiryPercent(row.householdRate) }}</template></el-table-column>
      <el-table-column prop="createdAt" label="版本创建时间" min-width="190" />
      <el-table-column label="操作" width="95"><template #default="{ row }"><el-button link type="primary" @click="selectVersion(row)">查看版本</el-button></template></el-table-column>
    </el-table>
    <el-pagination v-if="history.total" v-model:current-page="page" :page-size="20" :total="history.total" layout="total, prev, pager, next" @current-change="loadHistory" />
    <section v-if="financial && canDownload" aria-label="询价财务参考" class="financial-section">
      <h3>V{{ financial.price.revisionNo }} 财务参考与原格依据</h3>
      <p>原件：{{ financial.fileName }}；{{ rateEncodingLabel }}。以下字段仅供财务查看，不参与重算P或金属联动。</p>
      <el-table :data="references" border max-height="380">
        <el-table-column prop="column" label="列" width="65" /><el-table-column prop="header" label="原列头" min-width="150" />
        <el-table-column prop="value" label="原值" min-width="145" show-overflow-tooltip /><el-table-column prop="formula" label="原公式" min-width="140" show-overflow-tooltip />
        <el-table-column prop="typeLabel" label="类型" width="85" />
      </el-table>
      <el-collapse><el-collapse-item title="P/H原始单元格" name="inputs"><el-table :data="inputCells" border>
        <el-table-column prop="cell" label="来源坐标" width="100" /><el-table-column prop="value" label="原值" min-width="130" /><el-table-column prop="numberFormat" label="Excel格格式" min-width="130" show-overflow-tooltip /><el-table-column prop="formula" label="原公式" min-width="130" /><el-table-column prop="cachedType" label="公式缓存类型" min-width="120" />
      </el-table></el-collapse-item></el-collapse>
    </section>
  </el-drawer>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchHouseholdHistory, fetchHouseholdFinancial, downloadHouseholdOriginal } from '../../api/householdInquiries'
import { inquiryDecimal, inquiryPercent, inquiryTaxLabel, inquiryMessage } from '../../pages/householdInquiryUtils'
const visible = defineModel({ type: Boolean })
const props = defineProps({ entry: Object, scope: String, canDownload: Boolean })
const selected = ref(null), history = ref({ rows: [], total: 0 }), page = ref(1), error = ref(''), loading = ref(false), financialLoading = ref(false), downloading = ref(false), financial = ref(null)
let sequence = 0, financialSequence = 0, downloadSequence = 0, alive = true
onBeforeUnmount(() => { alive = false; sequence++; financialSequence++; downloadSequence++ })
const typeLabels = { NUMERIC: '数值', STRING: '文本', BLANK: '空白', FORMULA: '公式', ERROR: '错误', BOOLEAN: '布尔' }
const references = computed(() => Object.entries(financial.value?.evidence.source.financialReference || {}).map(([column, value]) => ({ column, ...value, typeLabel: typeLabels[value.type] || value.type })))
const inputCells = computed(() => financial.value?.evidence.source.cells.filter(cell => /^[EN]\d+$/.test(cell.cell)) || [])
const rateEncodingLabel = computed(() => ({ HEADER_PERCENTAGE_POINTS: 'H按列头百分点换算', TEXT_PERCENT: 'H按原文本百分号换算', EXCEL_RATIO: 'H按Excel百分比格式采用原比例' }[financial.value?.evidence.source.rateEncoding] || 'H按保存的归一依据采用'))
watch([visible, () => props.entry?.id, () => props.scope], ([open]) => {
  sequence++; financialSequence++; downloadSequence++; loading.value = false; financialLoading.value = false; downloading.value = false; history.value = { rows: [], total: 0 }; financial.value = null; error.value = ''; selected.value = null
  if (!open || !props.entry || !props.scope) return
  selected.value = props.entry; page.value = 1; loadHistory()
})
watch(() => props.canDownload, value => { if (!value) { financialSequence++; downloadSequence++; financial.value = null; financialLoading.value = false; downloading.value = false } }, { flush: 'sync' })
async function loadHistory() {
  if (!props.entry || !visible.value) return
  const ticket = ++sequence, scope = props.scope; loading.value = true; error.value = ''
  try { const result = await fetchHouseholdHistory({ materialCode: props.entry.materialCode, page: page.value, size: 20 }); if (ticket === sequence && scope === props.scope && visible.value) history.value = result }
  catch (failure) { if (ticket === sequence) error.value = inquiryMessage(failure) }
  finally { if (ticket === sequence) loading.value = false }
}
function selectVersion(row) { financialSequence++; downloadSequence++; financialLoading.value = false; downloading.value = false; selected.value = row; financial.value = null; error.value = '' }
async function financialForSelected() {
  if (!props.canDownload || !selected.value) return null
  const id = selected.value.id, scope = props.scope, ticket = ++financialSequence
  if (financial.value?.price.id === id) return financial.value
  financialLoading.value = true
  try {
    const result = await fetchHouseholdFinancial(id)
    if (ticket !== financialSequence || scope !== props.scope || !visible.value || !props.canDownload || selected.value?.id !== id) return null
    financial.value = result; return result
  } catch (failure) { if (ticket === financialSequence && scope === props.scope && visible.value && props.canDownload) throw failure; return null }
  finally { if (ticket === financialSequence) financialLoading.value = false }
}
async function showFinancial() { error.value = ''; try { await financialForSelected() } catch (failure) { error.value = inquiryMessage(failure) } }
async function download() {
  if (!props.canDownload || !selected.value) return
  const scope = props.scope, id = selected.value.id, ticket = ++downloadSequence; downloading.value = true; error.value = ''
  const isCurrent = () => alive && visible.value && scope === props.scope && props.canDownload && ticket === downloadSequence && selected.value?.id === id
  try { const detail = await financialForSelected(); if (detail && isCurrent()) await downloadHouseholdOriginal(id, detail.fileName, { isCurrent }) }
  catch (failure) { if (isCurrent()) error.value = inquiryMessage(failure) }
  finally { if (ticket === downloadSequence) downloading.value = false }
}
</script>
<style scoped>
.el-alert { margin-bottom: 14px; }.version-summary, .financial-section { margin-bottom: 20px; }.detail-actions { margin: 14px 0; }.el-pagination { margin-top: 16px; } p { font-size: 13px; color: #606266; } h3 { margin: 18px 0 12px; }
</style>
