import { reactive } from 'vue'
import { createUuid } from '../utils/uuid.js'

/** Keeps a retry on the same publish identity and discards responses from a former file/scope. */
export function createInvoiceImport({ api, scope, onImported = () => {}, uuid = createUuid }) {
  const state = reactive({ preview: null, busy: false, error: '', fileName: '' })
  let file = null, requestId = '', generation = 0
  const reset = () => {
    generation++
    file = null
    requestId = ''
    Object.assign(state, { preview: null, busy: false, error: '', fileName: '' })
  }
  async function select(selected) {
    reset()
    if (!selected) return
    if (!selected.size || selected.size > 10 * 1024 * 1024) {
      state.error = '请选择非空且不超过10 MB的Excel文件'
      return
    }
    file = selected
    requestId = uuid()
    state.fileName = selected.name
    state.busy = true
    const ticket = generation, owner = scope()
    try {
      const result = await api.preview(file)
      if (ticket === generation && owner === scope()) state.preview = result
    } catch (failure) {
      if (ticket === generation && owner === scope()) state.error = failure.message || '文件预览失败'
    } finally {
      if (ticket === generation && owner === scope()) state.busy = false
    }
  }
  async function publish(orgCode) {
    if (state.busy || !state.preview || !file) return null
    const ticket = generation, owner = scope()
    state.busy = true
    state.error = ''
    try {
      const result = await api.publish(file, orgCode, requestId)
      if (ticket !== generation || owner !== scope()) return null
      reset()
      onImported(result)
      return result
    } catch (failure) {
      if (ticket === generation && owner === scope()) state.error = failure.message || '导入失败，可重试同一请求'
      return null
    } finally {
      if (ticket === generation && owner === scope()) state.busy = false
    }
  }
  return { state, select, publish, reset }
}
