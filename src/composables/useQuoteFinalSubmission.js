import { computed, onScopeDispose, ref, watch } from 'vue'

/** 列表金额与整单提交共用一次读取；提交使用用户刚看到的指纹，变化时由后台拒绝。 */
export function useQuoteFinalSubmission(oaNo, api) {
  const state = ref(null)
  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  let generation = 0
  let readId = 0
  let pendingRequest = null
  const canSubmit = computed(() => state.value?.canConfirm === true && !loading.value && !sending.value && !error.value)
  const costsByItem = computed(() => new Map((state.value?.costs || []).map(row => [String(row.itemId), row])))

  async function refresh() {
    const scope = generation, id = ++readId, number = oaNo.value
    if (!number) return
    loading.value = true
    try {
      const next = await api.fetch(number)
      if (scope !== generation || id !== readId) return
      state.value = next
      error.value = ''
    } catch (failure) {
      if (scope === generation && id === readId) {
        state.value = null
        error.value = failure?.message || '成本提交状态读取失败，请刷新重试'
      }
    } finally { if (scope === generation && id === readId) loading.value = false }
  }

  async function submit() {
    if (!canSubmit.value) return null
    const scope = generation, number = oaNo.value, current = state.value
    sending.value = true
    readId++
    if (!pendingRequest || pendingRequest.fingerprint !== current.fingerprint) {
      pendingRequest = { fingerprint: current.fingerprint, periodMonth: current.periodMonth, requestKey: globalThis.crypto.randomUUID() }
    }
    try {
      const next = await api.submit(number, pendingRequest)
      if (scope !== generation) return null
      readId++
      loading.value = false
      state.value = next
      pendingRequest = null
      error.value = ''
      return next
    } catch (failure) {
      if (scope !== generation) return null
      await refresh()
      throw failure
    } finally { if (scope === generation) sending.value = false }
  }

  watch(oaNo, () => {
    generation++; readId++; pendingRequest = null
    state.value = null; error.value = ''; loading.value = false; sending.value = false
    refresh()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++; readId++ })
  return { state, loading, sending, error, canSubmit, costsByItem, refresh, submit }
}
