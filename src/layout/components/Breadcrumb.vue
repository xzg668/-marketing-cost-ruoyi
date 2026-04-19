<template>
  <el-breadcrumb class="breadcrumb" separator="/">
    <el-breadcrumb-item
      v-for="(item, idx) in breadcrumbs"
      :key="item.path + idx"
      :to="idx < breadcrumbs.length - 1 && item.redirect !== 'noRedirect' ? { path: item.path } : undefined"
    >
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

/** 从 matched 列表剔除根 "/" 及无 meta.title 的占位节点 */
const breadcrumbs = computed(() => {
  const matched = route.matched || []
  return matched
    .filter((m) => m.meta && m.meta.title && m.path !== '/')
    .map((m) => ({
      path: m.path || '/',
      title: m.meta.title,
      redirect: m.redirect,
    }))
})
</script>

<style scoped>
.breadcrumb {
  display: inline-flex;
  align-items: center;
  height: 100%;
  font-size: 13px;
}
</style>
