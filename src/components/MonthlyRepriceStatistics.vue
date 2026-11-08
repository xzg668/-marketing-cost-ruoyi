<template>
  <div v-if="statistics" class="reprice-statistics" aria-label="调价数量统计">
    <div v-for="(group,index) in [items.slice(0,4),items.slice(4)]" :key="index" class="stat-group" :class="{ outcomes:index===1 }">
      <div v-for="item in group" :key="item.key" :class="{ attention: item.attention && statistics[item.key] > 0 }">
        <span>{{ item.label }}</span><strong>{{ format(statistics[item.key]) }}</strong>
      </div>
    </div>
  </div>
</template>
<script setup>
defineProps({ statistics: Object })
const items = [
  { key: 'sources', label: '原报价来源' }, { key: 'objects', label: '去重后客户产品' },
  { key: 'groups', label: '不同成本组合' }, { key: 'calculationAttempts', label: '实际计算次数' },
  { key: 'successful', label: '成功客户产品' }, { key: 'failed', label: '核算失败', attention: true },
  { key: 'running', label: '正在核算' }, { key: 'pending', label: '等待核算' },
  { key: 'unresolvedSources', label: '客户资料待完善', attention: true },
]
const format = value => Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—'
</script>
<style scoped>
.reprice-statistics{display:grid;gap:10px;margin:8px 0}.stat-group{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.stat-group.outcomes{grid-template-columns:repeat(5,minmax(0,1fr))}
.stat-group>div{display:flex;flex-direction:column;gap:9px;padding:12px 14px;background:#f6f8fb;border-radius:6px}
.reprice-statistics span{font-size:12px;color:#606266}.reprice-statistics strong{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.reprice-statistics .attention{background:#fff5ec;color:#ac5916}
@media(max-width:760px){.stat-group,.stat-group.outcomes{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
