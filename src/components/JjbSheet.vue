<template>
  <section class="jjb-sheet" :data-version-id="sheet.identity.versionId">
    <div v-for="warning in sheet.warnings" :key="warning" class="jjb-warning" role="note">{{ warning }}</div>
    <div class="jjb-scroll">
      <table class="jjb-table" aria-label="产品成本计算一览表">
        <colgroup><col v-for="(column, index) in jjbColumns" :key="column[0]" :style="{ width: `${jjbColumnWidths[index] / totalWidth * 100}%` }" /></colgroup>
        <thead>
          <tr class="jjb-title"><th colspan="15"><h2>产品成本计算一览表</h2></th></tr>
          <tr v-for="(header, index) in headers" :key="index" class="jjb-header" :style="{ height: `${header.height}px` }">
            <td v-for="cell in header.cells" :key="cell.column" :colspan="cell.colspan" :class="{ 'header-label': cell.label }" :title="cell.value">{{ cell.value }}</td>
          </tr>
          <tr class="jjb-columns"><th v-for="(column, index) in jjbColumns" :key="column[0]" scope="col" :class="{ 'metal-column': index >= 6 && index <= 9 }">{{ column[1] }}</th></tr>
        </thead>
        <tbody v-for="group in groups" :key="group.code" :data-section="group.code">
          <tr v-for="(row, index) in group.rows" :key="row.key" :data-row-key="row.key" :data-row-code="row.code" :data-kind="row.kind" :class="[`kind-${row.kind.toLowerCase()}`, { 'summary-row': row.code === 'MANUFACTURE_COST' }]">
            <td v-for="cell in sheetRowCells(row, group, index)" :key="cell.column" :colspan="cell.colspan" :rowspan="cell.rowspan" :data-column="cell.key" :class="{ numeric: numericColumns.has(cell.key), 'side-label': cell.label }" :title="cell.key === 'basis' ? rowBasis(row) : cell.value">
              <button v-if="cell.key === 'amount' && row.amount != null" class="jjb-trace-link" type="button" @click="$emit('trace', row)">{{ savedMoney(row.amount) }}</button>
              <template v-else>{{ cell.value }}</template>
            </td>
          </tr>
        </tbody>
        <tbody class="jjb-totals">
          <tr v-for="total in totals" :key="total.key" :data-total="total.key">
            <th colspan="3" scope="row">{{ total.name }}</th><td></td><td></td>
            <td class="numeric" data-column="amount">{{ savedMoney(total.amount) }}</td>
            <td v-for="column in 9" :key="column">{{ column === 8 && total.amount == null ? '历史未记录' : '' }}</td>
          </tr>
          <tr class="jjb-note"><td colspan="15">成本版本：{{ sheet.identity.versionNo || sheet.identity.costRunNo }}；核算月份：{{ sheet.identity.pricingMonth }}。金额为元/件；产品属性系数已包含在保存金额中。{{ sheet.header.descriptionBasis }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { jjbColumns, jjbColumnWidths, sheetHeaderRows, sheetGroups, sheetRowCells, savedMoney, rowBasis, sheetTotals } from '../utils/jjbSheet'
const props = defineProps({ sheet: { type: Object, required: true } })
defineEmits(['trace'])
const headers = computed(() => sheetHeaderRows(props.sheet))
const groups = computed(() => sheetGroups(props.sheet))
const totals = computed(() => sheetTotals(props.sheet))
const totalWidth = jjbColumnWidths.reduce((sum, width) => sum + width, 0)
const numericColumns = new Set(['unitPrice', 'quantity', 'amount', 'grossWeight', 'netWeight', 'rawUnitPrice', 'scrapUnitPrice', 'coefficient'])
</script>
<style scoped>
.jjb-sheet { background:#fff; color:#000; padding:8px; }
.jjb-scroll { overflow:auto; }
.jjb-table { border-collapse:collapse; table-layout:fixed; width:100%; min-width:1480px; border:2px solid #000; font:12px SimSun,"Songti SC",serif; }
.jjb-table th,.jjb-table td { border:1px solid #000; padding:2px 3px; height:24px; box-sizing:border-box; text-align:center; vertical-align:middle; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.jjb-title th { height:57px; border:0; }
.jjb-title h2 { margin:0; font-size:24px; font-weight:700; letter-spacing:2px; }
.jjb-header td { white-space:pre-line; overflow-wrap:anywhere; }
.header-label { font-weight:700; }
.jjb-columns th { height:43px; white-space:pre-line; background:#fff; font-weight:700; }
.jjb-columns .metal-column { background:#f00; }
.jjb-table .numeric { font-variant-numeric:tabular-nums; }
.jjb-table .side-label { font-weight:700; white-space:normal; }
.kind-subtotal td,.kind-property td,.summary-row td { font-weight:700; }
.kind-subtotal td,.kind-property td,.summary-row td { background:#ef939e; }
.kind-property td:first-child { background:#fff; }
tr[data-row-code="MATERIAL"] td[data-column="amount"] { font-weight:700; }
.kind-explanation td { height:40px; }
.kind-explanation td[data-column="code"] { white-space:pre-line; line-height:16px; }
.jjb-totals th,.jjb-totals .numeric { font-weight:700; }
.jjb-totals tr[data-total="TOTAL_2"] { border-bottom:2px solid #000; font-size:13px; }
.jjb-trace-link { border:0; padding:0; background:none; color:inherit; font:inherit; cursor:pointer; }
.jjb-trace-link:hover { text-decoration:underline; }
.jjb-table .jjb-note td { white-space:normal; text-align:left; height:38px; font-size:11px; }
.jjb-warning { background:#fff6e1; padding:8px 12px; margin-bottom:10px; font:13px sans-serif; }
@media print { .jjb-sheet { padding:0; } .jjb-scroll { overflow:visible; } .jjb-table { min-width:0; font-size:8pt; } }
</style>
