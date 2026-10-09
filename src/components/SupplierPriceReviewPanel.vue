<template>
  <section v-if="reviews.length" class="supplier-review">
    <div class="supplier-review__heading">
      <h3>供货比率确认</h3>
      <span v-if="refreshing">导入已完成，正在自动取价…</span>
    </div>
    <el-table :data="reviews" border>
      <el-table-column label="物料代码" min-width="170">
        <template #default="{ row }">{{ row.scope.materialCode }}</template>
      </el-table-column>
      <el-table-column label="说明" min-width="300">
        <template #default="{ row }">{{ row.message }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'FALLBACK_HIGH'" type="warning" effect="plain">已确认按最高价取价</el-tag>
          <template v-else-if="row.status === 'WAIT_IMPORT'">
          <el-button link type="primary" :disabled="readonly" @click="openReview(row)">查看供应商</el-button>
          <el-button v-hasPermi="['base:supplier-supply-ratio:import']"
            link type="primary" :disabled="readonly" @click="importVisible = true">导入供货比率</el-button>
          </template>
          <el-button v-else v-hasPermi="['ingest:quote:cost-run:execute']" link type="primary"
            :disabled="readonly" @click="openReview(row)">供货比率新增审核</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="reviews.some(row => row.status === 'FALLBACK_HIGH')" class="supplier-review__note">已按最高价取价，请关注成本偏高风险。</p>

    <el-dialog v-model="confirmVisible" title="供货比率新增审核" width="720px" :close-on-click-modal="false">
      <template v-if="selected">
        <p class="supplier-review__material">物料 {{ selected.scope.materialCode }} · {{ selected.scope.pricingDate }}</p>
        <el-table :data="selected.candidates" border>
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
        <p>现有供货比率无法确定取价，是否有新增审核？</p>
        <el-radio-group v-model="choice" class="supplier-review__choices">
          <el-radio :value="true">有，导入供货比率后自动取价</el-radio>
          <el-radio :value="false">无，按以上供应商的最高价取价</el-radio>
        </el-radio-group>
      </template>
      <template #footer>
        <el-button :disabled="saving" @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :disabled="choice === null" :loading="saving" @click="confirm">确认</el-button>
      </template>
    </el-dialog>
    <SupplierSupplyRatioImportDialog v-model="importVisible" close-on-success @imported="onImported" />
  </section>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { confirmSupplierPriceReview, fetchQuotePricePrepare } from '../api/quoteRequests'
import { formatPercent } from '../utils/supplierSupplyRatio'
import SupplierSupplyRatioImportDialog from './SupplierSupplyRatioImportDialog.vue'

const props = defineProps({
  oaNo: { type: String, required: true },
  itemId: { type: [String, Number], required: true },
  periodMonth: { type: String, required: true },
  reviews: { type: Array, default: () => [] },
  readonly: Boolean,
  prepareNo: { type: String, default: '' },
})
const emit = defineEmits(['updated'])
const selected = ref(null)
const choice = ref(null)
const confirmVisible = ref(false)
const importVisible = ref(false)
const saving = ref(false)
const refreshing = ref(false)
let timer
let disposed = false
let importStartedAt = 0

function openReview(row) {
  selected.value = row
  choice.value = null
  confirmVisible.value = true
}

async function confirm() {
  saving.value = true
  try {
    const result = await confirmSupplierPriceReview(props.oaNo, props.itemId, {
      periodMonth: props.periodMonth,
      scopeKey: selected.value.scopeKey,
      fingerprint: selected.value.fingerprint,
      hasNewApproval: choice.value,
      pricingDate: selected.value.scope.pricingDate,
    })
    emit('updated', result)
    confirmVisible.value = false
    if (choice.value) importVisible.value = true
    else ElMessage.success('已按最高价取价')
  } catch (error) {
    ElMessage.error(error.message || '确认失败，请重试')
  } finally {
    saving.value = false
  }
}

function onImported() {
  refreshing.value = true
  importStartedAt = Date.now()
  schedulePoll(500)
}

function schedulePoll(delay = 3000) {
  clearTimeout(timer)
  if (!disposed && !props.readonly && props.reviews.some(row => row.status === 'WAIT_IMPORT')) {
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

watch(() => props.reviews, () => schedulePoll(), { immediate: true })
onUnmounted(() => { disposed = true; clearTimeout(timer) })
</script>

<style scoped>
.supplier-review { margin: 16px 0; }
.supplier-review__heading { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; }
.supplier-review__heading h3 { margin: 0; font-size: 15px; font-weight: 600; }
.supplier-review__heading span, .supplier-review__material { color: #606266; font-size: 13px; }
.supplier-review__choices { display: flex; flex-direction: column; align-items: flex-start; }
.supplier-review__note { color: #a66a14; font-size: 13px; margin: 10px 0 0; }
</style>
