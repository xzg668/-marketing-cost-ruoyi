import { ElMessage } from 'element-plus'

// T35：前端统一错误处理 —— 将 401/403/5xx/业务错误的提示逻辑从 http.js 拆出，
// 保证 axios 拦截器关注点单一，也便于未来按错误类型扩展埋点 / sentry 上报。

const TRACE_ID_KEY = 'x-trace-id'

/**
 * 将后端返回的 traceId 暂存到 sessionStorage，
 * 后续请求由 http.js 读取并回传 X-Trace-Id 头，方便全链路追踪。
 */
export const saveTraceId = (traceId) => {
  if (traceId) {
    sessionStorage.setItem(TRACE_ID_KEY, traceId)
  }
}

/** 读取当前 tab 的 traceId（请求拦截器使用） */
export const getTraceId = () => sessionStorage.getItem(TRACE_ID_KEY) || ''

/** 登出：清 token 并带 redirect 返回登录页 */
const redirectToLogin = () => {
  localStorage.removeItem('token')
  const currentPath = window.location.pathname
  if (currentPath !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
  }
}

/**
 * 从响应 headers 提取 traceId；不同代理 / CDN 可能改写大小写，
 * 因此兜底多个 key。
 */
const extractTraceId = (headers) => {
  if (!headers) return ''
  return (
    headers['x-trace-id'] ||
    headers['X-Trace-Id'] ||
    headers['trace-id'] ||
    ''
  )
}

/**
 * HTTP 错误（非 2xx）分支处理：
 * - 401 未认证：清 token 跳登录
 * - 403 权限不足：轻提示
 * - 5xx 服务端错误：弹 toast 并展示 traceId，duration=0 禁止自动关闭
 *   —— 方便用户截图反馈
 * - 其他：展示后端 msg 或通用提示
 *
 * 返回 true 表示已处理提示，调用方无需再弹错误。
 */
export const handleHttpError = (error) => {
  const status = error.response?.status
  const respData = error.response?.data
  const traceId = extractTraceId(error.response?.headers)
  if (traceId) {
    saveTraceId(traceId)
  }

  if (status === 401) {
    if (window.location.pathname === '/login') {
      return true
    }
    redirectToLogin()
    return true
  }

  if (status === 403) {
    ElMessage.warning('权限不足')
    return true
  }

  if (status >= 500) {
    const baseMsg = (respData && (respData.msg || respData.message)) || '服务器异常，请稍后重试'
    const full = traceId ? `${baseMsg}（错误编号：${traceId}）` : baseMsg
    ElMessage({
      type: 'error',
      message: full,
      duration: 0,
      showClose: true,
    })
    return true
  }

  // 其他 HTTP 状态（如 400 参数错误）：提示后端 msg
  const msg = (respData && (respData.msg || respData.message)) || error.message || '请求失败'
  ElMessage.error(msg)
  return true
}

/**
 * 业务错误：HTTP 200 但 CommonResult.code !== 0。
 * 不展示 traceId（业务错误一般可操作，例如重名、字段缺失），仅 toast msg。
 */
export const handleBusinessError = (payload) => {
  const msg = (payload && payload.msg) || '操作失败'
  ElMessage.error(msg)
  return new Error(msg)
}
