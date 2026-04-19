<template>
  <!-- BOM 补充数据页面（占位） -->
  <div class="app-container">
    <el-card>
      <template #header>
        <span>BOM 补充数据</span>
      </template>
      <el-result v-if="loading" icon="info" title="加载中..." />
      <el-result v-else-if="error" icon="error" :title="error" />
      <div v-else>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="报价单号">{{ info.oaNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="协作类型">{{ info.tokenType || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-divider />
        <el-empty description="BOM 补充功能开发中，敬请期待" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
/**
 * OA 协作者 BOM 补充页面
 * 通过 token 参数访问后端获取报价单信息。
 * 当前为占位页面，具体业务逻辑待后续实现。
 */
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { request } from '../../api/http'

const route = useRoute()

/** 加载状态 */
const loading = ref(true)
/** 错误信息 */
const error = ref('')
/** 协作信息 */
const info = reactive({
  oaNo: '',
  tokenType: '',
})

onMounted(async () => {
  const token = route.query.token
  if (!token) {
    error.value = '缺少协作令牌'
    loading.value = false
    return
  }
  try {
    const data = await request(`/collaborate/bom-supplement`, {
      params: { token, oaNo: route.query.oaNo },
    })
    info.oaNo = data.oaNo || route.query.oaNo || ''
    info.tokenType = data.tokenType || ''
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.app-container {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}
</style>
