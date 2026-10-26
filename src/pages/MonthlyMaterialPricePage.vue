<template>
  <div class="monthly-price-page">
    <el-card>
      <template #header><h2>月度物料核算价</h2><p>查看核算时自动采用的月价。后续来源更新不会改变本月已采用的价格与计价口径。</p></template>
      <el-form inline @submit.prevent="search" aria-label="月价筛选">
        <el-form-item label="核算月份"><el-date-picker v-model="filter.month" type="month" value-format="YYYY-MM" placeholder="选择核算月份" style="width:150px" /></el-form-item>
        <el-form-item label="料号"><el-input v-model="filter.materialCode" placeholder="精确料号，保留前导零" clearable @keyup.enter="search" /></el-form-item>
        <el-form-item label="适用组织"><el-select v-model="filter.organization" clearable placeholder="全部组织" style="width:150px"><el-option label="210 商用" value="210" /><el-option label="220 板换" value="220" /></el-select></el-form-item>
        <el-form-item label="计价类型"><el-select v-model="filter.pricingType" clearable placeholder="全部类型" style="width:150px"><el-option label="普通物料" value="NORMAL" /><el-option label="家用询价" value="HOUSEHOLD_INQUIRY" /></el-select></el-form-item>
        <el-button type="primary" native-type="submit">查询</el-button><el-button @click="list.load(filter)">刷新月价</el-button>
        <el-collapse class="conditions"><el-collapse-item title="更多适用条件" name="conditions">
          <el-form-item v-for="field in fields" :key="field.key" :label="field.label"><el-input v-model="filter[field.key]" :placeholder="field.placeholder" clearable /></el-form-item>
          <el-form-item label="税口径"><el-select v-model="filter.taxBasis" clearable placeholder="全部" style="width:160px"><el-option label="含税" value="INCLUDED" /><el-option label="不含税" value="EXCLUDED" /></el-select></el-form-item>
        </el-collapse-item></el-collapse>
      </el-form>
      <el-alert v-if="list.state.error" :title="list.state.error" type="error" :closable="false" />
      <p class="count">共 {{ list.state.data?.total || 0 }} 条已采用月价；查询不会创建或覆盖月价。</p>
      <el-table v-loading="list.state.loading" :data="list.state.data?.rows || []" border row-key="id" aria-label="已采用月价" empty-text="该月份及条件下没有已采用月价">
        <el-table-column prop="materialCode" label="料号" min-width="160" /><el-table-column prop="materialName" label="名称" min-width="130" />
        <el-table-column label="计价类型" width="110"><template #default="{ row }">{{ monthlyType(row.pricingType) }}</template></el-table-column>
        <el-table-column label="已采用单价 / P" min-width="155"><template #default="{ row }"><strong>{{ row.price }}</strong></template></el-table-column>
        <el-table-column label="家用费用率 H" width="130"><template #default="{ row }">{{ inquiryPercent(row.householdRate) }}</template></el-table-column>
        <el-table-column label="适用组织" width="115"><template #default="{ row }">{{ organizations(row) }}</template></el-table-column>
        <el-table-column label="计价口径" min-width="175"><template #default="{ row }">{{ row.unit }} / {{ row.currency }} / {{ inquiryTaxLabel(row.taxBasis) }}</template></el-table-column>
        <el-table-column label="采用来源" min-width="150"><template #default="{ row }">{{ monthlySource(row.source.type) }}</template></el-table-column>
        <el-table-column prop="createdAt" label="首次采用时间" min-width="185" />
        <el-table-column v-if="canQuery" label="操作" fixed="right" width="115"><template #default="{ row }"><el-button link type="primary" @click="open(row.id)">详情 / 追溯</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="list.state.data?.total" v-model:current-page="filter.page" v-model:page-size="filter.size" :page-sizes="[10,20,50,100]" :total="list.state.data.total" layout="total, sizes, prev, pager, next" @current-change="navigate" @size-change="search" />
    </el-card>
    <el-drawer :model-value="!!selectedId && canQuery" title="月价采用依据与核算引用" size="min(1160px, 96vw)" destroy-on-close @close="close">
      <el-alert title="以下为该月已采用的价格和保存依据。查看来源版本可对照当前来源；对照不会重新取价。" type="info" :closable="false" />
      <el-alert v-if="detail.state.error" :title="detail.state.error" type="error" :closable="false" />
      <div v-loading="detail.state.loading" v-if="selected" aria-label="月价详情">
        <h3>{{ selected.materialCode }} · {{ selected.month }} · {{ monthlyType(selected.pricingType) }}</h3>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="已采用单价 / P">{{ selected.price }}</el-descriptions-item><el-descriptions-item label="家用费用率 H">{{ inquiryPercent(selected.householdRate) }}</el-descriptions-item>
          <el-descriptions-item label="名称 / 规格">{{ selected.materialName }} / {{ selected.specification }}</el-descriptions-item><el-descriptions-item label="计价口径">{{ selected.unit }} / {{ selected.currency }} / {{ inquiryTaxLabel(selected.taxBasis) }}</el-descriptions-item>
          <el-descriptions-item label="指定供应商条件">{{ selected.requestedSupplierCode || '不限' }}</el-descriptions-item><el-descriptions-item label="已选供应商">{{ selected.supplierCode }} {{ selected.supplierName }}</el-descriptions-item>
          <el-descriptions-item label="采用来源">{{ monthlySource(selected.source.type) }} #{{ selected.source.recordId }}</el-descriptions-item><el-descriptions-item label="来源版本 / 批次">{{ selected.source.version }} / {{ selected.source.batch }}</el-descriptions-item>
          <el-descriptions-item label="首次采用时间">{{ selected.createdAt }}</el-descriptions-item><el-descriptions-item label="首次采用人">{{ selected.createdBy }}</el-descriptions-item>
          <el-descriptions-item label="首次报价 / 产品">{{ origin.oaNo }} / {{ origin.productCode }}</el-descriptions-item><el-descriptions-item label="首次消费组织">{{ origin.consumerOrg }}</el-descriptions-item>
        </el-descriptions>
        <h3>适用条件</h3>
        <el-table :data="selected.applicability.fragments" border aria-label="月价适用条件"><el-table-column label="组织" width="130"><template #default="{ row }">{{ row.organizations.join(' / ') }}</template></el-table-column><el-table-column label="数量范围" min-width="140"><template #default="{ row }">{{ monthlyQuantity(row.quantities) }}</template></el-table-column><el-table-column label="成品年用量范围（只）" min-width="200"><template #default="{ row }">{{ monthlyAnnualUsage(row.annualUsage) }}</template></el-table-column><el-table-column label="特定条件" min-width="250"><template #default="{ row }">{{ monthlyCondition(row.conditions) }}</template></el-table-column></el-table>
        <div class="actions"><el-button v-if="selected.source.householdSourceId && canSource" @click="source.load(selected.source.householdSourceId)">查看采用的询价来源版本</el-button><span v-else-if="selected.source.householdSourceId">询价来源版本及原件需相应查询、下载权限。</span></div>
        <el-alert v-if="source.state.error" :title="source.state.error" type="error" :closable="false" />
        <el-collapse><el-collapse-item title="已采用来源快照" name="evidence"><p>保存依据校验值：{{ selected.evidenceHash }}</p><pre>{{ JSON.stringify(detail.state.data.savedEvidence, null, 2) }}</pre></el-collapse-item></el-collapse>
        <section v-if="canReferences" aria-label="月价核算引用">
          <h3>使用此月价的核算版本（{{ references.state.data?.total || 0 }}）</h3>
          <p>包含直接用料及必要价格依赖；同一版本多处用料仅列一次。各产品数量、费用率和最终金额仍属于各自版本。</p>
          <el-alert v-if="references.state.error" :title="references.state.error" type="error" :closable="false" />
          <el-table v-loading="references.state.loading" :data="references.state.data?.rows || []" border aria-label="核算引用列表" empty-text="暂无已保存的成功核算引用">
            <el-table-column prop="oaNo" label="报价单号" min-width="170" /><el-table-column prop="productCode" label="产品" min-width="130" /><el-table-column prop="versionId" label="版本ID" width="90" />
            <el-table-column prop="consumerOrganizations" label="消费组织" width="110" /><el-table-column prop="totalCost" label="保存总成本1" min-width="145" /><el-table-column prop="finalQuoteAmount" label="保存总成本2" min-width="145" />
            <el-table-column label="操作" width="110"><template #default="{ row }"><el-button link type="primary" @click="goToCost(row)">查看见机表</el-button></template></el-table-column>
          </el-table>
          <el-pagination v-if="references.state.data?.total" v-model:current-page="referencePage" :page-size="10" :total="references.state.data.total" layout="total, prev, pager, next" @current-change="loadReferences" />
        </section>
        <p v-else>核算引用需月价引用及报价查询权限。</p>
      </div>
    </el-drawer>
    <HouseholdInquiryDetail v-if="canSource && scope" v-model="sourceOpen" :entry="source.state.data" :scope="scope" :can-download="allowed('price:household-inquiry:download')" />
  </div>
</template>
<script setup>
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import { fetchMonthlyMaterialPrices, fetchMonthlyMaterialPrice, fetchMonthlyMaterialReferences } from '../api/monthlyMaterialPrices'
import { fetchHouseholdInquiry } from '../api/householdInquiries'
import { inquiryPercent, inquiryTaxLabel, inquiryScope } from './householdInquiryUtils'
import { createMonthlyRead, monthlyType, monthlySource, monthlyQuantity, monthlyAnnualUsage, monthlyCondition, monthlyFilter } from './monthlyMaterialPriceQuery'
import HouseholdInquiryDetail from '../components/household-inquiry/HouseholdInquiryDetail.vue'
const route = useRoute(), router = useRouter(), user = useUserStore()
const allowed = point => user.permissions.includes('*:*:*') || user.permissions.includes(point)
const canList = computed(() => allowed('price:monthly-material:list'))
const canQuery = computed(() => canList.value && allowed('price:monthly-material:query'))
const canReferences = computed(() => canQuery.value && allowed('price:monthly-material:references') && allowed('ingest:quote:list'))
const canSource = computed(() => canQuery.value && allowed('price:household-inquiry:query'))
const scope = computed(() => user.userId && user.username && ['COMMERCIAL','HOUSEHOLD'].includes(user.businessUnitType) ? inquiryScope(user) : '')
const create = (fetch, permission) => createMonthlyRead({ fetch, scope: () => scope.value, allowed: () => permission.value })
const list = create(fetchMonthlyMaterialPrices, canList), detail = create(fetchMonthlyMaterialPrice, canQuery), references = create(fetchMonthlyMaterialReferences, canReferences), source = create(fetchHouseholdInquiry, canSource)
const now = new Date(), defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const filter = reactive(monthlyFilter(route.query, defaultMonth)), referencePage = ref(1), sourceOpen = ref(false)
const selectedId = computed(() => /^[1-9]\d*$/.test(String(route.query.id || '')) ? String(route.query.id) : '')
const selected = computed(() => detail.state.data?.price), origin = computed(() => detail.state.data?.firstUse?.origin || {})
const fields = [{ key: 'specification', label: '规格', placeholder: '精确规格' }, { key: 'unit', label: '计价单位', placeholder: '如：件' }, { key: 'currency', label: '币种', placeholder: '如：CNY' }, { key: 'supplier', label: '指定供应商条件', placeholder: '供应商编码' }]
watch([() => route.fullPath, scope, canList], () => { Object.assign(filter, monthlyFilter(route.query, defaultMonth)); list.load(filter) }, { immediate: true })
watch([selectedId, scope, canQuery, canReferences], () => {
  detail.clear(); references.clear(); source.clear(); sourceOpen.value = false; referencePage.value = 1
  if (selectedId.value && canQuery.value) { detail.load(selectedId.value); loadReferences() }
}, { immediate: true, flush: 'sync' })
watch(() => source.state.data, data => { sourceOpen.value = !!data }, { flush: 'sync' })
onBeforeUnmount(() => [list, detail, references, source].forEach(read => read.dispose()))
function organizations(row) { return [...new Set(row.applicability.fragments.flatMap(f => f.organizations))].sort().join(' / ') }
function navigate() {
  const query = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== '' && value != null).map(([key, value]) => [key, String(value)]))
  const target = { path: route.path, query }
  if (router.resolve(target).fullPath === route.fullPath) list.load(filter); else router.replace(target)
}
function search() { filter.page = 1; navigate() }
function open(id) { router.replace({ path: route.path, query: { ...route.query, month: filter.month, id: String(id) } }) }
function close() { const { id, ...query } = route.query; router.replace({ path: route.path, query }) }
function loadReferences() { if (selectedId.value && canReferences.value) references.load({ id: selectedId.value, page: referencePage.value, size: 10 }) }
function goToCost(row) { router.push({ name: 'cost-run-detail', params: { oaNo: row.oaNo, itemId: String(row.oaFormItemId) }, query: { productCode: row.productCode, versionId: String(row.versionId), costRunNo: row.costRunNo } }) }
</script>
<style scoped>
.monthly-price-page { padding:20px; } h2 { margin:0; } p { color:#606266; font-size:14px; }.conditions { width:100%; margin-bottom:16px; }.el-pagination { margin-top:18px; }.el-alert { margin-bottom:14px; } h3 { margin:22px 0 14px; }.actions { margin:16px 0; } pre { white-space:pre-wrap; word-break:break-word; font-size:12px; max-height:450px; overflow:auto; }.count { margin:14px 0; }
</style>
