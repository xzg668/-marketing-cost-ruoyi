<template>
  <div class="settlement-page">
    <el-card>
      <template #header><div class="heading"><div><h2>结算价格</h2><p>商用与板换共用结算规则；发布商用基价或导入原稿时，生成并保存对应月份的结算价格。</p></div><div>
        <el-button v-if="returnTo" @click="router.push(returnTo)">返回报价核算</el-button>
        <el-button v-hasPermi="['price:settlement:import']" type="primary" @click="importOpen = true">导入原稿</el-button>
      </div></div></template>
      <el-form inline @submit.prevent="search">
        <el-form-item label="核算月份"><el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="search" /></el-form-item>
        <el-form-item label="料号"><el-input v-model="materialCode" placeholder="输入料号" clearable @keyup.enter="search" /></el-form-item>
        <el-form-item label="价格类型"><el-select v-model="priceType" clearable placeholder="全部类型" style="width:160px" @change="search"><el-option label="结算固定价" value="SETTLE_FIXED" /><el-option label="结算联动价" value="SETTLE_LINKED" /></el-select></el-form-item>
        <el-button @click="search">查询</el-button>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <p class="count">共 {{ rows.length }} 条 · 固定 {{ fixedCount }} 条 · 联动 {{ rows.length - fixedCount }} 条</p>
      <el-table v-loading="loading" :data="rows" row-key="rule.id" border empty-text="该核算月没有适用结算价格，请导入原稿" max-height="650">
        <el-table-column prop="rule.materialCode" label="料号" width="155" />
        <el-table-column prop="rule.materialName" label="名称" min-width="120" />
        <el-table-column label="价格类型" width="115"><template #default="{ row }">{{ typeLabel(row.rule.priceType) }}</template></el-table-column>
        <el-table-column label="当前单价（元）" width="170"><template #default="{ row }"><strong v-if="!row.failureCode">{{ displayDecimal(row.unitPrice) }}</strong><el-tooltip v-else :content="row.message"><el-tag type="danger">取价失败</el-tag></el-tooltip></template></el-table-column>
        <el-table-column label="取价方式" width="120"><template #default="{ row }">{{ modeLabel(row.mode) }}</template></el-table-column>
        <el-table-column label="物料单位" width="110"><template #default="{ row }">{{ row.rule.materialUnit || '按BOM单位' }}</template></el-table-column>
        <el-table-column label="结果月份 / 版本" width="165"><template #default="{ row }">{{ row.effectivePrice?.priceMonth ? `${row.effectivePrice.priceMonth} / ${row.effectivePrice.revisionNo}` : '待生成' }} <el-tag v-if="row.effectivePrice?.priceMonth < month" size="small">沿用</el-tag></template></el-table-column>
        <el-table-column label="原稿月份 / 版本" width="170"><template #default="{ row }">{{ row.rule.priceMonth }} / {{ row.rule.revisionNo }} <el-tag v-if="row.ruleCarriedForward" size="small">沿用</el-tag></template></el-table-column>
        <el-table-column label="商用基价月份" width="145"><template #default="{ row }">{{ row.base?.priceMonth || '未使用' }} <el-tag v-if="row.baseCarriedForward" size="small">沿用</el-tag></template></el-table-column>
        <el-table-column label="操作" width="120" fixed="right"><template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">依据 / 版本</el-button>
        </template></el-table-column>
      </el-table>
    </el-card>
    <SettlementImportDialog v-model="importOpen" :price-month="month" @imported="imported" />
    <SettlementPriceDetail v-model="detailOpen" :entry="selected" :price-month="month" />
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettlementImportDialog from '../components/settlement/SettlementImportDialog.vue'
import SettlementPriceDetail from '../components/settlement/SettlementPriceDetail.vue'
import { fetchSettlementPrices } from '../api/settlementPrices'
import { displayDecimal, modeLabel, typeLabel, settlementMonth, settlementReturnTo } from './settlementPriceUtils'
const route = useRoute(), router = useRouter()
const month = ref(settlementMonth(route.query)), materialCode = ref(route.query.materialCode || ''), priceType = ref(route.query.priceType || '')
const rows = ref([]), loading = ref(false), error = ref(''), importOpen = ref(false), detailOpen = ref(false), selected = ref(null)
const returnTo = computed(() => settlementReturnTo(route.query.returnTo))
const fixedCount = computed(() => rows.value.filter(r => r.rule.priceType === 'SETTLE_FIXED').length)
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true; error.value = ''; rows.value = []
  try { const result = await fetchSettlementPrices({ priceMonth: month.value, materialCode: materialCode.value, priceType: priceType.value }); if (request === sequence) rows.value = result }
  catch (e) { if (request === sequence) error.value = e.message }
  finally { if (request === sequence) loading.value = false }
}
function search() {
  const target = { path: route.path, query: { ...route.query, priceMonth: month.value, materialCode: materialCode.value || undefined, priceType: priceType.value || undefined } }
  if (router.resolve(target).fullPath === route.fullPath) load()
  else router.replace(target)
}
watch(() => route.fullPath, () => {
  month.value = settlementMonth(route.query); materialCode.value = route.query.materialCode || ''
  priceType.value = ['SETTLE_FIXED', 'SETTLE_LINKED'].includes(route.query.priceType) ? route.query.priceType : ''
  load()
}, { immediate: true })
function showDetail(row) { selected.value = row; detailOpen.value = true }
function imported(value) { month.value = value; search() }
</script>
<style scoped>
.settlement-page { padding: 20px; }.heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; } h2 { margin: 0; } p { color: #606266; } .count { font-size: 14px; }
</style>
