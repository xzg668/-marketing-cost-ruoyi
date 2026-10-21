<template>
  <div class="base-page"><el-card>
    <template #header><div class="heading"><div><h2>结算铜锌基价</h2><p>独立维护结算铜价与锌价，商用和板换的普通基价在各自入口维护。</p></div><div>
      <el-button v-if="returnTo" @click="router.push(returnTo)">返回报价核算</el-button>
      <el-button @click="router.push({ path: '/price/settlement', query: { ...route.query, priceMonth: month } })">查看结算价格</el-button>
    </div></div></template>
    <el-form inline><el-form-item label="核算月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" :disabled="saving" @change="search" /></el-form-item><el-button :disabled="saving" @click="search">查询</el-button></el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section v-loading="loading">
      <el-alert v-if="!current && !loading" title="该月及以前暂无结算基价。完整重量的结算联动价需要先维护铜锌基价。" type="warning" :closable="false" />
      <el-descriptions v-if="current" :column="3" border>
        <el-descriptions-item label="实际基价月">{{ current.priceMonth }} <el-tag v-if="current.priceMonth !== month">沿用</el-tag></el-descriptions-item>
        <el-descriptions-item label="结算铜价">{{ displayDecimal(current.copperPrice) }} 元/千克</el-descriptions-item>
        <el-descriptions-item label="结算锌价">{{ displayDecimal(current.zincPrice) }} 元/千克</el-descriptions-item>
        <el-descriptions-item label="修订">第{{ current.revisionNo }}版</el-descriptions-item>
        <el-descriptions-item label="来源">{{ current.sourceKind === 'IMPORT_REFERENCE' ? '原稿参考价首次建立' : '财务维护' }}</el-descriptions-item>
        <el-descriptions-item label="维护依据">{{ current.changeReason }}</el-descriptions-item>
      </el-descriptions>
      <el-button v-hasPermi="['price:settlement-base:edit']" type="primary" class="edit-button" :disabled="loading || !!error" @click="edit">维护 {{ month }} 基价</el-button>
      <h3>{{ month }} 修订记录</h3>
      <el-table :data="history" border empty-text="本月尚未单独维护，可继续沿用以前月份">
        <el-table-column prop="revisionNo" label="版本" width="80" />
        <el-table-column label="铜价（元/千克）"><template #default="{ row }">{{ displayDecimal(row.copperPrice) }}</template></el-table-column>
        <el-table-column label="锌价（元/千克）"><template #default="{ row }">{{ displayDecimal(row.zincPrice) }}</template></el-table-column>
        <el-table-column prop="changeReason" label="维护依据" />
        <el-table-column prop="createdBy" label="维护人" />
        <el-table-column prop="createdAt" label="时间" width="200" />
      </el-table>
    </section>
    <el-dialog v-model="editOpen" :title="`维护 ${month} 结算铜锌基价`" width="520px" :close-on-click-modal="false" :before-close="close">
      <el-alert title="铜价与锌价作为一组保存。新增月份不改写旧月份或已确认核算底稿。" type="info" :closable="false" />
      <el-form label-width="100px" class="edit-form" :disabled="saving">
        <el-form-item label="输入单位"><el-select v-model="form.unit"><el-option label="元/千克" value="CNY/KG" /><el-option label="元/吨" value="CNY/T" /></el-select></el-form-item>
        <el-form-item label="结算铜价"><el-input v-model="form.copper" aria-label="结算铜价" /></el-form-item>
        <el-form-item label="结算锌价"><el-input v-model="form.zinc" aria-label="结算锌价" /></el-form-item>
        <el-form-item label="维护依据"><el-input v-model="form.reason" aria-label="基价维护依据" type="textarea" maxlength="1000" /></el-form-item>
      </el-form>
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      <template #footer><el-button :disabled="saving" @click="close">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存基价</el-button></template>
    </el-dialog>
  </el-card></div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchSettlementBase, fetchSettlementBaseHistory, saveSettlementBase } from '../api/settlementPrices'
import { settlementMonth, settlementReturnTo, displayDecimal, baseChange } from './settlementPriceUtils'
const route = useRoute(), router = useRouter()
const month = ref(settlementMonth(route.query)), current = ref(null), history = ref([]), loading = ref(false), error = ref(''), editOpen = ref(false), saving = ref(false), saveError = ref('')
const form = ref({ copper: '', zinc: '', unit: 'CNY/KG', reason: '' })
const returnTo = computed(() => settlementReturnTo(route.query.returnTo))
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true; error.value = ''; current.value = null; history.value = []
  try {
    const [base, revisions] = await Promise.all([fetchSettlementBase(month.value), fetchSettlementBaseHistory(month.value)])
    if (request === sequence) { current.value = base; history.value = revisions }
  } catch (e) { if (request === sequence) error.value = e.message }
  finally { if (request === sequence) loading.value = false }
}
function search() {
  const target = { path: route.path, query: { ...route.query, priceMonth: month.value } }
  if (router.resolve(target).fullPath === route.fullPath) load()
  else router.replace(target)
}
watch(() => route.fullPath, () => { month.value = settlementMonth(route.query); load() }, { immediate: true })
function edit() { form.value = { copper: current.value ? String(current.value.copperPrice) : '', zinc: current.value ? String(current.value.zincPrice) : '', unit: 'CNY/KG', reason: '' }; saveError.value = ''; editOpen.value = true }
function close() { if (!saving.value) editOpen.value = false }
async function save() {
  if (saving.value) return
  saving.value = true; saveError.value = ''
  try { await saveSettlementBase(baseChange(form.value, month.value, history.value[0])); editOpen.value = false; ElMessage.success('结算基价已保存'); await load() }
  catch (e) { saveError.value = e.message }
  finally { saving.value = false }
}
</script>
<style scoped>.base-page { padding: 20px; }.heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }h2 { margin: 0; }p { color: #606266; }.edit-form,.edit-button { margin-top: 24px; }</style>
