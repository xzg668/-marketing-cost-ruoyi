<template>
  <section class="cms-cost-page">
    <header class="cms-cost-page__header">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="cms-cost-page__actions">
        <slot name="actions" />
      </div>
    </header>

    <el-tabs
      v-if="traceNav"
      class="cms-cost-page__tabs"
      :model-value="activePath"
      @tab-change="handleTabChange"
    >
      <el-tab-pane
        v-for="item in traceNavItems"
        :key="item.path"
        :label="item.label"
        :name="item.path"
      />
    </el-tabs>

    <main class="cms-cost-page__body">
      <slot />
    </main>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  traceNav: { type: Boolean, default: false },
})

const router = useRouter()
const route = useRoute()
const activePath = computed(() => route.path)

const traceNavItems = [
  { label: '计划成本', path: '/base/cms-cost/plan-rows' },
  { label: '车间料工费', path: '/base/cms-cost/workshop-rows' },
  { label: '科目成本', path: '/base/cms-cost/subject-rows' },
  { label: '科目设置', path: '/base/cms-cost/subject-settings' },
  { label: '回收废料映射导入', path: '/base/cms-cost/material-scrap-refs' },
  { label: '生效来源', path: '/base/cms-cost/effective-sources' },
]

function handleTabChange(path) {
  if (path && path !== route.path) router.push(path)
}
</script>

<style scoped>
.cms-cost-page {
  padding: 20px;
}

.cms-cost-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.cms-cost-page__header h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.35;
  color: #1f2a37;
}

.cms-cost-page__header p {
  margin: 6px 0 0;
  color: #606266;
  font-size: 14px;
}

.cms-cost-page__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cms-cost-page__tabs {
  margin-bottom: 16px;
}

.cms-cost-page__body {
  min-height: 320px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 18px;
}

@media (max-width: 768px) {
  .cms-cost-page {
    padding: 12px;
  }

  .cms-cost-page__header {
    flex-direction: column;
  }

  .cms-cost-page__actions {
    justify-content: flex-start;
  }
}
</style>
