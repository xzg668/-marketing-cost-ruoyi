<template>
  <main class="oa-login">
    <el-result :icon="failed ? 'warning' : 'info'" :title="failed ? 'OA 免登未完成' : '正在进入补录工作台'"
      :sub-title="message" />
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { exchangeOaLogin } from '../api/oaOAuth'
import { OA_BROWSER_KEY, OA_SESSION_KEY, safeEntryPath } from '../utils/oaSession'

const router = useRouter(), failed = ref(false), message = ref('正在确认 OA 身份，请稍候。')
onMounted(async () => {
  const values = new URLSearchParams(window.location.hash.slice(1))
  window.history.replaceState(window.history.state, '', window.location.pathname)
  const verifier = sessionStorage.getItem(OA_BROWSER_KEY)
  sessionStorage.removeItem(OA_BROWSER_KEY)
  sessionStorage.removeItem(OA_SESSION_KEY)
  try {
    if (values.get('error')) throw new Error(values.get('error'))
    if (!values.get('ticket') || !verifier) throw new Error('本次免登校验已失效，请关闭此页，从 OA 原链接重新进入。')
    const session = await exchangeOaLogin({ ticket: values.get('ticket'), verifier })
    if (!safeEntryPath(session.entryPath) || !session.accessToken) throw new Error('免登返回内容无效，请重新进入。')
    sessionStorage.setItem(OA_SESSION_KEY, JSON.stringify(session))
    await router.replace(session.entryPath)
  } catch (error) { failed.value = true; message.value = error.message || '请从 OA 重新进入。' }
})
</script>

<style scoped>
.oa-login { display: grid; place-items: center; min-height: 100vh; background: #f5f7fb; }
</style>
