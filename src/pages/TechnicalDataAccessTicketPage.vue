<template>
  <main class="ticket-entry">
    <el-card class="ticket-card" shadow="never">
      <el-result
        v-if="state === 'loading'"
        icon="info"
        title="正在验证技术资料待办"
        sub-title="一次性票据仅在本次跳转中使用"
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
const message = ref('票据无效、已使用或已过期，请从 OA 重新进入。')

onMounted(async () => {
  const ticket = String(route.query.ticket || '')
  const expectedUserId = Number(route.query.userId || 0)
  if (!ticket || !expectedUserId) {
    state.value = 'error'
    message.value = '链接缺少票据或用户绑定信息，请从 OA 重新进入。'
    return
  }
  try {
    const result = await exchangeTechnicalDataAccessTicket(ticket, expectedUserId)
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
