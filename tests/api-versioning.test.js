import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_DIR = path.resolve(import.meta.dirname, '../src/api')

// 获取所有 API 模块文件（排除 http.js）
const apiFiles = fs.readdirSync(API_DIR)
  .filter(f => f.endsWith('.js') && f !== 'http.js')

describe('API 版本前缀检查', () => {

  it('API 目录下存在 auth.js 认证模块', () => {
    assert.ok(apiFiles.includes('auth.js'), '缺少 auth.js 认证 API 模块')
  })

  it('API 模块数量不少于 27 个（26 业务 + 1 认证）', () => {
    assert.ok(apiFiles.length >= 27,
      `期望至少 27 个 API 模块，实际 ${apiFiles.length} 个`)
  })

  for (const file of apiFiles) {
    it(`${file} — 所有路径使用 /api/v1/ 前缀`, () => {
      const content = fs.readFileSync(path.join(API_DIR, file), 'utf-8')

      // 查找所有 '/api/ 开头的路径（单引号和反引号）
      const singleQuotePaths = content.match(/'\/?api\/[^']*'/g) || []
      const templatePaths = content.match(/`\/?api\/[^`]*`/g) || []
      const allPaths = [...singleQuotePaths, ...templatePaths]

      for (const p of allPaths) {
        assert.match(p, /\/api\/v1\//, `${file} 中发现未加 v1 前缀的路径: ${p}`)
      }
    })
  }
})

describe('http.js 核心配置检查', () => {
  const httpContent = fs.readFileSync(path.join(API_DIR, 'http.js'), 'utf-8')

  it('使用 axios 而非原生 fetch', () => {
    assert.match(httpContent, /import\s+axios\s+from\s+['"]axios['"]/)
    assert.doesNotMatch(httpContent, /\bfetch\s*\(/, '不应使用原生 fetch')
  })

  it('包含请求拦截器（Token 注入）', () => {
    assert.match(httpContent, /interceptors\.request/)
    assert.match(httpContent, /Authorization/)
    assert.match(httpContent, /Bearer/)
  })

  it('包含响应拦截器（401 处理）', () => {
    assert.match(httpContent, /interceptors\.response/)
    assert.match(httpContent, /401/)
  })

  it('导出 request 函数', () => {
    assert.match(httpContent, /export\s+(const|function)\s+request/)
  })

  it('导出 cancelPendingRequests 函数', () => {
    assert.match(httpContent, /export\s+(const|function)\s+cancelPendingRequests/)
  })

  it('保留 GET 请求去重机制（pendingGets）', () => {
    assert.match(httpContent, /pendingGets/)
  })

  it('保留 AbortController 取消机制', () => {
    assert.match(httpContent, /AbortController/)
    assert.match(httpContent, /activeControllers/)
  })
})

describe('auth.js 认证模块检查', () => {
  const authContent = fs.readFileSync(path.join(API_DIR, 'auth.js'), 'utf-8')

  it('导出 login 函数', () => {
    assert.match(authContent, /export\s+(const|function)\s+login/)
  })

  it('导出 fetchCurrentUser 函数', () => {
    assert.match(authContent, /export\s+(const|function)\s+fetchCurrentUser/)
  })

  it('登录接口使用 POST 方法', () => {
    assert.match(authContent, /method:\s*['"]POST['"]/)
  })

  it('登录路径为 /api/v1/auth/login', () => {
    assert.match(authContent, /\/api\/v1\/auth\/login/)
  })

  it('获取用户信息路径为 /api/v1/auth/me', () => {
    assert.match(authContent, /\/api\/v1\/auth\/me/)
  })
})
