<template>
  <div class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
    <div class="sidebar-logo">
      <span v-if="!appStore.sidebarCollapsed">产品成本核算</span>
      <span v-else>成本</span>
    </div>
    <el-scrollbar>
      <el-menu
        class="sidebar-menu"
        :default-active="activeMenu"
        :collapse="appStore.sidebarCollapsed"
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePermissionStore } from '../../store/modules/permission'
import { useAppStore } from '../../store/modules/app'
import { menuGroups } from '../../menu'
import { menuGroupsToRoutes } from '../utils/menuAdapter'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const appStore = useAppStore()
const permissionStore = usePermissionStore()

/** 优先用动态路由；动态业务菜单因历史 component 路径无法解析时，用静态业务菜单补齐。 */
const displayRoutes = computed(() => {
  const fallbackRoutes = menuGroupsToRoutes(menuGroups)
  if (permissionStore.routes.length === 0) return fallbackRoutes

  const usedTopPaths = new Set(
    permissionStore.routes.map((r) => normalizeTopPath(r.path))
  )
  const missingFallbackRoutes = fallbackRoutes.filter(
    (r) => !usedTopPaths.has(normalizeTopPath(r.path))
  )
  return [...permissionStore.routes, ...missingFallbackRoutes]
})

const activeMenu = computed(() => route.meta?.activeMenu || route.path)

function normalizeTopPath(path) {
  return String(path || '').replace(/^\/+/, '')
}
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
</style>
