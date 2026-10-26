<template>
  <div class="household-inquiry-page">
    <el-card>
      <template #header><div class="page-heading"><div><h2>家用部件询价</h2><p>维护家用部件的询价来源及历史版本。来源发布不会改写已经采用的月度核算价。</p></div><el-button v-if="canImport" type="primary" @click="importOpen = true">导入询价原件</el-button></div></template>
      <el-form inline @submit.prevent="search">
        <el-form-item label="料号"><el-input v-model="materialCode" placeholder="精确料号，保留前导零及大小写" clearable style="width:290px" @keyup.enter="search" /></el-form-item>
        <el-button @click="search">查询</el-button><el-button @click="refresh">刷新来源</el-button>
        <el-button v-if="batchId && canDownload" link type="primary" @click="openBatch">查看本次发布记录</el-button>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <p class="count">共 {{ total }} 个当前来源。来源年月用于追溯，当前版本以最近一次成功发布为准。</p>
      <el-table v-loading="loading" :data="rows" border row-key="id" max-height="650" empty-text="当前业务单元没有匹配的家用询价来源" aria-label="家用询价当前来源">
        <el-table-column prop="materialCode" label="料号" min-width="150" />
        <el-table-column prop="materialName" label="名称" min-width="110" />
        <el-table-column prop="specification" label="规格" min-width="175" show-overflow-tooltip />
        <el-table-column label="原报价成本P" min-width="160"><template #default="{ row }"><strong>{{ inquiryDecimal(row.unitPrice) }}</strong></template></el-table-column>
        <el-table-column label="两项费用率H" min-width="145"><template #default="{ row }">{{ inquiryPercent(row.householdRate) }}</template></el-table-column>
        <el-table-column prop="sourceMonth" label="来源年月" width="115" />
        <el-table-column label="来源价格口径" min-width="175"><template #default="{ row }">{{ row.priceContext.unit }} / {{ row.priceContext.currency }} / {{ inquiryTaxLabel(row.priceContext.taxBasis) }}</template></el-table-column>
        <el-table-column label="来源版本" width="105"><template #default="{ row }">V{{ row.revisionNo }}</template></el-table-column>
        <el-table-column v-if="canQuery" label="操作" width="125" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="detail(row)">来源 / 历史</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-if="total" v-model:current-page="page" v-model:page-size="size" :page-sizes="[20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next" @current-change="paginate" @size-change="resize" />
    </el-card>
    <HouseholdInquiryImportDialog v-if="canImport && scope" v-model="importOpen" :scope="scope" :can-download="canDownload" @imported="imported" />
    <HouseholdInquiryDetail v-if="canQuery && scope" v-model="detailOpen" :entry="selected" :scope="scope" :can-download="canDownload" />
    <el-dialog v-model="batchOpen" title="询价来源发布记录" width="900px" destroy-on-close>
      <el-alert v-if="batchError" :title="batchError" type="error" :closable="false" />
      <section v-if="batch && canDownload" aria-label="询价来源发布记录">
        <p>原件：{{ batch.preview.content.workbook.fileName }}；来源年月：{{ batch.preview.content.sourceMonth }}；发布人：{{ batch.createdBy }}；状态：{{ batch.preview.status === 'PUBLISHED' ? '已发布' : '未发布' }}</p>
        <el-alert title="这里保存当时的发布回执，不将回执版本标记为当前来源。当前来源请重新查询列表。" type="info" :closable="false" />
        <el-table v-if="batch.publication" :data="batch.publication.rows" border max-height="350">
          <el-table-column prop="materialCode" label="料号" min-width="150" /><el-table-column label="保存版本" width="120"><template #default="{ row }">V{{ row.revisionNo }}</template></el-table-column><el-table-column label="发布动作"><template #default="{ row }">{{ inquiryActionLabel(row.action) }}</template></el-table-column>
        </el-table>
        <el-button class="batch-original" @click="downloadBatch">下载本次原件</el-button>
      </section>
    </el-dialog>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, toRefs, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import { fetchHouseholdInquiries, fetchHouseholdImport, downloadHouseholdImportOriginal } from '../api/householdInquiries'
import { inquiryDecimal, inquiryPercent, inquiryTaxLabel, inquiryScope, inquiryActionLabel, inquiryMessage } from './householdInquiryUtils'
import { createInquiryList } from './householdInquiryList'
import HouseholdInquiryImportDialog from '../components/household-inquiry/HouseholdInquiryImportDialog.vue'
import HouseholdInquiryDetail from '../components/household-inquiry/HouseholdInquiryDetail.vue'
const route = useRoute(), router = useRouter(), user = useUserStore()
const allowed = point => user.permissions.includes('*:*:*') || user.permissions.includes(`price:household-inquiry:${point}`)
const canList = computed(() => allowed('list'))
const canImport = computed(() => canList.value && allowed('import')), canQuery = computed(() => canList.value && allowed('query')), canDownload = computed(() => canList.value && allowed('download'))
const scope = computed(() => user.userId && user.username && ['COMMERCIAL', 'HOUSEHOLD'].includes(user.businessUnitType) ? inquiryScope(user) : '')
const list = createInquiryList({ fetch: fetchHouseholdInquiries, scope: () => scope.value, allowed: () => canList.value })
const { rows, total, loading, error } = toRefs(list.state)
const page = ref(1), size = ref(20), materialCode = ref('')
const importOpen = ref(false), detailOpen = ref(false), selected = ref(null), batchOpen = ref(false), batch = ref(null), batchError = ref('')
const batchId = computed(() => /^\d+$/.test(String(route.query.batchId || '')) ? String(route.query.batchId) : '')
let batchSequence = 0, alive = true
onBeforeUnmount(() => { alive = false; batchSequence++; list.dispose() })
watch([() => route.fullPath, scope, canList], () => {
  materialCode.value = typeof route.query.materialCode === 'string' ? route.query.materialCode : ''
  page.value = Math.min(1000000, Math.max(1, Number(route.query.page) || 1)); size.value = [20, 50, 100].includes(Number(route.query.size)) ? Number(route.query.size) : 20
  load()
}, { immediate: true })
watch([scope, canList], () => { importOpen.value = false; detailOpen.value = false; selected.value = null; batchOpen.value = false; batch.value = null; batchSequence++ }, { flush: 'sync' })
watch(canDownload, value => { batchSequence++; if (!value) { batch.value = null; batchOpen.value = false } }, { flush: 'sync' })
function load() { return list.load({ materialCode: materialCode.value, page: page.value, size: size.value }) }
function search() { page.value = 1; navigate() }
function paginate() { navigate() }
function resize() { page.value = 1; navigate() }
function navigate() {
  const target = { path: route.path, query: { ...route.query, materialCode: materialCode.value || undefined, page: page.value > 1 ? String(page.value) : undefined, size: String(size.value) } }
  if (router.resolve(target).fullPath === route.fullPath) load(); else router.replace(target)
}
function refresh() { load() }
function detail(row) { selected.value = row; detailOpen.value = true }
function imported(result) { router.replace({ path: route.path, query: { ...route.query, batchId: String(result.batchId) } }); load() }
async function openBatch() {
  if (!canDownload.value || !batchId.value) return
  const ticket = ++batchSequence, currentScope = scope.value; batch.value = null; batchError.value = ''; batchOpen.value = true
  try { const data = await fetchHouseholdImport(batchId.value); if (alive && batchOpen.value && ticket === batchSequence && currentScope === scope.value && canDownload.value) batch.value = data }
  catch (failure) { if (alive && batchOpen.value && ticket === batchSequence && canDownload.value) batchError.value = inquiryMessage(failure) }
}
async function downloadBatch() {
  if (!canDownload.value || !batch.value) return
  const currentScope = scope.value, ticket = batchSequence, id = batch.value.preview.batchId
  const isCurrent = () => alive && batchOpen.value && currentScope === scope.value && canDownload.value && ticket === batchSequence && batch.value?.preview.batchId === id
  try { await downloadHouseholdImportOriginal(id, batch.value.preview.content.workbook.fileName, { isCurrent }) }
  catch (failure) { if (isCurrent()) batchError.value = inquiryMessage(failure) }
}
</script>
<style scoped>
.household-inquiry-page { padding: 20px; }.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; } h2 { margin: 0; }.page-heading p, .count { color: #606266; font-size: 14px; }.el-pagination { margin-top: 18px; }.batch-original { margin-top: 16px; }
</style>
