import axios from 'axios'
import {
  handleHttpError,
  handleBusinessError,
  saveTraceId,
  getTraceId,
} from '../utils/errorHandler'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：注入 token + 回传 traceId（来自上一次响应），便于全链路追踪
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // T35：把会话 traceId 透传给后端，后端 TraceIdFilter 会优先复用该值
  const traceId = getTraceId()
  if (traceId) {
    config.headers['X-Trace-Id'] = traceId
  }
  return config
})

// 响应拦截器：成功时抓取 traceId；失败时交给 errorHandler 统一提示
// —— 401/403/5xx 分支均在 errorHandler.handleHttpError 中集中处理
instance.interceptors.response.use(
  (response) => {
    const tid =
      response.headers?.['x-trace-id'] ||
      response.headers?.['X-Trace-Id'] ||
      ''
    if (tid) {
      saveTraceId(tid)
    }
    return response
  },
  (error) => {
    // 取消的请求不视为错误，透传给 request() 内部 isCancel 处理
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }
    handleHttpError(error)
    return Promise.reject(error)
  }
)

// Pending GET requests for dedup
const pendingGets = new Map()

// Active AbortControllers keyed by route path for cancellation
const activeControllers = new Map()

export const cancelPendingRequests = (pathPrefix) => {
  for (const [key, controller] of activeControllers) {
    if (!pathPrefix || key.startsWith(pathPrefix)) {
      controller.abort()
      activeControllers.delete(key)
    }
  }
}

export const request = async (path, { method = 'GET', params, body, dedupKey } = {}) => {
  // GET request dedup: reuse in-flight promise for same URL
  const isGet = method === 'GET'
  const cacheKey = dedupKey || `${path}?${JSON.stringify(params || {})}`
  if (isGet && pendingGets.has(cacheKey)) {
    return pendingGets.get(cacheKey)
  }

  const controller = new AbortController()
  activeControllers.set(path, controller)

  const promise = (async () => {
    try {
      const config = {
        url: path,
        method,
        signal: controller.signal,
      }

      if (params && typeof params === 'object') {
        config.params = Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
          )
        )
      }

      if (body !== undefined) {
        config.data = body
      }

      const response = await instance(config)
      const payload = response.data

      // v1.3: 后端统一返回若依 CommonResult：{ code, msg, data }，code === 0 视为成功
      if (payload && typeof payload.code === 'number') {
        if (payload.code !== 0) {
          // T35：业务错误统一交给 errorHandler 弹 toast，并抛出 Error 供调用方 catch
          throw handleBusinessError(payload)
        }
        return payload.data
      }

      return payload
    } catch (error) {
      if (axios.isCancel(error)) {
        throw error
      }
      // HTTP 错误的 toast 已由响应拦截器处理；此处仅抛 Error 供调用方 await/catch 使用
      const respData = error.response?.data
      const message =
        (respData && (respData.msg || respData.message)) ||
        error.message ||
        '请求失败'
      throw new Error(message)
    } finally {
      if (isGet) {
        pendingGets.delete(cacheKey)
      }
      activeControllers.delete(path)
    }
  })()

  if (isGet) {
    pendingGets.set(cacheKey, promise)
  }

  return promise
}
