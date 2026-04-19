<template>
  <el-container class="layout">
    <el-aside width="260px" class="sidebar">
      <div class="sidebar-title">产品成本核算</div>
      <el-menu
        class="app-menu"
        :default-active="active"
        :default-openeds="defaultOpeneds"
        @select="handleSelect"
      >
        <el-sub-menu
          v-for="group in menus"
          :key="group.index"
          :index="group.index"
        >
          <template #title>
            <span>{{ group.title }}</span>
          </template>
          <template v-for="item in group.children" :key="item.index">
            <el-sub-menu
              v-if="item.children"
              :index="item.index"
              class="nested-menu"
            >
              <template #title>
                <span>{{ item.title }}</span>
              </template>
              <el-menu-item
                v-for="child in item.children"
                :key="child.index"
                :index="child.index"
              >
                {{ child.title }}
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.index">
              {{ item.title }}
            </el-menu-item>
          </template>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentTitle }}</div>
        <el-button type="danger" text @click="handleLogout">退出登录</el-button>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { menuGroups } from '../menu'
import { useUserStore } from '../store/modules/user'
import { resetDynamicRoutes } from '../router'

const menus = menuGroups
const defaultOpeneds = menus.flatMap((group) => {
  const indexes = [group.index]
  group.children?.forEach((item) => {
    if (item.children) {
      indexes.push(item.index)
    }
  })
  return indexes
})

const route = useRoute()
const router = useRouter()

const active = computed(() => route.meta?.activeMenu || route.path)
const currentTitle = computed(() => route.meta?.title || '菜单')

const handleSelect = (index) => {
  if (index.startsWith('/')) {
    router.push(index)
  }
}

const userStore = useUserStore()

const handleLogout = () => {
  userStore.logout()
  resetDynamicRoutes()
  router.push('/login')
}
</script>

<style scoped>
.layout {
  height: 100vh;
  background: #f5f7fb;
}

.sidebar {
  border-right: 1px solid #ebeef5;
  background: #ffffff;
}

.sidebar-title {
  padding: 16px 18px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
  border-bottom: 1px solid #ebeef5;
}

.app-menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a37;
}

.main {
  padding: 16px;
}
</style>
