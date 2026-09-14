import { onScopeDispose, ref, watch } from 'vue'

/** 整单任务只负责提交和跟踪进度；页面负责展示、结果刷新和导航。 */
export function useQuoteBatchCosting(oaNo, {
  fetchProgress,
  submitBatch,
  refreshDetail,
  onSubmitted = () => {},
  onFinished = () => {},
  onError = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const batchRun = ref(null)
  const batchSubmitting = ref(false)
  let generation = 0
  let requestId = 0
  let disposed = false
  let timer = null
  let retryRead = false
  let refreshPending = false

  function stopTimer() {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  // 代次而非仅单号比较，能拦住 A → B → A 时第一张 A 的迟到响应。
  function captureScope() {
    const captured = generation
    return {
      oaNo: oaNo.value,
      isCurrent: () => !disposed && captured === generation,
    }
  }

  watch(oaNo, () => {
    generation++
    requestId++
    stopTimer()
    batchRun.value = null
    batchSubmitting.value = false
    refreshPending = false
    retryRead = false
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    generation++
    stopTimer()
  })

  function schedule(scope) {
    if (!scope.isCurrent()) return
    stopTimer()
    if (batchRun.value?.active || refreshPending || retryRead) {
      timer = setTimer(() => loadBatchProgress(), 2000)
    }
  }

  async function acceptProgress(next, scope, isCurrent, submitted = false) {
    if (!isCurrent()) return
    const finished = Boolean(next && !next.active && (submitted || batchRun.value?.active))
    retryRead = false
    batchRun.value = next
    if (finished) {
      refreshPending = true
      onFinished(next)
    }
    if (refreshPending) {
      // 即使任务已结束也重试详情读取，避免进度完成而产品行仍显示“核算中”。
      try {
        await refreshDetail({ ...scope, isCurrent })
        if (isCurrent()) refreshPending = false
      } catch {
        // 提交已经成功；仅重试结果读取，不将其误报为提交失败。
      }
    }
  }

  async function loadBatchProgress() {
    const scope = captureScope()
    if (!scope.oaNo || !scope.isCurrent() || batchSubmitting.value) return
    stopTimer()
    const id = ++requestId
    const isCurrent = () => scope.isCurrent() && id === requestId
    try {
      const next = await fetchProgress(scope.oaNo)
      await acceptProgress(next, scope, isCurrent)
    } catch {
      if (isCurrent()) retryRead = true
      // 保留最后一次有效进度，暂时的读取失败由下一次轮询恢复。
    } finally {
      if (isCurrent()) schedule(scope)
    }
  }

  async function submitWholeQuoteCosting() {
    const scope = captureScope()
    if (!scope.oaNo || !scope.isCurrent() || batchSubmitting.value || batchRun.value?.active) return
    stopTimer()
    const id = ++requestId
    const isCurrent = () => scope.isCurrent() && id === requestId
    batchSubmitting.value = true
    try {
      const next = await submitBatch(scope.oaNo, { mode: 'ALL' })
      if (!isCurrent()) return
      onSubmitted(next)
      await acceptProgress(next, scope, isCurrent, true)
    } catch (error) {
      if (isCurrent()) onError(error)
    } finally {
      if (isCurrent()) {
        batchSubmitting.value = false
        schedule(scope)
      }
    }
  }

  return { batchRun, batchSubmitting, loadBatchProgress, submitWholeQuoteCosting, captureScope }
}
