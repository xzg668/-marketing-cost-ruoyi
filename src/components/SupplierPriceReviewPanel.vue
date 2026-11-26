<template>
  <section v-if="reviews.length || pendingReviews.length" class="supplier-review">
    <div class="supplier-review__heading">
      <h3>供货比率确认</h3>
      <span v-if="repricing" role="status">选择已保存，正在重新取价…</span>
      <span v-if="refreshing">导入已完成，正在自动取价…</span>
      <el-button v-if="canConfirm && !readonly && reviews.length > 1"
        :disabled="checkedRows.length < 2 || saving || repricing" @click="openBatch">批量确认</el-button>
      <el-button v-hasPermi="['ingest:quote:list']" type="primary" plain
        :loading="exporting" :disabled="readonly" @click="exportRatios">导出供货比率补齐表</el-button>
    </div>
    <p class="supplier-review__help">导出包含各物料的完整供应商集合及已有比率，补齐后可到供货比率表导入；型号未维护时留空。</p>
    <el-alert v-if="confirmationNotice" :title="confirmationNotice" type="warning" show-icon :closable="false" />
    <el-button v-if="pendingReviews.length && !repricing && !readonly && canConfirm"
      type="primary" link @click="retryReprice">重试取价</el-button>
    <el-table :data="tableRows" border @selection-change="checkedRows = $event">
      <el-table-column v-if="canConfirm && !readonly && reviews.length > 1" type="selection" width="45" :selectable="canSelect" />
      <el-table-column label="物料代码" min-width="170">
        <template #default="{ row }">{{ row.scope.materialCode }}</template>
      </el-table-column>
      <el-table-column prop="materialName" label="名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="specification" label="规格" min-width="180" show-overflow-tooltip />
      <el-table-column prop="model" label="型号" min-width="180" show-overflow-tooltip />
      <el-table-column label="说明" min-width="300">
        <template #default="{ row }">{{ row.message }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'FALLBACK_HIGH'" type="warning" effect="plain">已确认按最高价取价</el-tag>
          <template v-else-if="row.status === 'WAIT_IMPORT'">
          <el-button link type="primary" :disabled="readonly || repricing" @click="openReview(row)">查看供应商</el-button>
          <el-button v-hasPermi="['base:supplier-supply-ratio:import']"
            link type="primary" :disabled="readonly || repricing" @click="importVisible = true">导入供货比率</el-button>
          </template>
          <el-button v-else v-hasPermi="['ingest:quote:cost-run:execute']" link type="primary"
            :disabled="readonly || repricing" @click="openReview(row)">供货比率新增审核</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="tableRows.some(row => row.status === 'FALLBACK_HIGH')" class="supplier-review__note">已确认按最高价取价，请关注成本偏高风险。</p>

    <el-dialog v-model="confirmVisible" title="供货比率新增审核" width="720px" :close-on-click-modal="false">
      <div v-for="review in selected" :key="review.scopeKey">
        <p class="supplier-review__material">物料 {{ review.scope.materialCode }} · {{ review.scope.pricingDate }}</p>
        <p class="supplier-review__material">{{ review.materialName || '名称未维护' }} · 规格：{{ review.specification || '未维护' }} · 型号：{{ review.model || '未维护' }}</p>
        <el-table :data="review.candidates" border>
          <el-table-column label="供应商" min-width="210">
            <template #default="{ row }">{{ row.price.supplierName || row.price.supplierCode }}</template>
          </el-table-column>
          <el-table-column label="有效价格" width="135" align="right">
            <template #default="{ row }">{{ row.price.unitPrice }}</template>
          </el-table-column>
          <el-table-column label="供货比率" width="125" align="right">
            <template #default="{ row }">{{ formatPercent(row.supplyRatio) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <template v-if="selected.length">
        <p>{{ selected.length > 1 ? '对所选物料应用同一选择。是否有新增审核？' : '现有供货比率无法确定取价，是否有新增审核？' }}</p>
        <el-radio-group v-model="choice" class="supplier-review__choices">
          <el-radio :value="true">有，导入供货比率后自动取价</el-radio>
          <el-radio :value="false">无，按以上供应商的最高价取价</el-radio>
        </el-radio-group>
      </template>
      <template #footer>
        <el-button :disabled="saving" @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :disabled="choice === null || !canConfirm" :loading="saving" @click="confirm">确认</el-button>
      </template>
    </el-dialog>
    <SupplierSupplyRatioImportDialog v-model="importVisible" close-on-success @imported="onImported" />
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveSupplierPriceReviews, repriceSavedSupplierReviews, fetchPendingSupplierReprice, exportQuoteSupplierRatios, fetchQuotePricePrepare } from '../api/quoteRequests'
import { formatPercent } from '../utils/supplierSupplyRatio'
import SupplierSupplyRatioImportDialog from './SupplierSupplyRatioImportDialog.vue'

const props = defineProps({
  oaNo: { type: String, required: true },
  itemId: { type: [String, Number], required: true },
  periodMonth: { type: String, required: true },
  reviews: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] },
  readonly: Boolean,
  canConfirm: Boolean,
  prepareNo: { type: String, default: '' },
})
const emit = defineEmits(['updated'])
const selected = ref([])
const checkedRows = ref([])
const choice = ref(null)
const confirmVisible = ref(false)
const importVisible = ref(false)
const saving = ref(false)
const repricing = ref(false)
const pendingReviews = ref([])
const refreshing = ref(false)
const exporting = ref(false)
const confirmedReviews = ref([])
const confirmationNotice = ref('')
const tableRows = computed(() => {
  const materials = new Map(props.materials.map(material => [material.scopeKey, material]))
  return props.reviews.map(review => {
    const confirmed = confirmedReviews.value.find(saved => saved.scopeKey === review.scopeKey
      && saved.fingerprint === review.fingerprint)
    return { ...review, ...materials.get(review.scopeKey), ...(confirmed ? {
      status: confirmed.decision,
      message: confirmed.decision === 'FALLBACK_HIGH' ? '已确认按最高价取价' : '已确认新增审核，等待导入供货比率',
    } : {}) }
  })
})
let exportController
let timer
let disposed = false
let importStartedAt = 0
let confirmationGeneration = 0
const currentScope = () => JSON.stringify([props.oaNo, String(props.itemId), props.periodMonth])

async function exportRatios() {
  const scope = JSON.stringify([props.oaNo, String(props.itemId), props.periodMonth])
  exportController?.abort()
  const controller = new AbortController()
  exportController = controller
  exporting.value = true
  const isCurrent = () => !disposed && !props.readonly
    && scope === JSON.stringify([props.oaNo, String(props.itemId), props.periodMonth])
  try {
    await exportQuoteSupplierRatios(props.oaNo, props.itemId, props.periodMonth, {
      signal: controller.signal, isCurrent,
    })
  } catch (error) {
    if (!controller.signal.aborted && isCurrent()) ElMessage.error(error.message || '导出失败，请重试')
  } finally {
    if (exportController === controller) exporting.value = false
  }
}

function canSelect(row) {
  return row.status !== 'FALLBACK_HIGH' && !saving.value && !repricing.value
}

function openReview(row) {
  if (props.readonly || saving.value || repricing.value) return
  selected.value = [row]
  choice.value = null
  confirmVisible.value = true
}

function openBatch() {
  const rows = checkedRows.value.filter(canSelect)
  if (props.readonly || !props.canConfirm || rows.length < 2) return
  if (new Set(rows.map(row => row.scope.pricingDate)).size !== 1) {
    ElMessage.warning('请选择同一取价日期的物料')
    return
  }
  selected.value = rows
  choice.value = null
  confirmVisible.value = true
}

function confirmationContext() {
  const scope = currentScope()
  const generation = confirmationGeneration
  return {
    oaNo: props.oaNo,
    itemId: props.itemId,
    periodMonth: props.periodMonth,
    isCurrent: () => !disposed && generation === confirmationGeneration && scope === currentScope(),
  }
}

function showSaved(saved) {
  const keys = new Set(saved.map(row => row.scopeKey))
  confirmedReviews.value = [...confirmedReviews.value.filter(row => !keys.has(row.scopeKey)), ...saved]
}

async function confirm() {
  if (props.readonly || !props.canConfirm || saving.value || repricing.value
    || !selected.value.length || choice.value === null) return
  const context = confirmationContext()
  const hasNewApproval = choice.value
  saving.value = true
  let saved
  try {
    saved = await saveSupplierPriceReviews(context.oaNo, context.itemId, selected.value.map(review => ({
      periodMonth: context.periodMonth,
      scopeKey: review.scopeKey,
      fingerprint: review.fingerprint,
      hasNewApproval,
      pricingDate: review.scope.pricingDate,
    })))
    if (!Array.isArray(saved) || !saved.length || saved.some(row => !row.decisionId)) {
      throw new Error('确认结果暂未取得，请刷新后核对已保存的选择')
    }
  } catch (error) {
    if (context.isCurrent()) ElMessage.error(error.message || '确认失败，请重试')
    return
  } finally {
    if (context.isCurrent()) saving.value = false
  }
  if (context.isCurrent()) {
    showSaved(saved)
    checkedRows.value = []
    confirmVisible.value = false
  }
  await reprice(saved, context, hasNewApproval)
}

async function reprice(saved, context, openImport = false) {
  if (context.isCurrent()) {
    pendingReviews.value = saved
    repricing.value = true
    confirmationNotice.value = ''
  }
  try {
    const result = await repriceSavedSupplierReviews(context.oaNo, context.itemId, saved.map(row => row.decisionId))
    if (!context.isCurrent()) return
    pendingReviews.value = []
    if (result?.workbench) {
      if (result.repriceStatus === 'COMPLETED') emit('updated', result.workbench)
      else emit('updated', result.workbench, false)
    }
    if (openImport && !props.readonly) importVisible.value = true
  } catch (error) {
    if (context.isCurrent()) {
      confirmationNotice.value = '选择已保存，重新取价未完成。' + (error.message || '')
      if (openImport && !props.readonly) importVisible.value = true
    }
  } finally {
    if (context.isCurrent()) repricing.value = false
  }
}

function retryReprice() {
  if (props.readonly || !props.canConfirm || repricing.value || !pendingReviews.value.length) return
  return reprice(pendingReviews.value, confirmationContext())
}

async function restorePendingReprice() {
  const context = confirmationContext()
  if (props.readonly || !props.canConfirm || saving.value || repricing.value || pendingReviews.value.length
    || !context.oaNo || !context.itemId || !context.periodMonth) return
  let saved
  try {
    saved = await fetchPendingSupplierReprice(context.oaNo, context.itemId, context.periodMonth)
  } catch {
    return
  }
  if (!context.isCurrent() || props.readonly || saving.value || repricing.value || pendingReviews.value.length
    || !saved?.length) return
  showSaved(saved)
  await reprice(saved, context)
}

function onImported() {
  refreshing.value = true
  importStartedAt = Date.now()
  schedulePoll(500)
}

function schedulePoll(delay = 3000) {
  clearTimeout(timer)
  if (!disposed && !props.readonly && tableRows.value.some(row => row.status === 'WAIT_IMPORT')) {
    timer = setTimeout(poll, delay)
  }
}

async function poll() {
  try {
    const result = await fetchQuotePricePrepare(props.oaNo, props.itemId, { periodMonth: props.periodMonth })
    if (disposed) return
    const changed = (result.oaScenario?.batch?.prepareNo || '') !== props.prepareNo
      || JSON.stringify(result.supplierPriceReviews || []) !== JSON.stringify(props.reviews)
    if (changed) {
      emit('updated', result)
      if (refreshing.value) {
        refreshing.value = false
        const waiting = result.supplierPriceReviews?.some(row => row.status === 'WAIT_IMPORT')
        if (waiting) ElMessage.warning('供货比率仍不足，请补充未填写的供应商比率')
        else ElMessage.success('已自动取价，工作台已更新')
      }
    }
  } catch (error) {
    if (refreshing.value) {
      refreshing.value = false
      ElMessage.error(error.message || '自动取价结果暂未获取，请稍后查看')
    }
  } finally {
    if (refreshing.value && Date.now() - importStartedAt > 60000) {
      refreshing.value = false
      ElMessage.warning('导入已成功，自动取价尚未完成，请稍后查看工作台')
    }
    schedulePoll()
  }
}

watch(currentScope, () => {
  confirmationGeneration++
  confirmedReviews.value = []
  confirmationNotice.value = ''
  selected.value = []
  checkedRows.value = []
  pendingReviews.value = []
  repricing.value = false
  confirmVisible.value = false
  importVisible.value = false
  saving.value = false
})
watch(() => [currentScope(), props.readonly, props.canConfirm], restorePendingReprice, { immediate: true })
watch(() => props.reviews, () => schedulePoll(), { immediate: true })
onUnmounted(() => { disposed = true; clearTimeout(timer); exportController?.abort() })
</script>

<style scoped>
.supplier-review { margin: 16px 0; }
.supplier-review__heading { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; }
.supplier-review__heading h3 { margin: 0; font-size: 15px; font-weight: 600; }
.supplier-review__heading span, .supplier-review__material { color: #606266; font-size: 13px; }
.supplier-review__choices { display: flex; flex-direction: column; align-items: flex-start; }
.supplier-review__note { color: #a66a14; font-size: 13px; margin: 10px 0 0; }
.supplier-review__help { color: #606266; font-size: 13px; line-height: 1.6; }
</style>
