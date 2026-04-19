import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

// T35：errorHandler.js 静态规则校验 —— 不跑运行时（涉及 element-plus + DOM），
// 采用文本/正则断言确认关键分支都存在，行为在 e2e 验证。
const FILE = path.resolve(import.meta.dirname, '../src/utils/errorHandler.js')
const content = fs.readFileSync(FILE, 'utf-8')

describe('errorHandler 基础结构', () => {
  it('导出 handleHttpError 函数', () => {
    assert.match(content, /export\s+const\s+handleHttpError\s*=/)
  })

  it('导出 handleBusinessError 函数', () => {
    assert.match(content, /export\s+const\s+handleBusinessError\s*=/)
  })

  it('导出 saveTraceId / getTraceId 工具', () => {
    assert.match(content, /export\s+const\s+saveTraceId\s*=/)
    assert.match(content, /export\s+const\s+getTraceId\s*=/)
  })

  it('引入 ElMessage', () => {
    assert.match(content, /import\s+\{\s*ElMessage\s*\}\s+from\s+['"]element-plus['"]/)
  })
})

describe('HTTP 错误分支', () => {
  it('401 清除 token', () => {
    assert.match(content, /localStorage\.removeItem\(['"]token['"]\)/)
  })

  it('401 跳转 /login 并带 redirect', () => {
    assert.match(content, /\/login\?redirect=/)
  })

  it('403 使用 warning 级别提示"权限不足"', () => {
    assert.match(content, /ElMessage\.warning\(\s*['"]权限不足['"]\s*\)/)
  })

  it('5xx 分支存在', () => {
    assert.match(content, /status\s*>=\s*500/)
  })

  it('5xx 展示 traceId（错误编号：xxx）', () => {
    assert.match(content, /错误编号[:：]/)
  })

  it('5xx toast duration=0 不自动关闭', () => {
    assert.match(content, /duration:\s*0/)
  })

  it('5xx toast 可手动关闭', () => {
    assert.match(content, /showClose:\s*true/)
  })
})

describe('traceId 透传', () => {
  it('使用 sessionStorage 存储 traceId', () => {
    assert.match(content, /sessionStorage\.(setItem|getItem)/)
  })

  it('兼容多种 header 大小写（x-trace-id / X-Trace-Id）', () => {
    assert.match(content, /x-trace-id/)
    assert.match(content, /X-Trace-Id/)
  })
})

describe('业务错误分支', () => {
  it('handleBusinessError 提示 msg 字段', () => {
    assert.match(content, /payload\.msg/)
  })

  it('handleBusinessError 返回 Error 对象', () => {
    assert.match(content, /return\s+new\s+Error\(/)
  })
})
