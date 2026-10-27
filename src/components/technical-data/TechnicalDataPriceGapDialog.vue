<template>
  <el-dialog :model-value="true" title="价格缺口明细" width="1100px" top="5vh" @close="$emit('close')">
    <p>{{ row.product.materialNo || row.product.sourceModel }} · {{ row.product.productName }} · {{ row.accountingMonth }}</p>
    <p>{{ row.oaNo }}</p>
    <div v-loading="loading" class="price-gap-content">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <template v-else-if="result">
        <p>共 {{ gaps.length }} 项：待确认供货比率 {{ ratioCount }} 项，其他价格缺口 {{ gaps.length - ratioCount }} 项</p>
        <el-alert v-if="typeError" title="价格类型暂未加载完整，可进入产品取价检查核对。" type="warning" :closable="false" />
        <el-table v-if="gaps.length" :data="gaps" border max-height="55vh">
          <el-table-column label="料号" min-width="140"><template #default="{ row: gap }">{{ gap.gapMaterialCode || gap.materialCode || '—' }}</template></el-table-column>
          <el-table-column prop="materialName" label="物料名称" min-width="160" />
          <el-table-column label="价格类型" width="120"><template #default="{ row: gap }">{{ typeLabel(gap) }}</template></el-table-column>
          <el-table-column label="待处理事项" width="160"><template #default="{ row: gap }">{{ needsRatio(gap) ? '供货比率待确认' : '价格来源待补齐' }}</template></el-table-column>
          <el-table-column prop="message" label="原因" min-width="280" />
        </el-table>
        <el-empty v-else description="当前没有价格缺口" />
        <p class="hint">供货比率待确认的物料，请在产品取价检查中处理；其他缺口先核对当月适用价格源，仍无可用价格时再补录。</p>
      </template>
    </div>
    <template #footer>
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button v-if="error" :loading="loading" @click="load">重试</el-button>
      <el-button v-if="gaps.some(gap => gap.gapType === 'MISSING_PRICE' && !needsRatio(gap))" @click="$emit('open-price-form')">查看价格填写页</el-button>
      <el-button type="primary" @click="$emit('open-costing')">进入产品取价检查</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { checkQuotePriceSources, fetchQuotePriceTypeRecognition } from '../../api/quoteRequests'
import { isSupplierRatioGap } from '../../utils/priceSourceGaps'

const props = defineProps({ row: { type: Object, required: true } })
defineEmits(['close', 'open-costing', 'open-price-form'])
const result = ref(null), types = ref([]), loading = ref(false), error = ref(''), typeError = ref(false)
const gaps = computed(() => result.value?.gaps?.records || [])
const reviews = computed(() => (result.value?.supplierPriceReviews || []).filter(review => review.status !== 'FALLBACK_HIGH'))
const reviewFor = gap => reviews.value.find(review => review.scope?.materialCode === (gap.gapMaterialCode || gap.materialCode))
const needsRatio = gap => isSupplierRatioGap(gap, reviews.value)
const ratioCount = computed(() => gaps.value.filter(needsRatio).length)
const typesByCode = computed(() => {
  const map = new Map()
  function visit(rows) {
    for (const row of rows) {
      if (row.materialCode && row.priceType) {
        const values = map.get(row.materialCode) || new Set()
        values.add(row.priceType); map.set(row.materialCode, values)
      }
      visit(row.children || [])
    }
  }
  visit(types.value)
  return map
})
function typeLabel(gap) {
  const values = typesByCode.value.get(gap.gapMaterialCode || gap.materialCode)
  const type = gap.priceType || reviewFor(gap)?.scope?.priceType || (values?.size === 1 ? [...values][0] : '')
  return ({ FIXED: '固定价', PURCHASE_FIXED: '固定价', LINKED: '联动价', RANGE: '区间价', SETTLE_FIXED: '结算固定价', SETTLE_LINKED: '结算联动价' })[type] || type || '待核对'
}
let generation = 0
async function load() {
  const current = ++generation
  const row = props.row
  loading.value = true; result.value = null; types.value = []; error.value = ''; typeError.value = false
  // 检查接口只读预览当前候选，不生成价格批次、采用月价或创建补录任务。
  const [check, recognition] = await Promise.allSettled([
    checkQuotePriceSources(row.oaNo, row.product.oaFormItemId, { periodMonth: row.accountingMonth, refreshCandidates: true }),
    fetchQuotePriceTypeRecognition(row.oaNo, row.product.oaFormItemId, { periodMonth: row.accountingMonth }),
  ])
  if (current !== generation) return
  if (check.status === 'fulfilled' && check.value?.readiness?.status === 'FAILED') error.value = check.value.readiness.message || '价格检查失败，请重试'
  else if (check.status === 'fulfilled') result.value = check.value
  else error.value = check.reason?.message || '价格缺口加载失败，请重试'
  if (recognition.status === 'fulfilled') types.value = recognition.value?.rows || []
  else typeError.value = true
  loading.value = false
}
watch(() => props.row, load, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<style scoped>
p { margin: 8px 0 12px; color: #596a80; }
.price-gap-content { min-height: 100px; }
.el-alert { margin-bottom: 12px; }
.hint { font-size: 13px; line-height: 1.7; }
</style>
