<template>
  <div class="navbar">
    <div class="navbar-left">
      <el-icon class="hamburger" :size="20" @click="appStore.toggleSidebar">
        <Fold v-if="!appStore.sidebarCollapsed" />
        <Expand v-else />
      </el-icon>
      <breadcrumb />
    </div>
    <div class="navbar-right">
      <el-tag v-if="businessUnitLabel" type="info" size="small" class="unit-tag">
        {{ businessUnitLabel }}
      </el-tag>
      <el-dropdown trigger="click">
        <span class="user-info">
          <el-avatar :size="28" :icon="UserFilled" />
          <span class="user-name">{{ displayName }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="onLogout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  Fold,
  Expand,
  UserFilled,
  ArrowDown,
  SwitchButton,
} from '@element-plus/icons-vue'
import { useUserStore } from '../../store/modules/user'
import { useAppStore } from '../../store/modules/app'
import { resetDynamicRoutes } from '../../router'
import Breadcrumb from './Breadcrumb.vue'

const BUSINESS_UNIT_LABELS = {
  COMMERCIAL: '商用部品',
  HOUSEHOLD: '家用部品',
}

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const displayName = computed(
  () => userStore.nickName || userStore.username || '未登录用户'
)
const businessUnitLabel = computed(
  () => BUSINESS_UNIT_LABELS[userStore.businessUnitType] || ''
)

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  userStore.logout()
  resetDynamicRoutes()
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  height: 50px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hamburger {
  cursor: pointer;
  color: #5a6775;
}

.hamburger:hover {
  color: #409eff;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.unit-tag {
  font-weight: 500;
}

.user-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #1f2a37;
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
