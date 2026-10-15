<template>
  <template v-if="visibleChildren.length === 0">
    <el-menu-item v-if="!route.meta?.hidden" :index="fullPath" :aria-label="title">
      <span class="sidebar-menu-compact" aria-hidden="true">{{ title }}</span>
      <template #title><span class="sidebar-menu-label" :title="title">{{ title }}</span></template>
    </el-menu-item>
  </template>
  <el-sub-menu
    v-else-if="!route.meta?.hidden"
    :index="fullPath"
    :aria-label="title"
    popper-class="sidebar-menu-popper"
  >
    <template #title>
      <span class="sidebar-menu-compact" aria-hidden="true">{{ title }}</span>
      <span class="sidebar-menu-label" :title="title">{{ title }}</span>
    </template>
    <sidebar-item
      v-for="child in visibleChildren"
      :key="child.path + '-' + (child.meta?.title || '')"
      :route="child"
      :base-path="fullPath"
    />
  </el-sub-menu>
</template>

<script setup>
import { computed } from 'vue'
import { resolveRoutePath } from '../utils/resolveRoutePath'

const props = defineProps({
  route: { type: Object, required: true },
  basePath: { type: String, default: '' },
})

const title = computed(() => props.route.meta?.title || props.route.path)
const fullPath = computed(() => resolveRoutePath(props.basePath, props.route.path))

const visibleChildren = computed(() => {
  const kids = Array.isArray(props.route.children) ? props.route.children : []
  return kids.filter((c) => c && !c.meta?.hidden)
})

</script>
