<template>
  <section aria-label="制造件价格关联明细" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button @click="load">重试</el-button></el-alert>
    <template v-if="data">
      <p>{{ data.group.row.parentMaterialNo }} · {{ data.group.row.parentMaterialName }} · {{ data.group.row.pricingMonth }} · 组织 {{ data.group.organization || '未记录' }}</p>
      <p>零件价格 {{ data.group.row.parentTotalCostPrice ?? '未取得' }}；相同计算依据共生成 {{ data.group.calculationCount }} 次，关联 {{ data.quoteTotal }} 张报价单。</p>
      <el-tabs v-model="tab">
        <el-tab-pane label="原料／废料明细" name="materials">
          <el-table :data="data.materials" border row-key="id" max-height="490">
            <el-table-column prop="childMaterialNo" label="原材料代码" width="155" />
            <el-table-column label="原材料/毛坯" min-width="180"><template #default="{ row }">{{ row.childMaterialSpec || row.childMaterialName || '-' }}</template></el-table-column>
            <el-table-column prop="qtyPerParent" label="单件用量" width="115" />
            <el-table-column prop="stockUnit" label="单位" width="80" />
            <el-table-column prop="grossWeightG" label="毛重(g)" min-width="180"><template #default="{ row }">{{ grossWeightWithSource(row.grossWeightG, manufacturingGrossWeightSource(row)) }}</template></el-table-column>
            <el-table-column prop="netWeightG" label="净重(g)" width="115" />
            <el-table-column prop="rawUnitPrice" label="原材料价格(元/kg 或 元/件)" width="190" />
            <el-table-column prop="scrapCode" label="回收代码" width="150" />
            <el-table-column prop="scrapName" label="回收名称" width="150" />
            <el-table-column prop="scrapUnitPrice" label="回收单价(元/kg)" width="150" />
            <el-table-column prop="outsourceFee" label="委外加工费" width="130" />
            <el-table-column prop="costPrice" label="本行成本" width="130" />
            <el-table-column label="操作" width="140" fixed="right"><template #default="{ row }"><el-button type="primary" link @click="$emit('trace', row)">查看计算追溯</el-button></template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="关联报价单" name="quotes">
          <el-table :data="data.quotations" border row-key="oaNo" max-height="490">
            <el-table-column prop="oaNo" label="报价单号" min-width="270" />
            <el-table-column prop="calculationCount" label="生成次数" width="110" />
            <el-table-column prop="latestGeneratedAt" label="最近生成时间" width="190" />
            <el-table-column label="操作" width="180"><template #default="{ row }"><el-button type="primary" link @click="$emit('trace', { id: row.latestRowId })">查看该单计算追溯</el-button></template></el-table-column>
          </el-table>
          <BasePagination v-model:current-page="page" v-model:page-size="size" :total="data.quoteTotal" />
        </el-tab-pane>
      </el-tabs>
    </template>
  </section>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { fetchMakePartPriceGroupDetails } from '../api/makePartPriceCalc'
import BasePagination from './BasePagination.vue'
import { grossWeightWithSource, manufacturingGrossWeightSource } from '../utils/jjbSheet'
const props = defineProps({ groupId: { type: [Number, String], required: true }, initialTab: { type: String, default: 'materials' } })
defineEmits(['trace'])
const data = ref(null), loading = ref(false), error = ref(''), page = ref(1), size = ref(20), tab = ref(props.initialTab)
let requestId = 0
async function load() {
  const request = ++requestId
  loading.value = true; error.value = ''; data.value = null
  try {
    const result = await fetchMakePartPriceGroupDetails(props.groupId, { page: page.value, pageSize: size.value })
    if (request === requestId) data.value = result
  } catch (failure) { if (request === requestId) error.value = failure?.message || '读取关联明细失败' }
  finally { if (request === requestId) loading.value = false }
}
watch(() => [props.groupId, page.value, size.value], load, { immediate: true })
watch(() => props.initialTab, value => { tab.value = value })
onBeforeUnmount(() => { requestId++ })
</script>
