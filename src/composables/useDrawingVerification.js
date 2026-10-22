import { onScopeDispose, ref, watch } from 'vue'
import { drawingNeedsRefresh } from '../utils/drawingVerification.js'

/** 当前产品/月的只读刷新与明确操作分开；迟到回执不会污染下一产品。 */
export function useDrawingVerification(scope, api, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const state = ref(null), detail = ref(null), loading = ref(false), busy = ref(false)
  const detailLoading = ref(false), error = ref(''), detailError = ref('')
  let generation = 0, readId = 0, detailId = 0
  let timer = null, disposed = false
  function stopTimer() { if (timer !== null) clearTimer(timer); timer = null }
  function schedule() {
    stopTimer()
    if (!disposed && valid() && (error.value || drawingNeedsRefresh(state.value?.current))) {
      timer = setTimer(refresh, 3000)
    }
  }
  const args = () => [scope.value.oaNo, scope.value.itemId, scope.value.month]
  const valid = () => scope.value.oaNo && scope.value.itemId && /^\d{4}-\d{2}$/.test(scope.value.month || '')

  async function refresh() {
    if (!valid() || busy.value) return
    stopTimer()
    const current = generation, id = ++readId
    loading.value = true
    try {
      const next = await api.fetch(...args())
      if (current !== generation || id !== readId) return
      state.value = next; error.value = ''
    } catch (failure) {
      if (current === generation && id === readId) error.value = failure.message || '图库状态读取失败'
    } finally {
      if (current === generation && id === readId) { loading.value = false; schedule() }
    }
  }

  async function operate(action, drawingNo) {
    if (!valid() || busy.value) return null
    const current = generation
    busy.value = true; readId++; loading.value = false
    stopTimer()
    try {
      const next = await api.operate(...args(), { action, drawingNo: drawingNo || null, expectedTaskId: state.value?.current?.localTaskId || null })
      if (current !== generation) return null
      state.value = next; error.value = ''; detail.value = null; detailId++
      return next
    } catch (failure) {
      if (current === generation) error.value = failure.message || '图库操作未完成，请刷新状态查看'
      return null
    } finally { if (current === generation) { busy.value = false; schedule() } }
  }

  async function openResult(resultId) {
    if (!valid()) return
    const current = generation, id = ++detailId
    detail.value = null; detailError.value = ''; detailLoading.value = true
    try {
      const next = await api.detail(...args(), resultId)
      if (current === generation && id === detailId) detail.value = next
    } catch (failure) {
      if (current === generation && id === detailId) detailError.value = failure.message || '图库历史读取失败'
    } finally { if (current === generation && id === detailId) detailLoading.value = false }
  }

  watch(scope, () => {
    stopTimer()
    generation++; readId++; detailId++
    state.value = null; detail.value = null; error.value = ''; detailError.value = ''
    busy.value = false; loading.value = false; detailLoading.value = false
    refresh()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; stopTimer(); generation++; readId++; detailId++ })
  return { state, detail, loading, busy, detailLoading, error, detailError, refresh, operate, openResult }
}
