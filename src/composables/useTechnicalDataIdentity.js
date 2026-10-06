import { useRoute } from 'vue-router'
import { useUserStore } from '../store/modules/user'
import { useOaSessionStore } from '../store/modules/oaSession'

export function useTechnicalDataIdentity() {
  return useRoute().meta.technicalDataEntry ? useOaSessionStore() : useUserStore()
}
