<template>
  <section class="entry-preview" :aria-label="`${moduleName(moduleType)}填写页预览`">
    <el-alert v-if="moduleType !== 'DRAWING_BOM' || bomAllowsEntry" :title="bomPreviewContext ? '可按技术员的方式查询参考BOM、试填用量或上传检查，使用相同校验；预览不会保存或提交资料。' : moduleType === 'MANUFACTURING' ? '当前账号只能查看。原材料、净长和毛重由负责技术员补录，提交后在此查看。' : '填写页只读预览，可切换填写方式查看字段；资料由负责技术员填写并提交。'" type="info" :closable="false" />
    <p v-if="reason && moduleType !== 'DRAWING_BOM'" class="gap-reason">{{ reason }}</p>
    <div v-loading="loading" class="preview-content">
      <template v-if="error">
        <el-alert :title="error" type="error" :closable="false" />
        <el-button @click="load">重试</el-button>
      </template>
      <TechnicalDataProfileForm v-else-if="moduleType === 'PROFILE'" :product="row.product" :editable="false" />
      <template v-else-if="moduleType === 'DRAWING_BOM' && !loading && bomPreviewState">
        <TechnicalCompleteBomForm v-if="bomAllowsEntry" :state="bomPreviewState" :preview-context="bomPreviewContext" preview />
        <template v-else>
          <el-alert :title="bomPreviewState.source.message" :type="bomPreviewState.source.state === 'UNCONFIRMED' ? 'warning' : 'info'" :closable="false" />
          <DrawingVerificationPanel v-if="bomPreviewState.source.state !== 'U9'" :key="drawingScopeKey"
            :oa-no="row.oaNo" :item-id="row.product.oaFormItemId" :accounting-month="row.accountingMonth" readonly @state-change="drawingChanged" />
          <el-table v-if="receivedRows.length" :data="receivedRows" border size="small" max-height="430" aria-label="本产品已接收图库明细">
            <el-table-column v-for="[field, label] in drawingColumns" :key="field" :label="label" :min-width="field === 'note' ? 140 : 95">
              <template #default="{ row: detail }">{{ drawingText(detail[field]) }}</template>
            </el-table-column>
          </el-table>
          <router-link :to="bomLocation" class="bom-link">{{ bomPreviewState.source.state === 'UNCONFIRMED' ? '前往报价继续处理' : '查看本产品BOM' }}</router-link>
          <el-button link type="primary" @click="load">刷新来源</el-button>
        </template>
      </template>
      <TechnicalDataManufacturingForm v-else-if="moduleType === 'MANUFACTURING'" :key="`${row.product.oaFormItemId}:${row.accountingMonth}`"
        :quote-item-id="row.product.oaFormItemId" :accounting-month="row.accountingMonth" :editable="false" />
      <component v-else-if="preview && formComponent" :is="formComponent" :key="moduleType" :preview-data="preview" :editable="false" />
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { checkQuotePriceSources, fetchQuoteCostingWorkbench } from '../../api/quoteRequests'
import { fetchQuoteBomPreviewSource } from '../../api/technicalDataTasks'
import { drawingColumns, drawingText } from '../../utils/drawingVerification'
import { priceEntryPreview } from '../../utils/technicalDataPrice'
import { findModule, moduleName } from '../../utils/technicalDataWorkbench'
import { useTechnicalDataIdentity } from '../../composables/useTechnicalDataIdentity'
import TechnicalDataProfileForm from './TechnicalDataProfileForm.vue'
import TechnicalCompleteBomForm from './TechnicalCompleteBomForm.vue'
import TechnicalDataManufacturingForm from './TechnicalDataManufacturingForm.vue'
import TechnicalDataPackageForm from './TechnicalDataPackageForm.vue'
import TechnicalDataAuxiliaryForm from './TechnicalDataAuxiliaryForm.vue'
import TechnicalDataSolderForm from './TechnicalDataSolderForm.vue'
import TechnicalDataSalaryForm from './TechnicalDataSalaryForm.vue'
import TechnicalDataNetLossForm from './TechnicalDataNetLossForm.vue'
import TechnicalDataPriceForm from './TechnicalDataPriceForm.vue'
import DrawingVerificationPanel from '../quotation/DrawingVerificationPanel.vue'

const props = defineProps({ row: { type: Object, required: true }, moduleType: { type: String, required: true } })
const user = useTechnicalDataIdentity()
const bomPreviewContext = computed(() => props.moduleType === 'DRAWING_BOM'
  && (user.roles?.includes('admin') || user.permissions?.some(permission => ['*:*:*', 'technical:data:admin:operate'].includes(permission)))
  ? { itemId: props.row.product.oaFormItemId, accountingMonth: props.row.accountingMonth } : undefined)
const forms = { PACKAGE: TechnicalDataPackageForm, AUXILIARY: TechnicalDataAuxiliaryForm,
  SOLDER: TechnicalDataSolderForm, SALARY: TechnicalDataSalaryForm, NET_LOSS: TechnicalDataNetLossForm, PRICE: TechnicalDataPriceForm }
const formComponent = computed(() => forms[props.moduleType])
const reason = computed(() => findModule(props.row.product, props.moduleType)?.requirementReason)
const bomPreviewState = ref(null), receivedRows = ref([])
const bomAllowsEntry = computed(() => !loading.value && !error.value && bomPreviewState.value?.source?.state === 'MISSING')
const drawingScopeKey = computed(() => JSON.stringify([props.row.oaNo, props.row.product.oaFormItemId, props.row.accountingMonth]))
const bomLocation = computed(() => ({ path: `/ingest/quote-requests/${encodeURIComponent(props.row.oaNo)}/items/${props.row.product.oaFormItemId}/costing`,
  query: { tab: 'PRODUCT_DETAIL', drawingBom: '1', periodMonth: props.row.accountingMonth } }))
function drawingChanged(state) {
  receivedRows.value = []
  if (state?.oaNo !== props.row.oaNo || String(state.itemId) !== String(props.row.product.oaFormItemId)
      || state.accountingMonth !== props.row.accountingMonth || state.current?.taskState !== 'RECEIVED'
      || state.receiptReadError || !state.sourceReceipt?.productGroupResolved
      || state.sourceReceipt.drawingNo !== state.current.drawingNo) return
  receivedRows.value = state.sourceReceipt.rows
}
const preview = ref(null), error = ref(''), loading = ref(false)
let generation = 0
async function load() {
  const current = ++generation, row = props.row
  error.value = ''; loading.value = false; bomPreviewState.value = null; receivedRows.value = []
  if (props.moduleType === 'DRAWING_BOM') {
    loading.value = true
    try {
      const state = await fetchQuoteBomPreviewSource(row.product.oaFormItemId, row.accountingMonth)
      if (current !== generation) return
      if (!['MISSING', 'U9', 'GALLERY', 'UNCONFIRMED'].includes(state?.source?.state)) throw new Error('BOM来源未返回明确结论，请重试')
      bomPreviewState.value = state
    } catch (cause) {
      if (current === generation) error.value = cause.message || 'BOM来源读取失败，请重试'
    } finally { if (current === generation) loading.value = false }
    return
  }
  // Unassigned products have no technical product ID. Display the real form's empty
  // fields without creating a task or reading somebody else's unpublished draft.
  preview.value = { editable: false, moduleStatus: 'PENDING', items: [], issues: [], priceRequirements: [] }
  if (props.moduleType !== 'PRICE') return
  preview.value = null; loading.value = true
  try {
    const [check, workbench] = await Promise.all([
      checkQuotePriceSources(row.oaNo, row.product.oaFormItemId, { periodMonth: row.accountingMonth, refreshCandidates: true }),
      fetchQuoteCostingWorkbench(row.oaNo, row.product.oaFormItemId),
    ])
    if (current !== generation) return
    if (check?.readiness?.status === 'FAILED') throw new Error(check.readiness.message || '价格检查失败，请重试')
    preview.value = priceEntryPreview(check, workbench)
  } catch (cause) {
    if (current === generation) error.value = cause.message || '价格填写页加载失败，请重试'
  } finally { if (current === generation) loading.value = false }
}
watch(() => [props.row, props.moduleType, props.row.oaNo, props.row.product.oaFormItemId, props.row.accountingMonth], load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
.gap-reason { color: #94622d; line-height: 1.7; }
.preview-content { min-height: 100px; margin-top: 20px; }
.bom-link { display: inline-block; margin: 16px 16px 0 0; color: #1765c1; }
</style>
