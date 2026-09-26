<template>
  <div class="collaboration-entry">
    <aside class="entry-sidebar" aria-label="协作页面导航">
      <h1>协作页面</h1>
      <router-link :to="workbenchLink" class="workbench-link" aria-current="page">补录工作台</router-link>
    </aside>
    <main class="entry-main">
      <header class="entry-header">
        <span>补录工作台</span>
        <span v-if="identityReady && !shortSession">{{ user.nickName || user.username }}</span>
      </header>
      <div class="entry-content">
        <el-skeleton v-if="verifying" :rows="6" animated />
        <router-view v-else-if="identityReady" />
        <el-result v-else icon="info" title="待办身份尚未确认" :sub-title="message">
          <template #extra><el-button @click="verifyIdentity">重新验证</el-button></template>
        </el-result>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../store/modules/user'

const route = useRoute(), user = useUserStore()
const verifying = ref(false), identityReady = ref(false)
const message = ref('请从 OA 待办链接进入补录工作台。')
const shortSession = computed(() => Boolean(route.meta.technicalDataShortSession))
const workbenchLink = computed(() => ({ path: route.path, query: route.query.submission ? { submission: route.query.submission } : {} }))

async function verifyIdentity() {
  if (verifying.value) return
  identityReady.value = false
  if (shortSession.value) {
    identityReady.value = Boolean(sessionStorage.getItem('technicalDataAccessToken')
      && sessionStorage.getItem('technicalDataAccessTaskId') === String(route.params.taskId))
    return
  }
  if (!user.token) return
  // 链接只负责定位单据；已验证身份仍由后端确认，不根据链接参数指定办理人。
  verifying.value = true
  try {
    await user.getInfo({ suppressErrorToast: true })
    identityReady.value = true
  } catch {
    message.value = '暂时无法确认办理人，请从 OA 待办重新进入。'
  } finally { verifying.value = false }
}
onMounted(verifyIdentity)
</script>

<style scoped>
.collaboration-entry { display: flex; height: 100vh; overflow: hidden; color: #344256; }
.entry-sidebar { width: 220px; flex-shrink: 0; background: white; border-right: 1px solid #ebeef5; }
.entry-sidebar h1 { height: 50px; line-height: 50px; margin: 0; font-size: 16px; text-align: center; border-bottom: 1px solid #ebeef5; }
.workbench-link { display: block; padding: 18px 24px; margin-top: 10px; color: #409eff; background: #f0f7ff; text-decoration: none; font-size: 14px; }
.entry-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.entry-header { display: flex; align-items: center; justify-content: space-between; height: 50px; flex-shrink: 0; padding: 0 20px; border-bottom: 1px solid #ebeef5; font-size: 13px; }
.entry-content { padding: 16px; overflow-y: auto; flex: 1; background: #f5f7fb; }
@media(max-width: 768px) { .entry-sidebar { width: 110px; } .workbench-link { padding: 16px 10px; } .entry-content { padding: 8px; } }
</style>
