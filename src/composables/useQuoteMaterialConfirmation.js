import { computed, onScopeDispose, ref, watch } from 'vue'

/** 详情与单产品工作台共用资料确认状态；只有显式操作才提交。防重以服务端 OA 待办为准。 */
export function useQuoteMaterialConfirmation(oaNo, api) {
  const state = ref(null)
  const checks = ref([])
  const busy = ref(false)
  const error = ref('')
  let generation = 0
  let readId = 0
  let requestKey = null
  const needsConfirmation = computed(() => state.value?.needsConfirmation === true)
  const disabled = computed(() => busy.value || !state.value || !state.value.canConfirm || Boolean(error.value))
  const retry = computed(() => ['REJECTED', 'NOT_SENT'].includes(state.value?.status))
  const wholeLabel = computed(() => retry.value ? '重试资料确认并整单核算' : '确认资料并整单核算')
  const productLabel = computed(() => retry.value ? '重试资料确认并核算本产品' : '确认整单资料并核算本产品')

  async function refresh() {
    const scope = generation, id = ++readId, number = oaNo.value
    if (!number) return
    try {
      const next = await api.fetch(number)
      if (scope !== generation || id !== readId) return
      state.value = next
      error.value = ''
    } catch (failure) {
      if (scope === generation && id === readId) error.value = failure?.message || '资料状态读取失败，请刷新重试'
    }
  }

  async function submit(options = {}) {
    if (busy.value) return null
    const scope = generation
    busy.value = true
    readId++
    requestKey ||= globalThis.crypto.randomUUID()
    try {
      const outcome = await api.submit(oaNo.value, { ...options, requestKey, retryRejected: retry.value })
      if (scope !== generation) return null
      state.value = outcome.confirmation
      checks.value = outcome.checks || []
      error.value = ''
      requestKey = null
      return outcome
    } catch (failure) {
      if (scope !== generation) return null
      await refresh()
      throw failure
    } finally {
      if (scope === generation) busy.value = false
    }
  }

  watch(oaNo, () => {
    generation++; readId++; requestKey = null
    state.value = null; checks.value = []; error.value = ''; busy.value = false
    refresh()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++; readId++ })
  return { state, checks, busy, error, disabled, needsConfirmation, wholeLabel, productLabel, refresh, submit }
}
