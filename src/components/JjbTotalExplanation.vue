<template>
  <section class="total-explanation" aria-label="成本计算明细" :data-selected-total="selectedTotal">
    <p>以下依据来自当前保存版本，与导出 Excel 的“成本计算明细”一致。金额单位：元/件。</p>
    <template v-if="sheet.explanation">
      <h3>不含税成本1：各项成本相加</h3>
      <table>
        <thead><tr><th>组成项目</th><th>取值与代入计算</th><th>金额</th></tr></thead>
        <tbody><tr v-for="(term, index) in sheet.explanation.totalItems" :key="index"><th>{{ term.name }}</th><td class="formula">{{ term.formula }}</td><td>{{ term.amount }}</td></tr></tbody>
      </table>
      <p class="formula">加总项目：{{ sheet.explanation.totalItems.map(term => `(${term.amount})`).join(' + ') || '0' }}</p>
      <p><strong>保存的不含税成本1：{{ sheet.totals.totalCost ?? '历史未记录' }}</strong></p>
      <h3>材料成本差异：各项客户金额减基准金额</h3>
      <article v-for="(material, index) in sheet.explanation.materials" :key="index">
        <h4>{{ material.code }} · {{ material.name }}</h4>
        <p>本件用量：{{ material.quantity }} {{ material.unit || '原版本未记录单位' }}</p>
        <dl v-for="(price, priceIndex) in material.prices" :key="priceIndex">
          <dt>价格物料／来源</dt><dd>{{ price.materialCode }} · {{ price.source }}</dd>
          <dt>采用基价</dt><dd class="formula">{{ price.baseFactors }}</dd>
          <dt>代入客户价</dt><dd class="formula">{{ price.customerFactors }}</dd>
          <dt>单价计算</dt><dd class="formula">{{ price.formula }}</dd>
        </dl>
        <p class="formula">{{ material.formula }}</p>
        <p>基准金额 {{ material.financialAmount }}；客户金额 {{ material.customerAmount }}；差异 {{ material.difference }}</p>
      </article>
      <p class="formula">差异加总：{{ sheet.explanation.materials.map(material => `(${material.difference})`).join(' + ') || '0' }}</p>
      <p><strong>保存的材料成本差异：{{ sheet.totals.cuMaterialAdjustment ?? '历史未记录' }}</strong></p>
      <h3>不含税成本2：成本1 + 材料成本差异</h3>
      <p class="formula">{{ sheet.totals.totalCost }} + ({{ sheet.totals.cuMaterialAdjustment }})</p>
      <p><strong>保存的不含税成本2：{{ sheet.totals.finalQuoteAmount ?? '历史未记录' }}</strong></p>
      <p role="note">{{ sheet.explanation.note }}</p>
    </template>
    <p v-else role="status">此历史版本未保存逐项计算依据，以上总额为原保存值。</p>
  </section>
</template>
<script setup>
defineProps({ sheet: { type: Object, required: true }, selectedTotal: String })
</script>
<style scoped>
.total-explanation { font-size: 13px; line-height: 1.65; }
table { width:100%; border-collapse:collapse; } th,td { padding:8px; border:1px solid #d1dce6; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
thead { background:#f2f6fa; } .formula { white-space:pre-wrap; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
article { margin:16px 0; padding:12px; border:1px solid #d1dce6; border-radius:4px; } h4 { margin-top:0; }
dl { display:grid; grid-template-columns:100px minmax(0,1fr); gap:8px; } dt { color:#526376; } dd { margin:0; }
</style>
