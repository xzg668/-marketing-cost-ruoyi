import { request } from './http'

// 用户登录
export const login = (body) =>
  request('/api/v1/auth/login', { method: 'POST', body })

// 获取当前登录用户信息
export const fetchCurrentUser = () =>
  request('/api/v1/auth/me')

// 获取当前用户可见的路由树
export const fetchRouters = () =>
  request('/api/v1/auth/routers')
