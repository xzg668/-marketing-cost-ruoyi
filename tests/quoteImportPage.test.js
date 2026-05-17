import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  canCommitQuoteExcelPreview,
  createQuoteImportTemplateWorkbook,
  normalizeQuoteExcelPreview,
  QUOTE_IMPORT_ACCEPTED_EXTENSIONS,
  QUOTE_IMPORT_TEMPLATE,
  validateQuoteImportFile,
} from '../src/utils/quoteImport.js'

const IMPORT_PAGE_FILE = path.resolve(
  import.meta.dirname,
  '../src/views/ingest/quote-requests/import/index.vue'
)
const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')

const importPageContent = fs.readFileSync(IMPORT_PAGE_FILE, 'utf-8')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

describe('T10 报价单导入页面契约', () => {
  it('只允许 Excel 文件并限制 20MB', () => {
    assert.deepEqual(QUOTE_IMPORT_ACCEPTED_EXTENSIONS, ['.xlsx', '.xls'])
    assert.equal(validateQuoteImportFile({ name: '报价单.xlsx', size: 1024 }).valid, true)
    assert.equal(validateQuoteImportFile({ name: '报价单.xls', size: 1024 }).valid, true)
    assert.equal(validateQuoteImportFile({ name: '报价单.csv', size: 1024 }).valid, false)
    assert.equal(validateQuoteImportFile({ name: '报价单.xlsx', size: 21 * 1024 * 1024 }).valid, false)
  })

  it('预览有错误时不允许提交，有 warning 无 error 时允许提交', () => {
    const warningOnly = {
      valid: true,
      formCount: 1,
      itemCount: 1,
      feeCount: 0,
      errors: [],
      warnings: [{ code: 'GOLD_PRICE_EMPTY', message: '黄金基价为空' }],
      forms: [{ oaNo: 'OA-T10-001' }],
    }
    const warningOnlyWithoutValidFlag = {
      errorCount: 0,
      warningCount: 1,
      errors: [],
      warnings: [{ code: 'GOLD_PRICE_EMPTY', message: '黄金基价为空' }],
      forms: [{ oaNo: 'OA-T10-002' }],
    }
    const invalid = {
      valid: false,
      errors: [{ code: 'FORM_NO_REQUIRED', message: '报价单号不能为空' }],
      warnings: [],
      forms: [],
    }

    assert.equal(canCommitQuoteExcelPreview(warningOnly), true)
    assert.equal(canCommitQuoteExcelPreview(warningOnlyWithoutValidFlag), true)
    assert.equal(canCommitQuoteExcelPreview(invalid), false)
    assert.equal(normalizeQuoteExcelPreview(warningOnly).statusType, 'warning')
    assert.equal(normalizeQuoteExcelPreview(warningOnlyWithoutValidFlag).statusLabel, '可提交，有提醒')
    assert.equal(normalizeQuoteExcelPreview(invalid).errorCount, 1)
  })

  it('模板 Sheet 名称与后端解析约定一致', () => {
    const workbook = createQuoteImportTemplateWorkbook()
    assert.deepEqual(
      workbook.SheetNames,
      QUOTE_IMPORT_TEMPLATE.sheets.map((sheet) => sheet.name)
    )
    assert.deepEqual(workbook.SheetNames, ['报价单表头', '产品明细', '额外费用'])
  })

  it('页面串联 preview/commit API，提交成功后跳转接入列表', () => {
    assert.match(importPageContent, /previewQuoteExcel/)
    assert.match(importPageContent, /commitQuoteExcel/)
    assert.match(importPageContent, /router\.push\('\/ingest\/quote-requests'\)/)
    assert.match(importPageContent, /QuoteImportPreviewSummary/)
    assert.match(importPageContent, /QuoteImportIssueTable/)
  })

  it('导入页静态路由优先于详情参数路由，避免 import 被当成 oaNo', () => {
    const importRouteIndex = routerContent.indexOf("path: '/ingest/quote-requests/import'")
    const detailRouteIndex = routerContent.indexOf("path: '/ingest/quote-requests/:oaNo'")

    assert.notEqual(importRouteIndex, -1)
    assert.notEqual(detailRouteIndex, -1)
    assert.ok(importRouteIndex < detailRouteIndex)
  })
})
