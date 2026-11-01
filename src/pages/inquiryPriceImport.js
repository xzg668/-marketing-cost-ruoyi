import { reactive } from 'vue'
import { createUuid } from '../utils/uuid.js'

/** The selected month is part of preview and retry identity, never inferred from the filename. */
export function createInquiryImport({ api, scope, month, onImported = () => {}, uuid = createUuid }) {
  const state = reactive({ preview: null, busy: false, error: '', fileName: '', priceMonth: '' })
  let file = null, requestId = '', generation = 0
  const reset = () => {
    generation++; file = null; requestId = ''
    Object.assign(state, { preview: null, busy: false, error: '', fileName: '', priceMonth: '' })
  }
  const current = (ticket, owner, selectedMonth) => ticket === generation && owner === scope() && selectedMonth === month()
  async function select(selected) {
    reset()
    if (!selected) return
    if (!selected.size || selected.size > 10 * 1024 * 1024) { state.error = '请选择非空且不超过10 MB的Excel文件'; return }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month() || '')) { state.error = '请先选择价格月份'; return }
    file = selected; requestId = uuid(); state.fileName = selected.name; state.priceMonth = month(); state.busy = true
    const ticket = generation, owner = scope(), selectedMonth = state.priceMonth
    try {
      const result = await api.preview(file, selectedMonth)
      if (current(ticket, owner, selectedMonth)) state.preview = result
    } catch (failure) { if (current(ticket, owner, selectedMonth)) state.error = failure.message || '文件预览失败' }
    finally { if (current(ticket, owner, selectedMonth)) state.busy = false }
  }
  async function publish() {
    if (state.busy || !state.preview || !file) return null
    if (state.priceMonth !== month()) { reset(); state.error = '价格月份已改变，请重新选择文件'; return null }
    const ticket = generation, owner = scope(), selectedMonth = state.priceMonth
    state.busy = true; state.error = ''
    try {
      const result = await api.publish(file, selectedMonth, requestId)
      if (!current(ticket, owner, selectedMonth)) return null
      reset(); onImported(result); return result
    } catch (failure) { if (current(ticket, owner, selectedMonth)) state.error = failure.message || '导入失败，可重试同一请求'; return null }
    finally { if (current(ticket, owner, selectedMonth)) state.busy = false }
  }
  return { state, select, publish, reset }
}
