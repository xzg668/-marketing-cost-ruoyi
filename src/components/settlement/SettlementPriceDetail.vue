<template>
  <el-drawer v-model="visible" title="结算价格依据与版本" size="680px">
    <template v-if="entry">
      <el-alert v-if="entry.failureCode" :title="entry.message" type="error" :closable="false" />
      <el-descriptions :column="2" border>
        <el-descriptions-item label="料号">{{ rule.materialCode }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeLabel(rule.priceType) }}</el-descriptions-item>
        <el-descriptions-item label="规格型号" :span="2">{{ rule.specModel || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前单价">{{ displayDecimal(entry.unitPrice) }}</el-descriptions-item>
        <el-descriptions-item label="取价方式">{{ modeLabel(entry.mode) }}</el-descriptions-item>
        <el-descriptions-item label="原稿月份">{{ rule.priceMonth }} / 第{{ rule.revisionNo }}版</el-descriptions-item>
        <el-descriptions-item label="物料单位">{{ rule.materialUnit || '按BOM物料单位' }}</el-descriptions-item>
        <el-descriptions-item label="原稿给定价">{{ displayDecimal(rule.givenPrice) }}</el-descriptions-item>
        <el-descriptions-item v-if="rule.priceType === 'SETTLE_LINKED'" label="计算重量状态">{{ rule.weightsConfirmed ? '可计算' : '原稿重量待补齐' }}</el-descriptions-item>
      </el-descriptions>
      <template v-if="rule.priceType === 'SETTLE_LINKED'">
        <h3>联动计算依据</h3>
        <p>计划价 × 加成系数 + [(商用铜基价 − 预算铜价) × 铜重 + (商用锌基价 − 预算锌价) × 锌重] ÷ 1000 ÷ 税率除数 × 加成系数<span v-if="rule.formulaVersion === 'SETTLEMENT_CU_ZN_ROUND4_V2'">，最终单价四舍五入保留4位小数</span>。</p>
        <el-descriptions :column="2" border>
          <el-descriptions-item v-for="(label, key) in fields" :key="key" :label="label">{{ displayDecimal(rule[key]) }}</el-descriptions-item>
          <el-descriptions-item label="商用基价月份">{{ entry.base?.priceMonth || (entry.failureCode ? '尚未使用' : '给定模式无需基价') }}</el-descriptions-item>
          <el-descriptions-item label="实际铜 / 锌基价">{{ entry.base ? `${displayDecimal(entry.base.copperPrice)} / ${displayDecimal(entry.base.zincPrice)} 元/千克` : '未使用' }}</el-descriptions-item>
          <el-descriptions-item v-if="entry.base?.financial" label="财务发布版本">第{{ entry.base.financial.revision }}版 · 商用默认方案</el-descriptions-item>
          <el-descriptions-item v-if="entry.base?.financial" label="财务方案">{{ settlementFinanceScheme(entry.base) }}</el-descriptions-item>
          <el-descriptions-item v-if="entry.base?.financial" label="财务发布人">{{ entry.base.financial.publishedBy }}</el-descriptions-item>
          <el-descriptions-item v-if="entry.base?.financial" label="基价原稿" :span="2">{{ entry.base.financial.fileName }}</el-descriptions-item>
          <el-descriptions-item label="原表参考铜 / 锌">{{ displayDecimal(rule.referenceCu) }} / {{ displayDecimal(rule.referenceZn) }} 元/千克</el-descriptions-item>
          <el-descriptions-item label="重量取值依据" :span="2">{{ rule.weightConfirmationNote || '请修正原稿后重新导入' }}</el-descriptions-item>
        </el-descriptions>
        <p>保存的公式：{{ rule.expression }}</p>
      </template>
      <h3>原件与来源行</h3>
      <el-button @click="download">下载原稿</el-button>
      <p>{{ rule.sourceFileName }} · {{ rule.sourceSheet }}</p>
      <el-table :data="rule.sourceRows || []" size="small" border>
        <el-table-column prop="row" label="Excel行" width="80" />
        <el-table-column label="原稿备注"><template #default="{ row }">{{ row.cells?.J?.text }} {{ row.cells?.M?.text }}</template></el-table-column>
        <el-table-column label="原始公式"><template #default="{ row }">{{ row.cells?.L?.text || row.resolvedSourceFormula || '—' }}</template></el-table-column>
      </el-table>
      <h3>修订记录</h3>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-loading="loading" :data="history" size="small">
        <el-table-column prop="priceMonth" label="月份" />
        <el-table-column prop="revisionNo" label="版本" width="65" />
        <el-table-column prop="createdBy" label="维护人" />
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column prop="weightConfirmationNote" label="重量取值依据" />
      </el-table>
    </template>
  </el-drawer>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { fetchSettlementHistory, downloadSettlementOriginal } from '../../api/settlementPrices'
import { displayDecimal, modeLabel, typeLabel, settlementFinanceScheme } from '../../pages/settlementPriceUtils'
const visible = defineModel({ type: Boolean })
const props = defineProps({ entry: Object })
const rule = computed(() => props.entry?.rule || {})
const history = ref([]), error = ref(''), loading = ref(false)
const fields = { plannedPrice: '计划价', markupRatio: '加成系数', budgetCu: '预算铜价（元/千克）', budgetZn: '预算锌价（元/千克）', originalCopperWeightG: '原稿铜重（克）', originalZincWeightG: '原稿锌重（克）', copperWeightG: '计算铜重（克）', zincWeightG: '计算锌重（克）', taxDivisor: '税率除数' }
let sequence = 0
watch(() => [visible.value, rule.value.id], async ([open, id]) => {
  const request = ++sequence
  if (!open || !id) return
  history.value = []; error.value = ''; loading.value = true
  try { const rows = await fetchSettlementHistory(id); if (request === sequence) history.value = rows }
  catch (e) { if (request === sequence) error.value = e.message }
  finally { if (request === sequence) loading.value = false }
})
async function download() { try { await downloadSettlementOriginal(rule.value) } catch (e) { error.value = e.message } }
</script>
<style scoped>p { overflow-wrap: anywhere; line-height: 1.6; color: #606266; } h3 { margin-top: 24px; }</style>
