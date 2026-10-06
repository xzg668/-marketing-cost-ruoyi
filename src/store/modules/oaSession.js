import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchOaIdentity } from '../../api/oaOAuth'
import { OA_SESSION_KEY, readOaSession } from '../../utils/oaSession'

export const useOaSessionStore = defineStore('oaSession', () => {
  const userId = ref(null), nickName = ref(''), username = ref(''), formId = ref(null)
  const businessUnitType = ref('OA')
  async function verify() {
    if (!readOaSession()?.accessToken) throw new Error('请从 OA 重新进入')
    const identity = await fetchOaIdentity()
    userId.value = identity.userId
    nickName.value = identity.name
    username.value = identity.employeeNo
    formId.value = identity.formId
    return identity
  }
  function clear() {
    sessionStorage.removeItem(OA_SESSION_KEY)
    userId.value = null; nickName.value = ''; username.value = ''; formId.value = null
  }
  return { userId, nickName, username, formId, businessUnitType, verify, clear }
})
