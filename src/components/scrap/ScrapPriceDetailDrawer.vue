<template>
  <el-drawer :model-value="modelValue" title="废料价格详情" size="620px" @update:model-value="$emit('update:modelValue', $event)">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="价格月份">{{ record.priceMonth }}</el-descriptions-item>
      <el-descriptions-item label="料号">{{ record.materialCode }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ record.materialName }}</el-descriptions-item>
      <el-descriptions-item label="规格">{{ record.specification || '—' }}</el-descriptions-item>
      <el-descriptions-item label="供应商代码">{{ record.supplierCode || '—' }}</el-descriptions-item>
      <el-descriptions-item label="供应商名称">{{ record.supplierName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="价格类型">{{ typeLabel(record.priceType) }}</el-descriptions-item>
      <el-descriptions-item label="不含税单价"><span v-if="record.calcStatus === 'READY'">{{ displayPrice(record.unitPrice) }} 元 / 公斤</span><span v-else>{{ calcStatusLabel(record.calcStatus) }}</span></el-descriptions-item>
      <el-descriptions-item label="规则来源月份">{{ record.ruleSourceMonth }}</el-descriptions-item>
      <el-descriptions-item v-if="record.priceType === 'FIXED'" label="固定金额">{{ displayPrice(record.fixedPrice) }} 元 / 公斤</el-descriptions-item>
      <template v-else>
        <el-descriptions-item label="计算公式">{{ record.expression }}</el-descriptions-item>
        <el-descriptions-item label="基价来源">商用财务基价</el-descriptions-item>
        <el-descriptions-item label="基价月份">{{ record.financeMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="基价方案">{{ record.schemeCode || '—' }}</el-descriptions-item>
      </template>
    </el-descriptions>
    <el-alert v-if="record.calcStatus !== 'READY'" :title="record.calcMessage || calcStatusLabel(record.calcStatus)" :type="record.calcStatus === 'WAITING_BASE' ? 'warning' : 'error'" :closable="false" class="section" />
    <template v-if="factors.length">
      <h3>计算依据</h3>
      <el-table :data="factors" border><el-table-column prop="variable" label="变量" width="95" /><el-table-column prop="name" label="商用基价" /><el-table-column label="含税元 / 公斤" min-width="160"><template #default="{ row }">{{ displayPrice(row.price) }}</template></el-table-column></el-table>
    </template>
    <h3>来源记录</h3>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="维护方式">{{ originLabel }}</el-descriptions-item>
      <el-descriptions-item label="导入文件">{{ record.sourceFileName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="原文件位置">{{ record.sourceSheet || '—' }}<span v-if="record.sourceRow"> · 第 {{ record.sourceRow }} 行</span></el-descriptions-item>
      <el-descriptions-item v-if="record.sourceFormula" label="来源公式">{{ record.sourceFormula }}</el-descriptions-item>
      <el-descriptions-item v-if="source.source" label="来源">{{ source.source }}</el-descriptions-item>
      <el-descriptions-item v-if="source.approvalType" label="批单类型">{{ source.approvalType }}</el-descriptions-item>
      <el-descriptions-item v-if="source.approvalNo" label="批单编号">{{ source.approvalNo }}</el-descriptions-item>
      <el-descriptions-item label="导入时间">{{ record.importedAt || '—' }}</el-descriptions-item>
      <el-descriptions-item label="最后维护">{{ record.updatedBy || '—' }} · {{ record.updatedAt || '—' }}</el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { calcStatusLabel, displayPrice, scrapFactorDetails, typeLabel } from '../../pages/scrapPriceUtils.js'
const props = defineProps({ modelValue: Boolean, record: { type: Object, required: true } })
defineEmits(['update:modelValue'])
const factors = computed(() => scrapFactorDetails(props.record))
const source = computed(() => JSON.parse(props.record.sourceJson || '{}'))
const originLabel = computed(() => ({ IMPORT: 'Excel 导入', MANUAL: '手工修改', CARRY_FORWARD: '沿用已有规则' }[props.record.originType] || '—'))
</script>

<style scoped>
h3 { font-size: 14px; font-weight: 600; margin: 24px 0 12px; }
.section { margin-top: 16px; }
:deep(.el-descriptions__content) { overflow-wrap: anywhere; }
</style>
