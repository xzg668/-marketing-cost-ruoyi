import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/pages/PriceLinkedResultPage.vue'),
  'utf-8',
)
const API = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/api/priceLinkedItems.js'),
  'utf-8',
)

describe('PLI2-11 类型2导入弹窗', () => {
  it('不新增入口，现有导入弹窗同时说明支持两类模板', () => {
    assert.match(PAGE, /导入月度联动价与影响因素 Excel/)
    assert.match(PAGE, /支持标准模板和采购价联动类型 2/)
    assert.match(PAGE, /系统按 Sheet 内容识别，不按文件名判断/)
  })

  it('选择文件后调用 preview，并展示 loading 和失败提示', () => {
    assert.match(API, /export\s+const\s+previewLinkedItemsExcel\b/)
    assert.match(API, /\/items\/import-excel\/preview/)
    assert.match(PAGE, /const\s+runMonthlyImportPreview\s*=\s*async/)
    assert.match(PAGE, /previewLinkedItemsExcel\(/)
    assert.match(PAGE, /v-loading="importPreviewLoading"/)
    assert.match(PAGE, /v-if="importPreviewError"/)
    assert.match(PAGE, /ElMessage\.error\(importPreviewError\.value\)/)
  })

  it('展示模板、两个 Sheet 和八类数量', () => {
    assert.match(PAGE, /type2PreviewSummaryItems/)
    assert.match(PAGE, /buildType2PreviewSummary/)
    assert.match(PAGE, /type2PreviewErrorRows/)
    assert.match(PAGE, /Sheet/)
    assert.match(PAGE, /错误类型/)
  })

  it('预检未通过时禁用确认按钮', () => {
    assert.match(PAGE, /:disabled="!canConfirmMonthlyImport"/)
    assert.match(PAGE, /canConfirmLinkedPreview/)
    assert.match(PAGE, /存在阻断错误/)
    assert.match(PAGE, /请等待文件预检通过后再确认导入/)
  })

  it('重新选文件会先清除旧预检，并用请求令牌丢弃旧响应', () => {
    assert.match(
      PAGE,
      /const\s+handleMonthlyImportFileChange\s*=\s*async[\s\S]*?invalidateMonthlyImportPreview\(\)[\s\S]*?selectedImportFile\.value\s*=/,
    )
    assert.match(PAGE, /importPreviewRequestToken\.value\s*\+=\s*1/)
    assert.match(PAGE, /token\s*!==\s*importPreviewRequestToken\.value/)
  })

  it('确认导入携带预检 SHA-256，成功和部分成功分别提示', () => {
    assert.match(API, /append\(['"]previewFileSha256['"]\s*,\s*options\.previewFileSha256\)/)
    assert.match(
      PAGE,
      /previewFileSha256:\s*importPreviewResult\.value\.fileSha256/,
    )
    assert.match(PAGE, /linkedImportResultText/)
    assert.match(PAGE, /importStatus/)
    assert.match(PAGE, /PARTIAL/)
  })

  it('月份仍默认当前月份，表单上下文变化会重新预检', () => {
    assert.match(PAGE, /const\s+currentMonthText\s*=\s*\(\)\s*=>\s*currentPricingMonth\(\)/)
    assert.match(PAGE, /pricingMonth:\s*queryString\('pricingMonth',\s*currentMonthText\(\)\)/)
    assert.match(PAGE, /handleMonthlyImportContextChange/)
  })
})
