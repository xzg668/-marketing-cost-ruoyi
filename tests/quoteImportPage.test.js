import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  canCommitQuoteImportPreview,
  normalizeQuoteImportCommitResponse,
  normalizeQuoteImportPreview,
  QUOTE_IMPORT_ACCEPTED_EXTENSIONS,
  validateQuoteImportFile,
} from '../src/utils/quoteImport.js'

const IMPORT_PAGE_FILE = path.resolve(
  import.meta.dirname,
  '../src/views/ingest/quote-requests/import/index.vue'
)
const QUOTE_INGEST_API_FILE = path.resolve(import.meta.dirname, '../src/api/quoteIngest.js')
const ROUTER_FILE = path.resolve(import.meta.dirname, '../src/router/index.js')

const importPageContent = fs.readFileSync(IMPORT_PAGE_FILE, 'utf-8')
const quoteIngestApiContent = fs.readFileSync(QUOTE_INGEST_API_FILE, 'utf-8')
const routerContent = fs.readFileSync(ROUTER_FILE, 'utf-8')

describe('T6 OA PDF 报价单导入页面契约', () => {
  it('默认只允许 PDF 文件并限制 20MB', () => {
    assert.deepEqual(QUOTE_IMPORT_ACCEPTED_EXTENSIONS, ['.pdf'])
    assert.equal(validateQuoteImportFile({ name: '报价单.pdf', size: 1024 }).valid, true)
    assert.equal(validateQuoteImportFile({ name: '报价单.xlsx', size: 1024 }).valid, false)
    assert.equal(validateQuoteImportFile({ name: '报价单.csv', size: 1024 }).valid, false)
    assert.equal(validateQuoteImportFile({ name: '报价单.pdf', size: 21 * 1024 * 1024 }).valid, false)
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

    assert.equal(canCommitQuoteImportPreview(warningOnly), true)
    assert.equal(canCommitQuoteImportPreview(warningOnlyWithoutValidFlag), true)
    assert.equal(canCommitQuoteImportPreview(invalid), false)
    assert.equal(normalizeQuoteImportPreview(warningOnly).statusType, 'warning')
    assert.equal(normalizeQuoteImportPreview(warningOnlyWithoutValidFlag).statusLabel, '可提交，有提醒')
    assert.equal(normalizeQuoteImportPreview(invalid).errorCount, 1)
  })

  it('预览聚合 Q6 明细数量，提交结果保留 OA 和流水主键', () => {
    const preview = {
      valid: true,
      forms: [
        {
          oaNo: 'OA-Q8-001',
          accountingContext: { businessUnitType: 'MASS' },
          headerSummary: { processCode: 'FI-SC-006' },
          items: [{ seq: 1 }, { seq: 2 }],
          extraFees: [{ feeCode: 'MOLD_TOTAL' }],
        },
      ],
      errors: [],
      warnings: [],
    }
    const commit = {
      committed: true,
      results: [
        {
          oaNo: 'OA-Q8-001',
          oaFormId: 12,
          ingestLogId: 34,
          ingestStatus: 'IMPORTED',
          itemCount: 2,
        },
      ],
    }

    assert.equal(normalizeQuoteImportPreview(preview).itemCount, 2)
    assert.equal(normalizeQuoteImportPreview(preview).feeCount, 1)
    assert.deepEqual(normalizeQuoteImportCommitResponse(commit)[0], {
      rowKey: 34,
      oaNo: 'OA-Q8-001',
      oaFormId: 12,
      ingestLogId: 34,
      ingestStatus: 'IMPORTED',
      classificationStatus: '',
      itemCount: 2,
    })
  })

  it('页面串联辅助字段说明、PDF preview 和 commit API', () => {
    assert.match(quoteIngestApiContent, /fetchQuoteExcelTemplates/)
    assert.match(quoteIngestApiContent, /downloadQuoteExcelTemplate/)
    assert.match(quoteIngestApiContent, /previewQuotePdf/)
    assert.match(quoteIngestApiContent, /commitQuotePdf/)
    assert.match(quoteIngestApiContent, /\/api\/v1\/quote-ingest\/pdf\/preview/)
    assert.match(quoteIngestApiContent, /\/api\/v1\/quote-ingest\/pdf\/commit/)
    assert.match(quoteIngestApiContent, /\/api\/v1\/quote-ingest\/excel\/templates/)
    assert.match(quoteIngestApiContent, /\/download/)
    assert.match(importPageContent, /fetchQuoteExcelTemplates/)
    assert.match(importPageContent, /downloadQuoteExcelTemplate/)
    assert.match(importPageContent, /previewQuotePdf/)
    assert.match(importPageContent, /commitQuotePdf/)
    assert.match(importPageContent, /accept="\.pdf"/)
    assert.match(importPageContent, /支持的 OA 流程与字段说明/)
    assert.match(importPageContent, /下载字段说明/)
    assert.match(importPageContent, /referenceOpen/)
    assert.match(importPageContent, /上传 OA PDF/)
    assert.match(importPageContent, /commitResults/)
    assert.match(importPageContent, /oaFormId/)
    assert.match(importPageContent, /ingestLogId/)
    assert.match(importPageContent, /QuoteImportPreviewSummary/)
    assert.match(importPageContent, /QuoteImportIssueTable/)
  })

  it('页面展示 Q6 preview 明细：核算维度、表头摘要、产品行、费用项', () => {
    assert.match(importPageContent, /核算维度/)
    assert.match(importPageContent, /表头摘要/)
    assert.match(importPageContent, /产品行/)
    assert.match(importPageContent, /费用项/)
    assert.match(importPageContent, /accountingContext/)
    assert.match(importPageContent, /headerSummary/)
    assert.match(importPageContent, /selectedItems/)
    assert.match(importPageContent, /selectedFees/)
  })

  it('导入页静态路由优先于详情参数路由，避免 import 被当成 oaNo', () => {
    const importRouteIndex = routerContent.indexOf("path: '/ingest/quote-requests/import'")
    const detailRouteIndex = routerContent.indexOf("path: '/ingest/quote-requests/:oaNo'")

    assert.notEqual(importRouteIndex, -1)
    assert.notEqual(detailRouteIndex, -1)
    assert.ok(importRouteIndex < detailRouteIndex)
  })
})
