<template>
  <div class="sidebar" :class="{ collapsed: effectiveCollapsed }">
    <div class="sidebar-logo">
      <span v-if="!effectiveCollapsed">产品成本核算</span>
      <span v-else>成本</span>
    </div>
    <el-scrollbar>
      <div v-if="displayRoutes.length === 0" class="sidebar-empty">
        <el-empty
          v-if="!effectiveCollapsed"
          description="当前账号无菜单权限"
          :image-size="60"
        />
      </div>
      <el-menu
        v-else
        class="sidebar-menu"
        :default-active="activeMenu"
        :collapse="effectiveCollapsed"
        :collapse-transition="false"
        :unique-opened="false"
        background-color="#ffffff"
        text-color="#1f2a37"
        active-text-color="#409eff"
      >
        <sidebar-item
          v-for="route in displayRoutes"
          :key="route.path + '-' + (route.meta?.title || '')"
          :route="route"
          base-path=""
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePermissionStore } from '../../store/modules/permission'
import { useAppStore } from '../../store/modules/app'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const appStore = useAppStore()
const permissionStore = usePermissionStore()
const isNarrowViewport = ref(false)

const TEMPORARILY_HIDDEN_MENU_IDS = new Set([
  // 其他费用率对照表：暂时不展示侧边栏入口，后端 V176 同步隐藏菜单数据。
  312,
])
const TEMPORARILY_HIDDEN_MENU_TITLES = new Set(['其他费用率对照表'])
const TEMPORARILY_HIDDEN_MENU_PATHS = new Set(['other', '/base/other', 'base/other'])

function isTemporarilyHiddenMenu(route) {
  const title = String(route?.meta?.title || '').replace(/\s/g, '')
  return (
    TEMPORARILY_HIDDEN_MENU_IDS.has(route?.meta?.menuId) ||
    TEMPORARILY_HIDDEN_MENU_TITLES.has(title) ||
    TEMPORARILY_HIDDEN_MENU_PATHS.has(route?.path)
  )
}

function pruneHiddenMenus(route) {
  if (!route || isTemporarilyHiddenMenu(route)) {
    return null
  }
  const children = Array.isArray(route.children)
    ? route.children.map(pruneHiddenMenus).filter(Boolean)
    : undefined
  return children ? { ...route, children } : route
}

const displayRoutes = computed(() =>
  permissionStore.routes.map(pruneHiddenMenus).filter(Boolean)
)

const activeMenu = computed(() => route.meta?.activeMenu || route.path)
const effectiveCollapsed = computed(() => appStore.sidebarCollapsed || isNarrowViewport.value)

function syncViewport() {
  isNarrowViewport.value = window.innerWidth <= 768
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
})
</script>

<style scoped>
.sidebar {
  width: 220px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #ebeef5;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-logo {
  height: 50px;
  line-height: 50px;
  padding: 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
  border-bottom: 1px solid #ebeef5;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 220px;
}

.sidebar-empty {
  padding: 24px 12px;
  color: #9ca3af;
  text-align: center;
}
</style>
