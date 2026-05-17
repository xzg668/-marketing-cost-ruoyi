import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  hasLogDiagnostics,
  hasLogFailure,
  normalizeQuoteIngestLogPage,
  prettyJsonText,
} from '../src/utils/quoteIngestLogs.js'

const LOG_PAGE_FILE = path.resolve(import.meta.dirname, '../src/views/ingest/quote-ingest-logs/index.vue')
const pageContent = fs.readFileSync(LOG_PAGE_FILE, 'utf-8')

describe('T12 接入流水工具', () => {
  it('兼容后端 PageResult 结构', () => {
    const list = [{ id: 1 }]
    assert.deepEqual(normalizeQuoteIngestLogPage({ list, total: 1 }), { list, total: 1 })
    assert.deepEqual(normalizeQuoteIngestLogPage(null), { list: [], total: 0 })
  })

  it('prettyJsonText 格式化合法 JSON，非法文本原样展示', () => {
    assert.equal(prettyJsonText('{"a":1}'), '{\n  "a": 1\n}')
    assert.equal(prettyJsonText('plain error'), 'plain error')
    assert.equal(prettyJsonText(''), '-')
  })

  it('失败流水和诊断信息可识别', () => {
    assert.equal(hasLogFailure({ ingestStatus: 'REJECTED' }), true)
    assert.equal(hasLogFailure({ ingestStatus: 'IMPORTED' }), false)
    assert.equal(hasLogDiagnostics({ warningMessages: 'GOLD_PRICE_EMPTY' }), true)
    assert.equal(hasLogDiagnostics({}), false)
  })
})

describe('T12 接入流水页面契约', () => {
  it('页面串联列表、详情、筛选和关联报价单跳转', () => {
    assert.match(pageContent, /fetchQuoteIngestLogs/)
    assert.match(pageContent, /fetchQuoteIngestLogDetail/)
    assert.match(pageContent, /filters\.oaNo/)
    assert.match(pageContent, /filters\.ingestStatus/)
    assert.match(pageContent, /goQuoteDetail/)
    assert.match(pageContent, /\/ingest\/quote-requests\/\$\{encodeURIComponent\(oaNo\)\}/)
  })

  it('详情抽屉展示原始报文、标准化报文、错误和 warning', () => {
    assert.match(pageContent, /el-drawer/)
    assert.match(pageContent, /原始报文/)
    assert.match(pageContent, /标准化报文/)
    assert.match(pageContent, /错误和提醒/)
    assert.match(pageContent, /validationErrors/)
    assert.match(pageContent, /warningMessages/)
    assert.match(pageContent, /errorMessage/)
  })
})
