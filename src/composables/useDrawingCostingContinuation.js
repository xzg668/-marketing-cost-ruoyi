import { onScopeDispose, ref, watch } from 'vue'

/** 仅接续用户已发起且因图纸确认等待的核算；普通查询不会发起核算。 */
export function useDrawingCostingContinuation(scope, {
  fetchDrawing, resume, onError = () => {}, sessionKey, storage = globalThis.sessionStorage,
}) {
  const waiting = ref(false)
  const states = new Map(), intents = new Map()
  let generation = 0, disposed = false, key = null, resuming = false
  const targetKey = options => options.itemId == null ? 'WHOLE' : String(options.itemId)

  function save() {
    waiting.value = intents.size > 0
    if (!storage || !key) return
    try {
      if (intents.size) storage.setItem(key, JSON.stringify([...intents.values()]))
      else storage.removeItem(key)
    } catch { /* 禁用浏览器存储时仍支持当前页续接。 */ }
  }
  function clear() { intents.clear(); save() }
  watch(scope, () => {
    generation++; intents.clear(); states.clear(); waiting.value = false; resuming = false
    key = sessionKey ? `drawing-costing:${sessionKey()}` : null
    try {
      const saved = key && storage?.getItem(key)
      for (const value of saved ? JSON.parse(saved) : []) {
        if (value.tasks?.length && /^\d{4}-\d{2}$/.test(value.options?.periodMonth)) {
          intents.set(targetKey(value.options), value)
        }
      }
      waiting.value = intents.size > 0
    } catch { /* 损坏的页面记录不作为发起核算的依据。 */ }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; generation++; intents.clear(); states.clear() })

  async function remember(outcome, options = {}) {
    // 整单替代既有单行意图；单行互相独立。显式单行检查后不再自动提交旧整单。
    if (options.itemId == null) intents.clear()
    else { intents.delete('WHOLE'); intents.delete(targetKey(options)) }
    save()
    if (!outcome || outcome.batch || outcome.product || !outcome.checks?.length) return
    const captured = generation
    const checks = outcome.checks.filter(check => check.pipelineStatus === 'BLOCKED' && check.currentStep === 'QUOTE_BOM')
    const tasks = []
    for (const check of checks) {
      try {
        const workspace = await fetchDrawing(scope.value, check.oaFormItemId, check.periodMonth)
        if (disposed || captured !== generation) return
        const task = workspace?.current
        if (['WAIT_REVIEW', 'REQUESTING'].includes(task?.taskState)
            || (task?.taskState === 'RECEIVED' && task.consumptionState === 'PENDING')) {
          tasks.push({ itemId: String(check.oaFormItemId), month: check.periodMonth, taskId: task.localTaskId })
        }
      } catch { /* 缺少可靠状态时不猜测续接；仍可按产品行处理和重新核算。 */ }
    }
    if (!tasks.length || disposed || captured !== generation) return
    const intent = { options: { ...options, periodMonth: tasks[0].month }, tasks }
    intents.set(targetKey(options), intent)
    save()
    await maybeResume()
  }

  async function accept(workspace) {
    if (!workspace) return
    states.set(`${workspace.itemId}:${workspace.accountingMonth}`, workspace.current)
    await maybeResume()
  }

  async function maybeResume() {
    if (resuming || disposed) return
    resuming = true
    const captured = generation
    try {
      for (const [id, intent] of [...intents]) {
        if (disposed || captured !== generation) return
        const tasks = intent.tasks.map(target => ({ target, task: states.get(`${target.itemId}:${target.month}`) }))
        if (tasks.some(({ target, task }) => task && (task.localTaskId !== target.taskId || ['FAILED', 'SUPERSEDED'].includes(task.taskState)))) {
          intents.delete(id); save(); continue
        }
        if (!tasks.every(({ task }) => task?.taskState === 'RECEIVED' && task.consumptionState === 'COMPLETE')) continue
        // 在提交前消费意图；焦点事件、轮询及重复回传不能重复提交。
        intents.delete(id); save()
        try { await resume(intent.options) }
        catch (error) { if (!disposed && generation === captured) onError(error) }
      }
    } finally { if (generation === captured) resuming = false }
  }

  return { waiting, remember, accept, clear }
}
