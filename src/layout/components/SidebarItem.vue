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
const ICONLESS_MENU_TITLES = new Set([
  'U9数据',
  'U9基础数据',
  'CMS数据',
  'CMS成本数据',
  '供应商供货比例',
  '供应商供货比率',
])
const ICONLESS_MENU_PATHS = new Set([
  '/base/u9',
  'base/u9',
  '/base/cms-cost',
  'base/cms-cost',
  '/base/supplier-relation/supply-ratio',
  'base/supplier-relation/supply-ratio',
])

const fullPath = computed(() => resolveRoutePath(props.basePath, props.route.path))

const visibleChildren = computed(() => {
  const kids = Array.isArray(props.route.children) ? props.route.children : []
  return kids.filter((c) => c && !c.meta?.hidden)
})

const iconComponent = computed(() => {
  if (shouldHideIcon.value) return null
  const name = props.route.meta?.icon
  if (!name) return null
  return ElIcons[name] || null
})

const shouldHideIcon = computed(() => {
  const title = String(props.route.meta?.title || '').replace(/\s/g, '')
  return ICONLESS_MENU_TITLES.has(title) || ICONLESS_MENU_PATHS.has(fullPath.value)
})

function onClick() {
  if (fullPath.value) router.push(fullPath.value)
}
</script>
