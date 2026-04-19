import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as apiLogin, fetchCurrentUser } from '../../api/auth'

const TOKEN_KEY = 'token'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const username = ref('')
  const nickName = ref('')
  const userId = ref(null)
  const roles = ref([])
  const permissions = ref([])
  const businessUnitType = ref('')

  async function login({ username: u, password, businessUnitType: unit }) {
    const data = await apiLogin({
      username: u,
      password,
      businessUnitType: unit,
    })
    token.value = data.token
    username.value = data.username || u
    localStorage.setItem(TOKEN_KEY, data.token)
    return data
  }

  async function getInfo() {
    const info = await fetchCurrentUser()
    userId.value = info.userId ?? null
    username.value = info.username || username.value
    nickName.value = info.nickName || ''
    roles.value = info.roles || []
    permissions.value = info.permissions || []
    businessUnitType.value = info.businessUnitType || ''
    return info
  }

  function logout() {
    token.value = ''
    userId.value = null
    username.value = ''
    nickName.value = ''
    roles.value = []
    permissions.value = []
    businessUnitType.value = ''
    localStorage.removeItem(TOKEN_KEY)
  }

  return {
    token,
    userId,
    username,
    nickName,
    roles,
    permissions,
    businessUnitType,
    login,
    getInfo,
    logout,
  }
})
