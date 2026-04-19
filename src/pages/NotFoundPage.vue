<template>
  <div class="not-found">
    <div class="code">404</div>
    <div class="tip">抱歉，您访问的页面不存在或无权限</div>
    <el-button type="primary" @click="goHome">返回首页</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const goHome = () => router.replace('/')
</script>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  background: #f5f7fb;
}
.code {
  font-size: 96px;
  font-weight: 700;
  color: #1f2a37;
}
.tip {
  color: #4b5563;
  font-size: 14px;
}
</style>
