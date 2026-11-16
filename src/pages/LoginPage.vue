<template>
  <main class="login-wrapper">
    <aside class="login-brand" aria-label="精准核算，有据报价">
      <img class="login-art" :src="costingBrandImage" width="1586" height="992"
        alt="精准核算 · 有据报价 — Accurate Costing · Evidence-Based Quoting" decoding="async" fetchpriority="high" />
    </aside>
    <section class="login-panel" aria-labelledby="login-title">
    <el-card class="login-card" shadow="never">
      <template #header>
        <header class="login-header">
          <img class="login-logo" :src="commercialLogo" width="912" height="970" alt="三花商用 SANHUA COMMERCIAL" />
          <h1 id="login-title">销售报价</h1>
          <p>每一笔成本都有据可查</p>
        </header>
      </template>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            autocomplete="username"
            name="username"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            name="password"
            :prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item label="业务单元" prop="businessUnitType">
          <el-select
            v-model="form.businessUnitType"
            placeholder="请选择业务单元"
            size="large"
            :loading="unitLoading"
            style="width: 100%"
          >
            <el-option
              v-for="item in businessUnits"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-alert
          v-if="loginError"
          class="login-error"
          type="error"
          :title="loginError"
          show-icon
          @close="loginError = ''"
        />
        <el-form-item class="login-submit">
          <el-button
            type="primary"
            size="large"
            style="width: 100%"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '../store/modules/user'
import { fetchDictDataByType } from '../api/system/dict'
import costingBrandImage from '../assets/login/login-costing-evidence.png'
import commercialLogo from '../assets/login/sanhua-commercial-logo.png'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)
const unitLoading = ref(false)
const businessUnits = ref([])
const loginError = ref('')

const form = reactive({
  username: '',
  password: '',
  businessUnitType: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  businessUnitType: [
    { required: true, message: '请选择业务单元', trigger: 'change' },
  ],
}

onMounted(async () => {
  unitLoading.value = true
  try {
    const units = (await fetchDictDataByType('biz_unit_type')) || []
    businessUnits.value = units.map((item) => ({
      ...item,
      label:
        item.value === 'COMMERCIAL'
          ? '商用'
          : item.value === 'HOUSEHOLD'
            ? '家用'
            : item.label,
    }))
  } catch (err) {
    ElMessage.error(err.message || '加载业务单元失败')
  } finally {
    unitLoading.value = false
  }
})

const handleLogin = async () => {
  loginError.value = ''
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login({
      username: form.username,
      password: form.password,
      businessUnitType: form.businessUnitType,
    })
    ElMessage.success('登录成功')
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    loginError.value = err.message || '登录失败'
    ElMessage.error(loginError.value)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrapper {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(440px, 39%);
  min-height: 100vh;
  min-height: 100svh;
  background: #fff;
  color: #24364a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --el-color-primary: #174b87;
  --el-color-primary-light-3: #426f9f;
  --el-color-primary-dark-2: #103963;
  --el-border-color: #d8e1ea;
  --el-border-color-hover: #9cabbc;
  --el-border-radius-base: 4px;
}

.login-brand {
  display: grid;
  place-items: center;
  min-width: 0;
  overflow: hidden;
  background: #edf4fb;
  border-right: 1px solid #e5edf5;
}

.login-art {
  display: block;
  width: 100%;
  height: auto;
  mask-image: linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent);
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 48px clamp(36px, 4vw, 80px);
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 360px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}

.login-card :deep(.el-card__header),
.login-card :deep(.el-card__body) {
  padding: 0;
  border: 0;
}

.login-header {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: 24px;
  row-gap: 6px;
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid #e8edf3;
}

.login-logo {
  display: block;
  grid-row: 1 / 3;
  align-self: center;
  width: 72px;
  height: auto;
}

.login-header h1 {
  align-self: end;
  margin: 0;
  color: #163b65;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 1px;
}

.login-header p {
  margin: 0;
  color: #66788b;
  font-size: 14px;
  line-height: 1.7;
}

.login-card :deep(.el-form-item) {
  margin-bottom: 24px;
}

.login-card :deep(.el-form-item__label) {
  height: auto;
  margin-bottom: 8px;
  padding: 0;
  color: #34465a;
  font-size: 14px;
  line-height: 20px;
}

.login-card :deep(.el-input__wrapper),
.login-card :deep(.el-select__wrapper) {
  min-height: 46px;
  box-sizing: border-box;
  font-size: 14px;
}

.login-card :deep(.el-input__prefix) {
  color: #8b99a9;
}

.login-card .login-submit {
  margin: 28px 0 0;
}

.login-submit :deep(.el-button) {
  height: 46px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 2px;
}

.login-error {
  margin-bottom: 18px;
}

@media (max-width: 900px) {
  .login-wrapper { grid-template-columns: 1fr; }
  .login-brand { display: none; }
  .login-panel { padding: 40px 28px; }
}

@media (max-width: 380px) {
  .login-panel { padding-right: 24px; padding-left: 24px; }
  .login-header { grid-template-columns: 60px minmax(0, 1fr); column-gap: 18px; }
  .login-logo { width: 60px; }
  .login-header h1 { font-size: 27px; }
  .login-header p { font-size: 13px; }
}

@media (max-height: 720px) and (min-width: 901px) {
  .login-panel { padding-top: 28px; padding-bottom: 28px; }
  .login-header { margin-bottom: 24px; padding-bottom: 24px; }
}
</style>
