import { computed, onScopeDispose, ref, watch } from 'vue'

/** 详情与单产品工作台共用资料检查与核算；查询只读，提交由核算或补齐资料的动作触发。 */
export function useQuoteCostingPreparation(oaNo, api, scope = oaNo) {
  const state = ref(null)
  const checks = ref([])
  const busy = ref(false)
  const error = ref('')
  let generation = 0
  let readId = 0
  const disabled = computed(() => busy.value || !state.value || !state.value.canCost || Boolean(error.value))
  const wholeLabel = '整单核算'

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
    try {
      const outcome = await api.submit(oaNo.value, options)
      if (scope !== generation) return null
      state.value = outcome.preparation
      checks.value = outcome.checks || []
      error.value = ''
      return outcome
    } catch (failure) {
      if (scope !== generation) return null
      await refresh()
      throw failure
    } finally {
      if (scope === generation) busy.value = false
    }
  }

  watch(scope, () => {
    generation++; readId++
    state.value = null; checks.value = []; error.value = ''; busy.value = false
    refresh()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { generation++; readId++ })
  return { state, checks, busy, error, disabled, wholeLabel, refresh, submit }
}
