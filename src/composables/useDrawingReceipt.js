import { onScopeDispose, ref, watch } from 'vue'
import { drawingReceipt } from '../utils/drawingPreparation.js'

/** 只读获取当前不可变结果；详情与历史弹窗相互独立，迟到响应不跨产品或月份。 */
export function useDrawingReceipt(scope, workspace, api, enabled) {
  const receipt = ref(null), loading = ref(false), error = ref('')
  let generation = 0, disposed = false
  async function refresh() {
    const id = ++generation, value = scope.value, state = workspace.value, task = state?.current
    receipt.value = null; error.value = ''; loading.value = false
    if (!enabled.value || !value.oaNo || !value.itemId || !/^\d{4}-\d{2}$/.test(value.month || '')
        || state?.oaNo !== value.oaNo || String(state?.itemId) !== String(value.itemId)
        || state?.accountingMonth !== value.month || task?.taskState !== 'RECEIVED' || !task.currentResultId) return
    loading.value = true
    try {
      const detail = await api(value.oaNo, value.itemId, value.month, task.currentResultId)
      if (!disposed && id === generation) receipt.value = drawingReceipt(state, detail)
    } catch (failure) {
      if (!disposed && id === generation) error.value = failure?.message || '已接收明细读取失败，请重试'
    } finally { if (!disposed && id === generation) loading.value = false }
  }
  watch(() => [scope.value.oaNo, scope.value.itemId, scope.value.month, enabled.value,
    workspace.value?.current?.localTaskId, workspace.value?.current?.currentResultId,
    workspace.value?.current?.taskState], refresh, { immediate: true })
  onScopeDispose(() => { disposed = true; generation++ })
  return { receipt, loading, error, refresh }
}
