const TOKEN_KEY = 'collaboration_portal_token'
const PORTAL_PREFIX = '/collaborate/'

export const isCollaborationPortalPath = (path = globalThis.location?.pathname || '') =>
  String(path).startsWith(PORTAL_PREFIX)

export const getCollaborationPortalToken = () =>
  globalThis.sessionStorage?.getItem(TOKEN_KEY) || ''

export const hasCollaborationPortalSession = () =>
  Boolean(getCollaborationPortalToken())

export const clearCollaborationPortalToken = () =>
  globalThis.sessionStorage?.removeItem(TOKEN_KEY)

/**
 * OA 链接把令牌放在 URL 片段中，浏览器首次打开后立即转存到当前标签页会话并清掉地址栏。
 * 片段不会作为 HTTP 请求发送，因此不会进入网关访问日志或 Referer。
 */
export function captureCollaborationPortalToken() {
  const hash = String(globalThis.location?.hash || '').replace(/^#/, '')
  if (!hash) return getCollaborationPortalToken()
  const token = new URLSearchParams(hash).get('access_token')?.trim() || ''
  if (!token) return getCollaborationPortalToken()
  globalThis.sessionStorage?.setItem(TOKEN_KEY, token)
  globalThis.history?.replaceState(
    globalThis.history.state,
    '',
    `${globalThis.location.pathname}${globalThis.location.search}`,
  )
  return token
}

export function collaborationRequestHeaders() {
  if (!isCollaborationPortalPath()) return {}
  const token = getCollaborationPortalToken()
  return token ? { 'X-Collaboration-Token': token } : {}
}
