<template>
  <el-container class="collaborate-layout">
    <el-aside v-if="requiresPortalToken" class="collaborate-sidebar" width="196px">
      <div class="sidebar-brand">
        <span class="brand-mark">协</span>
        <span>成本报价协作</span>
      </div>
      <el-menu router :default-active="activeMenu" class="collaborate-menu">
        <el-menu-item index="/collaborate/tasks">
          <el-icon><Tickets /></el-icon>
          <span>协作任务</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="collaborate-body">
      <el-header class="collaborate-header">
        <span class="page-title">{{ pageTitle }}</span>
        <el-tag v-if="oaNo" type="info" effect="plain">报价单号：{{ oaNo }}</el-tag>
      </el-header>
      <el-main class="collaborate-main">
        <el-result
          v-if="requiresPortalToken && !portalReady"
          icon="warning"
          title="协作链接无效"
          sub-title="链接没有携带有效的协作凭证，请从报价系统重新打开技术协作任务。"
        />
        <router-view v-else />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
/**
 * 技术协作者受限布局：只提供协作任务入口，不复用主系统菜单。
 */
import { computed } from 'vue'
import { Tickets } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import {
  captureCollaborationPortalToken,
  getCollaborationPortalToken,
} from '../utils/collaborationPortal'

const route = useRoute()
captureCollaborationPortalToken()

const oaNo = computed(() => route.query.oaNo || '')
const requiresPortalToken = computed(() => Boolean(route.meta?.collaborationPortal))
const portalReady = computed(() => Boolean(getCollaborationPortalToken()))
const activeMenu = computed(() => requiresPortalToken.value ? '/collaborate/tasks' : route.path)
const pageTitle = computed(() => requiresPortalToken.value
  ? '技术协作中心'
  : route.meta?.title || '协作填报')
</script>

<style scoped>
.collaborate-layout {
  height: 100vh;
  overflow: hidden;
  background: #f5f7fb;
}

.collaborate-sidebar {
  height: 100vh;
  background: #fff;
  border-right: 1px solid #e8edf3;
}

.sidebar-brand {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  color: #1f2a37;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e8edf3;
}

.brand-mark {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #409eff;
  border-radius: 8px;
}

.collaborate-menu {
  padding: 10px 8px;
  border-right: 0;
}

.collaborate-menu :deep(.el-menu-item) {
  height: 44px;
  border-radius: 8px;
}

.collaborate-body {
  min-width: 0;
  flex-direction: column;
}

.collaborate-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e8edf3;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a37;
}

.collaborate-main { padding: 16px; overflow-y: auto; }

@media (max-width: 768px) {
  .collaborate-sidebar { width: 148px !important; }
  .sidebar-brand { padding: 0 12px; font-size: 14px; }
  .collaborate-main { padding: 10px; }
}
</style>
