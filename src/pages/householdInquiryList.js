import { reactive, watch } from 'vue'
import { inquiryMessage } from './householdInquiryUtils.js'

/** In-flight reads belong to the account and its current list permission. */
export function createInquiryList({ fetch, scope, allowed }) {
  const state = reactive({ rows: [], total: 0, loading: false, error: '' })
  let sequence = 0, disposed = false
  function clear() { sequence++; state.rows = []; state.total = 0; state.loading = false; state.error = '' }
  const stop = watch([scope, allowed], clear, { flush: 'sync' })
  async function load(query) {
    clear()
    const ticket = sequence, currentScope = scope()
    const active = () => !disposed && ticket === sequence && !!currentScope && currentScope === scope() && allowed()
    if (!active()) return
    state.loading = true
    try { const result = await fetch(query); if (active()) { state.rows = result.rows; state.total = result.total } }
    catch (failure) { if (active()) state.error = inquiryMessage(failure) }
    finally { if (active()) state.loading = false }
  }
  return { state, load, dispose() { disposed = true; stop(); clear() } }
}
