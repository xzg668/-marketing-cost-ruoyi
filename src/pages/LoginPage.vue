<template>
  <div class="login-wrapper">
    <el-card class="login-card" shadow="hover">
      <template #header>
        <div class="login-header">产品成本核算系统</div>
      </template>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="0"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item prop="businessUnitType">
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
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            style="width: 100%"
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '../store/modules/user'
import { fetchDictDataByType } from '../api/system/dict'

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
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f5f7fb;
}

.login-card {
  width: 400px;
}

.login-header {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #1f2a37;
}

.login-error {
  margin-bottom: 18px;
}
</style>
