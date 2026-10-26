import { reactive } from 'vue'
import { inquiryPublishIdentity, inquiryMessage } from './householdInquiryUtils.js'

/** One server reservation per session; uncertain publication always keeps its original identity. */
export function createInquiryImportSession({ api, storage, scope }) {
  if (!scope) throw new Error('缺少当前账号范围')
  const key = `mpp-household-pending:${scope}`
  const state = reactive({ phase: 'EMPTY', preview: null, identity: null, result: null, busy: false, error: '' })
  let epoch = 0, disposed = false
  const active = ticket => !disposed && ticket === epoch
  function remember(phase) {
    try { storage.setItem(key, JSON.stringify({ identity: state.identity, phase, expiresAt: state.preview?.expiresAt })) }
    catch { throw new Error('无法保留原发布请求，请检查浏览器会话存储后重试') }
  }
  function forget() {
    try { storage.removeItem(key) }
    catch { /* A retained identity can only recover this same server receipt on the next open. */ }
  }
  // The server owns the deadline; a fast browser clock cannot close a live reservation.
  function expired() { return state.phase === 'EXPIRED' || state.preview?.status === 'EXPIRED' }
  function canPublish() {
    return !disposed && !state.busy && !!state.identity && ['UNCERTAIN', 'READY'].includes(state.phase)
  }
  function receive(view, phase) {
    state.preview = view; state.identity = inquiryPublishIdentity(view); state.result = null
    if (view.status === 'CANCELLED') state.phase = 'CANCELLED'
    else if (view.status === 'PUBLISHED') state.phase = 'UNCERTAIN'
    else if (phase) state.phase = phase
    else if (view.content?.workbook?.errors?.length) state.phase = 'ERRORS'
    else if (view.status === 'PREVIEW') state.phase = 'READY'
    else if (view.status === 'EXPIRED') state.phase = 'EXPIRED'
    else state.phase = 'CANCELLED'
  }
  async function inspect(file, metadata) {
    if (state.busy || disposed) return null
    if (state.phase === 'UNCERTAIN' || state.phase === 'PUBLISHING') throw new Error('请先核验原发布请求')
    if (state.preview) throw new Error('请先结束原预览后重新预览')
    const ticket = ++epoch; state.busy = true; state.error = ''
    try {
      const view = await api.preview(file, metadata)
      if (!active(ticket)) return null
      receive(view); remember(state.phase); return view
    } catch (error) {
      if (active(ticket)) { state.phase = 'ERROR'; state.error = inquiryMessage(error) }
      return null
    } finally { if (active(ticket)) state.busy = false }
  }
  async function publish() {
    if (!canPublish()) return null
    const ticket = ++epoch, wasUncertain = state.phase === 'UNCERTAIN'
    state.busy = true; state.error = ''; let dispatched = false
    try {
      // Persist before sending: navigation or lost responses must not create a replacement request.
      remember('UNCERTAIN'); state.phase = 'PUBLISHING'; dispatched = true
      const result = await api.publish(state.identity)
      if (!active(ticket)) return null
      state.result = result; state.phase = 'DONE'; forget(); return result
    } catch (error) {
      if (!active(ticket)) return null
      if (!dispatched) { state.phase = 'ERROR'; state.error = inquiryMessage(error); return null }
      const code = error.domainCode || String(error.message || '').split(':')[0]
      const known = { STALE_PREVIEW: 'STALE', PREVIEW_EXPIRED: 'EXPIRED', PREVIEW_HAS_ERRORS: 'ERRORS', PREVIEW_CLOSED: 'CANCELLED', IDEMPOTENCY_CONFLICT: 'INVALID', INVALID_REQUEST: 'INVALID', PUBLICATION_CONFLICT: 'READY' }
      state.phase = code === 'PUBLICATION_CONFLICT' && wasUncertain ? 'UNCERTAIN' : known[code] || (error.resultCode >= 400 && error.resultCode < 500 && !wasUncertain ? 'ERROR' : 'UNCERTAIN')
      state.error = state.phase === 'UNCERTAIN' ? '发布结果尚未确认，请核验原请求；不要重新上传或更换请求。' : inquiryMessage(error)
      try { remember(state.phase) } catch { /* The original UNCERTAIN reservation was saved before dispatch. */ }
      return null
    } finally { if (active(ticket)) state.busy = false }
  }
  async function resume() {
    if (state.busy || disposed) return false
    const ticket = ++epoch; state.busy = true; state.error = ''
    try {
      const saved = storage.getItem(key)
      if (!saved) return false
      const pending = JSON.parse(saved), identity = inquiryPublishIdentity(pending.identity)
      state.identity = identity
      if (pending.phase === 'UNCERTAIN') state.phase = 'UNCERTAIN'
      const view = await api.readPreview(identity.previewId)
      if (!active(ticket)) return false
      if (JSON.stringify(inquiryPublishIdentity(view)) !== JSON.stringify(identity)) { state.phase = 'INVALID'; throw new Error('原预览身份已不一致，请核对当前来源后重新预览') }
      const sticky = ['UNCERTAIN', 'STALE', 'EXPIRED', 'INVALID'].includes(pending.phase) ? pending.phase : undefined
      receive(view, sticky); return true
    } catch (error) {
      if (active(ticket)) { state.phase = state.phase === 'UNCERTAIN' ? 'UNCERTAIN' : 'ERROR'; state.error = state.phase === 'UNCERTAIN' ? '原预览暂时无法读取，请继续核验原发布请求。' : inquiryMessage(error) }
      return false
    } finally { if (active(ticket)) state.busy = false }
  }
  async function reset() {
    if (state.phase === 'UNCERTAIN' || state.phase === 'PUBLISHING') throw new Error('发布结果未确认，请先核验原请求')
    if (state.busy || disposed) return false
    const ticket = ++epoch; state.busy = true; state.error = ''
    try {
      if (state.preview && state.phase !== 'DONE') await api.cancel(state.identity.previewId)
      if (!active(ticket)) return false
      forget(); state.preview = null; state.identity = null; state.result = null; state.phase = 'EMPTY'; return true
    } catch (error) { if (active(ticket)) state.error = inquiryMessage(error); throw error }
    finally { if (active(ticket)) state.busy = false }
  }
  return { state, inspect, publish, resume, reset, canPublish, expired, dispose: () => { disposed = true; epoch++ } }
}
