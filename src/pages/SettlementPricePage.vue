<template>
  <div class="settlement-page">
    <el-card>
      <template #header><div class="heading"><div><h2>结算价格</h2><p>商用与板换共用结算规则；按核算月取不晚于当月的最新价格。</p></div><div>
        <el-button v-if="returnTo" @click="router.push(returnTo)">返回报价核算</el-button>
        <el-button v-hasPermi="['price:settlement-base:list']" @click="openBases">结算铜锌基价</el-button>
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
        <el-table-column label="原稿月份 / 版本" width="170"><template #default="{ row }">{{ row.rule.priceMonth }} / {{ row.rule.revisionNo }} <el-tag v-if="row.ruleCarriedForward" size="small">沿用</el-tag></template></el-table-column>
        <el-table-column label="基价月份" width="145"><template #default="{ row }">{{ row.base?.priceMonth || '未使用' }} <el-tag v-if="row.baseCarriedForward" size="small">沿用</el-tag></template></el-table-column>
        <el-table-column label="操作" width="190" fixed="right"><template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">依据 / 版本</el-button>
          <el-button v-if="row.rule.priceType === 'SETTLE_LINKED'" v-hasPermi="['price:settlement:edit']" link type="primary" @click="editWeights(row)">确认重量</el-button>
        </template></el-table-column>
      </el-table>
    </el-card>
    <SettlementImportDialog v-model="importOpen" :price-month="month" @imported="imported" />
    <SettlementPriceDetail v-model="detailOpen" :entry="selected" />
    <el-dialog v-model="weightOpen" title="财务确认结算重量" width="550px" :close-on-click-modal="false" :before-close="closeWeight">
      <p>料号 {{ selected?.rule.materialCode }} · 原稿 {{ selected?.rule.priceMonth }} 第{{ selected?.rule.revisionNo }}版</p>
      <el-alert title="完整确认铜重和锌重后，自动按独立结算基价计算。确实没有该金属请填0；原稿“凑数”值不能直接当作真实重量。" type="warning" :closable="false" />
      <el-form label-width="120px" :disabled="saving" class="edit-form">
        <el-form-item label="铜重（克）"><el-input v-model="weightForm.copper" aria-label="铜重（克）" /></el-form-item>
        <el-form-item label="锌重（克）"><el-input v-model="weightForm.zinc" aria-label="锌重（克）" /></el-form-item>
        <el-form-item label="确认依据"><el-input v-model="weightForm.reason" aria-label="重量确认依据" type="textarea" maxlength="1000" /></el-form-item>
      </el-form>
      <el-alert v-if="weightError" :title="weightError" type="error" :closable="false" />
      <template #footer><el-button :disabled="saving" @click="closeWeight">取消</el-button><el-button type="primary" :loading="saving" @click="saveWeights">确认并保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementImportDialog from '../components/settlement/SettlementImportDialog.vue'
import SettlementPriceDetail from '../components/settlement/SettlementPriceDetail.vue'
import { fetchSettlementPrices, confirmSettlementWeights } from '../api/settlementPrices'
import { displayDecimal, modeLabel, typeLabel, settlementMonth, settlementReturnTo, weightChange } from './settlementPriceUtils'
const route = useRoute(), router = useRouter()
const month = ref(settlementMonth(route.query)), materialCode = ref(route.query.materialCode || ''), priceType = ref(route.query.priceType || '')
const rows = ref([]), loading = ref(false), error = ref(''), importOpen = ref(false), detailOpen = ref(false), weightOpen = ref(false), selected = ref(null), saving = ref(false), weightError = ref('')
const weightForm = ref({ copper: '', zinc: '', reason: '' })
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
function openBases() { router.push({ path: '/price/settlement-base', query: { ...route.query, priceMonth: month.value } }) }
function showDetail(row) { selected.value = row; detailOpen.value = true }
function editWeights(row) {
  selected.value = row; weightError.value = ''
  weightForm.value = { copper: row.rule.weightsConfirmed ? String(row.rule.copperWeightG) : '', zinc: row.rule.weightsConfirmed ? String(row.rule.zincWeightG) : '', reason: '' }
  weightOpen.value = true
}
function closeWeight() { if (!saving.value) weightOpen.value = false }
async function saveWeights() {
  if (saving.value) return
  saving.value = true; weightError.value = ''
  try {
    await confirmSettlementWeights(selected.value.rule.id, weightChange(weightForm.value, selected.value.rule.revisionNo))
    weightOpen.value = false; ElMessage.success('重量已保存，请查看当前取价结果'); await load()
  } catch (e) { weightError.value = e.message }
  finally { saving.value = false }
}
function imported(value) { month.value = value; search() }
</script>
<style scoped>
.settlement-page { padding: 20px; }.heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; } h2 { margin: 0; } p { color: #606266; } .count { font-size: 14px; } .edit-form { margin-top: 22px; }
</style>
