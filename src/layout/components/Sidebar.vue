<template>
  <div class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
    <div class="sidebar-logo">
      <span v-if="!appStore.sidebarCollapsed">产品成本核算</span>
      <span v-else>成本</span>
    </div>
    <el-scrollbar>
      <div v-if="displayRoutes.length === 0" class="sidebar-empty">
        <el-empty
          v-if="!appStore.sidebarCollapsed"
          description="当前账号无菜单权限"
          :image-size="60"
        />
      </div>
      <el-menu
        v-else
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
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const appStore = useAppStore()
const permissionStore = usePermissionStore()

// 过渡期（T04~T08）：后端 sys_menu 中仍然残留老业务顶级 200/300/400/500（cost-trial/base-data/rate/price），
// 它们跟前端目录命名不对应。T08 会物理删除，在那之前这里主动过滤，避免侧边栏出现新旧两套业务菜单。
// T08 完成后 permissionStore 自然不再返回它们，此过滤不生效但无害，可在后续维护时删除。
const LEGACY_TOP_MENU_IDS = new Set([200, 300, 400, 500])

const displayRoutes = computed(() =>
  permissionStore.routes.filter((r) => !LEGACY_TOP_MENU_IDS.has(r.meta?.menuId))
)

const activeMenu = computed(() => route.meta?.activeMenu || route.path)
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
