<template>
  <section class="costing-preparation" aria-label="资料情况" :aria-busy="!state && !error">
    <div class="preparation-head">
      <div class="preparation-title"><strong>资料情况</strong>
        <span :class="{ 'is-error': error }" role="status">{{ error || (pendingCount ? `${pendingCount} 个产品待处理，资料齐全的产品可继续核算` : state?.message) || '正在读取资料状态…' }}</span>
      </div>
      <div class="preparation-actions">
        <el-button v-if="state?.hasSupplement" link type="primary" @click="viewSupplement">补录工作台</el-button>
        <el-button link @click="$emit('refresh')">刷新</el-button>
      </div>
    </div>
    <div v-if="pendingCount" class="gap-categories">
      <article v-for="category in categories" :key="category.value" class="gap-category">
        <div><strong>{{ category.title }}</strong><p>{{ category.hint }}</p></div>
        <div class="category-actions">
          <el-button link type="primary" :aria-label="`查看${category.exportTitle}物料`" @click="viewDetails(category)">查看明细</el-button>
          <el-button :loading="exporting === category.value" :disabled="Boolean(exporting)" @click="$emit('export-gap', category.value)">{{ `导出${category.exportTitle}物料` }}</el-button>
        </div>
      </article>
    </div>
    <el-dialog v-model="detail.visible" :title="detail.title + '明细'" width="1200px" style="max-width:94vw" destroy-on-close>
      <el-alert v-if="detail.error" :title="detail.error" type="error" :closable="false" />
      <p class="detail-summary">{{ detail.loading ? '正在整理物料…' : `${detail.rows.length} 种物料，已按料号去重` }}</p>
      <el-table v-loading="detail.loading" :data="detail.rows" row-key="materialCode" border max-height="520" empty-text="本次检查没有此类待处理物料">
        <el-table-column prop="materialCode" label="料号" width="155" />
        <el-table-column prop="materialName" label="名称" min-width="130" />
        <el-table-column prop="model" label="型号" min-width="130"><template #default="{ row }">{{ row.model || '—' }}</template></el-table-column>
        <el-table-column prop="specification" label="规格" min-width="150"><template #default="{ row }">{{ row.specification || '—' }}</template></el-table-column>
        <el-table-column prop="reason" label="待处理原因" min-width="290" show-overflow-tooltip />
        <el-table-column label="影响产品" width="100" align="center"><template #default="{ row }"><el-tooltip :content="row.affectedProducts.join('、')"><span>{{ row.affectedProducts.length }} 个</span></el-tooltip></template></el-table-column>
        <el-table-column label="操作" width="155"><template #default="{ row }">
          <el-button v-if="row.sourceChecks?.length" link type="primary" @click="sourceDetail = row">来源核对</el-button>
          <el-button link type="primary" @click="viewProduct(row)">查看产品</el-button>
        </template></el-table-column>
      </el-table>
      <template #footer><el-button @click="detail.visible = false">关闭</el-button></template>
    </el-dialog>
    <el-dialog :model-value="Boolean(sourceDetail)" :title="`${sourceDetail?.materialCode || ''} 价格来源核对`" width="680px" style="max-width:94vw" @close="sourceDetail = null">
      <el-table :data="sourceDetail?.sourceChecks || []" border max-height="520">
        <el-table-column prop="source" label="价格来源" min-width="155" />
        <el-table-column prop="records" label="记录数" width="85" align="center" />
        <el-table-column prop="note" label="核对说明" min-width="260" />
      </el-table>
    </el-dialog>
  </section>
</template>
<script setup>
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { hasQuoteItemCostingGap } from '../../utils/quoteItemWorkflow'
import { fetchQuoteCostingGapDetails } from '../../api/quoteRequests'
const props = defineProps({ oaNo: String, state: Object, checks: { type: Array, default: () => [] }, products: { type: Array, default: () => [] }, error: String, exporting: String })
const emit = defineEmits(['refresh', 'view-gap', 'export-gap'])
const router = useRouter()
const categories = [
  { value: 'RATIO', title: '供货比率待补', exportTitle: '缺供货比率', hint: '导出填写供货比率，再到供货比率页面导入' },
  { value: 'PRICE', title: '价格待补', exportTitle: '缺价格', hint: '各价格来源均无记录，需要财务维护价格' },
  { value: 'OTHER', title: '其他待处理', exportTitle: '其他原因', hint: '有价未采用、重量或其他资料问题' },
]
const pendingCount = computed(() => new Set([
  ...props.products.filter(hasQuoteItemCostingGap).map(row => String(row.id)),
  ...props.checks.filter(row => !['READY', 'SUCCESS'].includes(row.pipelineStatus)).map(row => String(row.oaFormItemId)),
]).size)
const detail = reactive({ visible: false, title: '', rows: [], loading: false, error: '' })
const sourceDetail = ref(null)
let generation = 0
watch(() => props.oaNo, () => { generation++; detail.visible = false; sourceDetail.value = null })
onScopeDispose(() => { generation++ })
async function viewDetails(category) {
  const version = ++generation, number = props.oaNo
  sourceDetail.value = null
  Object.assign(detail, { visible: true, title: category.title, rows: [], loading: true, error: '' })
  try {
    const result = await fetchQuoteCostingGapDetails(number, category.value)
    if (version === generation && props.oaNo === number) detail.rows = result?.records || []
  } catch (failure) {
    if (version === generation) detail.error = failure?.message || '物料明细读取失败，请重试'
  } finally { if (version === generation) detail.loading = false }
}
function viewProduct(row) {
  const product = props.products.find(item => String(item.id) === String(row.firstItemId))
  emit('view-gap', product || { id: row.firstItemId, materialNo: row.affectedProducts[0] })
}
function viewSupplement() { router.push({ path: '/collaboration/tasks', query: { oaNo: props.oaNo } }) }
</script>
<style scoped>
.costing-preparation { margin: 16px 0; padding: 18px 20px; border: 1px solid #dfe6ee; border-radius: 8px; background: #fff; font-size: 14px; }
.preparation-head, .preparation-title, .preparation-actions, .category-actions { display: flex; align-items: center; gap: 12px; }
.preparation-head { justify-content: space-between; flex-wrap: wrap; }
.preparation-title { flex-wrap: wrap; color: #606c80; }
.preparation-title strong { color: #303133; font-size: 15px; }
.is-error { color: #c45656; }
.gap-categories { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.gap-category { padding: 16px; background: #f8fafc; border: 1px solid #e5eaf0; border-radius: 6px; }
.gap-category strong { color: #303133; }
.gap-category p { margin: 8px 0 16px; font-size: 13px; color: #7b8798; line-height: 1.5; }
.category-actions { justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.category-actions .el-button { margin: 0; }
.detail-summary { margin-top: 0; color: #606c80; }
@media (max-width: 1000px) { .gap-categories { grid-template-columns: 1fr; } .gap-category { display: flex; justify-content: space-between; align-items: center; gap: 12px; } .gap-category p { margin: 6px 0 0; } }
</style>
