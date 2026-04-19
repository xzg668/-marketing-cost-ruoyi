<template>
  <!-- 协作者受限布局：仅顶栏 + 内容区，无侧边栏菜单 -->
  <el-container class="collaborate-layout">
    <el-header class="collaborate-header">
      <div class="header-left">
        <span class="title">三花成本报价系统 — 协作填报</span>
      </div>
      <div class="header-right">
        <!-- 显示报价单号 -->
        <el-tag v-if="oaNo" type="info" size="large">报价单号：{{ oaNo }}</el-tag>
      </div>
    </el-header>
    <el-main class="collaborate-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
/**
 * OA 协作者受限布局
 * 简化版布局：无侧边栏、无菜单，仅展示顶栏（标题 + 报价单号）和内容区。
 * 报价单号从 URL query 参数 oaNo 读取。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

/** 从 URL query 中获取报价单号 */
const oaNo = computed(() => route.query.oaNo || '')
</script>

<style scoped>
.collaborate-layout {
  height: 100vh;
  flex-direction: column;
}

.collaborate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #409eff;
  color: #fff;
  padding: 0 20px;
  height: 50px;
  line-height: 50px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.header-left .title {
  font-size: 16px;
  font-weight: 600;
}

.collaborate-main {
  padding: 16px;
  overflow-y: auto;
  background: #f5f7fb;
}
</style>
