<template>
  <el-container class="app-layout">
    <sidebar />
    <el-container class="main-container">
      <navbar />
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}

.main-container {
  flex-direction: column;
  overflow: hidden;
}

.app-main {
  padding: 16px;
  overflow-y: auto;
  background: #f5f7fb;
}
</style>
