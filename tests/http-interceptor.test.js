import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

// T35：http.js 拦截器的静态校验 —— 确认请求/响应拦截器走 errorHandler，
// 并且在请求上挂 X-Trace-Id、响应上回写 traceId。
const FILE = path.resolve(import.meta.dirname, '../src/api/http.js')
const content = fs.readFileSync(FILE, 'utf-8')

describe('http.js 依赖错误处理工具', () => {
  it('从 errorHandler 导入 handleHttpError', () => {
    assert.match(content, /import\s*\{[^}]*handleHttpError[^}]*\}\s*from\s*['"]\.\.\/utils\/errorHandler['"]/)
  })

  it('从 errorHandler 导入 handleBusinessError', () => {
    assert.match(content, /handleBusinessError/)
  })

  it('从 errorHandler 导入 saveTraceId / getTraceId', () => {
    assert.match(content, /saveTraceId/)
    assert.match(content, /getTraceId/)
  })
})

describe('请求拦截器', () => {
  it('注入 Authorization Bearer Token', () => {
    assert.match(content, /config\.headers\.Authorization\s*=\s*`Bearer\s*\$\{token\}`/)
  })

  it('回传 X-Trace-Id 头', () => {
    assert.match(content, /config\.headers\[['"]X-Trace-Id['"]\]\s*=\s*traceId/)
  })

  it('traceId 从 getTraceId 读取', () => {
    assert.match(content, /const\s+traceId\s*=\s*getTraceId\(\)/)
  })
})

describe('响应拦截器', () => {
  it('成功响应抓取 traceId 并保存', () => {
    assert.match(content, /saveTraceId\(tid\)/)
  })

  it('错误响应调用 handleHttpError', () => {
    assert.match(content, /handleHttpError\(error\)/)
  })

  it('取消请求不调用 handleHttpError', () => {
    // 断言 axios.isCancel 在 handleHttpError 之前短路
    const cancelIdx = content.indexOf('axios.isCancel(error)')
    const handleIdx = content.indexOf('handleHttpError(error)')
    assert.ok(cancelIdx > 0 && handleIdx > 0, '两个关键调用应同时存在')
    assert.ok(cancelIdx < handleIdx, '必须先判断 isCancel 再 handleHttpError')
  })
})

describe('业务错误处理', () => {
  it('CommonResult code !== 0 走 handleBusinessError', () => {
    assert.match(content, /throw\s+handleBusinessError\(payload\)/)
  })

  it('保留 CommonResult code === 0 的 data 解包', () => {
    assert.match(content, /return\s+payload\.data/)
  })
})
