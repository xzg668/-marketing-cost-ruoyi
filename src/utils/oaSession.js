export const OA_SESSION_KEY = 'oaCollaborationSession'
export const OA_BROWSER_KEY = 'oaLoginBrowserKey'

export function isOaEntry(path) {
  return path === '/oa-login' || path.startsWith('/collaboration/technical-data/')
}

export function readOaSession(storage = sessionStorage) {
  try { return JSON.parse(storage.getItem(OA_SESSION_KEY) || 'null') }
  catch { return null }
}

// OA 页面绝不回退到浏览器里残留的 admin 或普通账号。
export function requestToken(path, local = localStorage, session = sessionStorage) {
  return isOaEntry(path) ? readOaSession(session)?.accessToken || '' : local.getItem('token') || ''
}

export function browserKey(cryptoApi = crypto) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function safeEntryPath(value) {
  return typeof value === 'string' && /^\/collaboration\/technical-data\/forms\/[1-9]\d*(\?submission=[A-Za-z0-9_-]{1,64})?$/.test(value)
}
