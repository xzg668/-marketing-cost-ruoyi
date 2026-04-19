<template>
  <template v-if="visibleChildren.length === 0">
    <el-menu-item v-if="!route.meta?.hidden" :index="fullPath" @click="onClick">
      <el-icon v-if="iconComponent"><component :is="iconComponent" /></el-icon>
      <template #title>{{ route.meta?.title || route.path }}</template>
    </el-menu-item>
  </template>
  <el-sub-menu v-else-if="!route.meta?.hidden" :index="fullPath">
    <template #title>
      <el-icon v-if="iconComponent"><component :is="iconComponent" /></el-icon>
      <span>{{ route.meta?.title || route.path }}</span>
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
import { useRouter } from 'vue-router'
import * as ElIcons from '@element-plus/icons-vue'
import { resolveRoutePath } from '../utils/resolveRoutePath'

const props = defineProps({
  route: { type: Object, required: true },
  basePath: { type: String, default: '' },
})

const router = useRouter()

const fullPath = computed(() => resolveRoutePath(props.basePath, props.route.path))

const visibleChildren = computed(() => {
  const kids = Array.isArray(props.route.children) ? props.route.children : []
  return kids.filter((c) => c && !c.meta?.hidden)
})

const iconComponent = computed(() => {
  const name = props.route.meta?.icon
  if (!name) return null
  return ElIcons[name] || null
})

function onClick() {
  if (fullPath.value) router.push(fullPath.value)
}
</script>
