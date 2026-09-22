<template>
  <main class="ticket-entry">
    <el-card class="ticket-card" shadow="never">
      <el-result
        v-if="state === 'loading'"
        icon="info"
        title="正在验证技术资料待办"
        sub-title="按当前 OA 登录身份进入本人待办"
      />
      <el-result
        v-else
        icon="error"
        title="待办链接不可用"
        :sub-title="message"
      >
        <template #extra>
          <el-button type="primary" @click="goLogin">返回系统登录</el-button>
        </template>
      </el-result>
    </el-card>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeTechnicalDataAccessTicket } from '../api/technicalDataTasks'

const route = useRoute()
const router = useRouter()
const state = ref('loading')
const message = ref('身份验证无效、已使用或已过期，请从 OA 重新进入。')

onMounted(async () => {
  const taskId = Number(route.query.taskId)
  const code = new URLSearchParams(window.location.hash.slice(1)).get('code')
  // 身份码放在片段中，不进入服务访问日志；读取后立即清除，URL 始终只定位产品任务。
  if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  if (!Number.isSafeInteger(taskId) || taskId <= 0) {
    state.value = 'error'
    message.value = '链接缺少有效任务编号，请从 OA 重新进入。'
    return
  }
  if (!code) {
    if (sessionStorage.getItem('technicalDataAccessTaskId') === String(taskId) && sessionStorage.getItem('technicalDataAccessToken')) {
      await router.replace({ name: 'technical-data-access-workbench', params: { taskId } })
      return
    }
    if (localStorage.getItem('token')) {
      await router.replace({ name: 'technical-data-workbench', params: { taskId } })
      return
    }
    state.value = 'error'
    message.value = '请从 OA 待办验证身份，或登录报价系统后打开此任务。'
    return
  }
  sessionStorage.removeItem('technicalDataAccessToken')
  sessionStorage.removeItem('technicalDataAccessTaskId')
  try {
    const result = await exchangeTechnicalDataAccessTicket(taskId, code)
    sessionStorage.setItem('technicalDataAccessToken', result.accessToken)
    sessionStorage.setItem('technicalDataAccessTaskId', String(result.taskId))
    await router.replace(result.entryPath)
  } catch (error) {
    state.value = 'error'
    message.value = error?.message || message.value
  }
})

function goLogin() {
  sessionStorage.removeItem('technicalDataAccessToken')
  sessionStorage.removeItem('technicalDataAccessTaskId')
  router.replace('/login')
}
</script>

<style scoped>
.ticket-entry { min-height: 100vh; display: grid; place-items: center; background: #f5f7fa; }
.ticket-card { width: min(560px, calc(100vw - 32px)); }
</style>
