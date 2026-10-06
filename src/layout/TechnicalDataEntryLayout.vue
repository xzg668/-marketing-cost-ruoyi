<template>
  <div class="collaboration-entry">
    <aside class="entry-sidebar" aria-label="协作页面导航">
      <h1>协作页面</h1>
      <router-link :to="workbenchLink" class="workbench-link" aria-current="page">补录工作台</router-link>
    </aside>
    <main class="entry-main">
      <header class="entry-header">
        <span>补录工作台</span>
        <span v-if="identityReady">{{ identity.nickName || identity.username }}</span>
      </header>
      <div class="entry-content">
        <el-skeleton v-if="verifying" :rows="6" animated />
        <router-view v-else-if="identityReady" />
        <el-result v-else icon="info" title="待办身份尚未确认" :sub-title="message">
          <template #extra><el-button @click="beginLogin">重新验证</el-button></template>
        </el-result>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useOaSessionStore } from '../store/modules/oaSession'
import { startOaLogin } from '../api/oaOAuth'
import { browserKey, OA_BROWSER_KEY, readOaSession } from '../utils/oaSession'

const route = useRoute(), identity = useOaSessionStore()
const verifying = ref(false), identityReady = ref(false)
const message = ref('请从 OA 链接进入补录工作台。')
const workbenchLink = computed(() => ({ path: route.path }))

async function beginLogin() {
  if (verifying.value) return
  identityReady.value = false; verifying.value = true; identity.clear()
  try {
    const key = browserKey()
    sessionStorage.setItem(OA_BROWSER_KEY, key)
    const result = await startOaLogin({
      formId: route.params.formId ? Number(route.params.formId) : null,
      taskId: route.params.formId ? null : Number(route.params.taskId),
      submission: route.query.submission || null, browserKey: key,
    })
    window.location.assign(result.authorizeUrl)
  } catch (error) { message.value = error.message || '暂时无法连接 OA，请稍后重新验证。' }
  finally { verifying.value = false }
}
async function verifyIdentity() {
  if (verifying.value) return
  identityReady.value = false
  if (!readOaSession()?.accessToken || route.params.taskId) return beginLogin()
  verifying.value = true
  try {
    await identity.verify()
    if (route.params.formId && String(identity.formId) !== String(route.params.formId)) {
      verifying.value = false
      return beginLogin()
    }
    identityReady.value = true
  } catch (error) { message.value = error.message || '身份已过期，请重新验证。'; identity.clear() }
  finally { verifying.value = false }
}
function expired() { identityReady.value = false; identity.clear(); message.value = 'OA 会话已过期，请重新验证后继续。' }
window.addEventListener('oa-session-expired', expired)
onBeforeUnmount(() => window.removeEventListener('oa-session-expired', expired))
watch([() => route.params.formId, () => route.params.taskId], verifyIdentity, { immediate: true })
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
