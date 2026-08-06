import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildType2PreviewSummary,
  canConfirmLinkedPreview,
  currentPricingMonth,
  linkedImportResultText,
  normalizeType2PreviewErrors,
  priceLinkedTemplateText,
} from '../src/pages/priceLinkedType2PreviewUtils.js'

describe('PLI2-11 类型2预检纯函数', () => {
  it('月份默认使用当前时间所在月份', () => {
    assert.equal(currentPricingMonth(new Date(2026, 6, 29)), '2026-07')
    assert.equal(currentPricingMonth(new Date(2026, 0, 1)), '2026-01')
  })

  it('标准模板和采购价联动类型2使用业务可读名称', () => {
    assert.equal(priceLinkedTemplateText('STANDARD'), '标准模板')
    assert.equal(priceLinkedTemplateText('TYPE2'), '采购价联动类型 2')
  })

  it('预检摘要包含任务要求的十项统计', () => {
    const items = buildType2PreviewSummary({
      templateType: 'TYPE2',
      businessSheetName: 'Sheet1',
      importDataSheetName: 'importdata1',
      factorRowCount: 2,
      businessRowCount: 30,
      matchedRowCount: 25,
      unmatchedRowCount: 3,
      duplicateRowCount: 2,
      formulaMismatchCount: 1,
      canonicalFactorConflictCount: 1,
    })
    const byKey = Object.fromEntries(items.map((item) => [item.key, item]))

    assert.equal(items.length, 10)
    assert.equal(byKey.templateType.value, '采购价联动类型 2')
    assert.equal(byKey.businessSheetName.value, 'Sheet1')
    assert.equal(byKey.importDataSheetName.value, 'importdata1')
    assert.equal(byKey.matchedRowCount.value, 25)
    assert.equal(byKey.formulaMismatchCount.value, 1)
    assert.equal(byKey.canonicalFactorConflictCount.value, 1)
  })

  it('只有文件、哈希和后端 canConfirm 同时有效才能确认', () => {
    const ready = {
      file: { name: 'type2.xls' },
      loading: false,
      error: '',
      preview: { canConfirm: true, fileSha256: 'abc123' },
    }
    assert.equal(canConfirmLinkedPreview(ready), true)
    assert.equal(canConfirmLinkedPreview({ ...ready, loading: true }), false)
    assert.equal(canConfirmLinkedPreview({ ...ready, error: '预检失败' }), false)
    assert.equal(
      canConfirmLinkedPreview({
        ...ready,
        preview: { canConfirm: false, fileSha256: 'abc123' },
      }),
      false,
    )
    assert.equal(
      canConfirmLinkedPreview({
        ...ready,
        preview: { canConfirm: true, fileSha256: '' },
      }),
      false,
    )
  })

  it('预检错误保留 Sheet、行号、料号、供应商和错误原因', () => {
    const rows = normalizeType2PreviewErrors([{
      sourceSheetName: 'Sheet1',
      rowNumber: 15,
      materialCode: '109910977',
      supplierCode: 'SUP-01',
      errorStage: 'ROW_MATCH',
      errorCode: 'BUSINESS_ONLY',
      message: '在 importdata1 中未找到对应记录',
    }])

    assert.deepEqual(rows[0], {
      key: 'Sheet1|15|109910977|BUSINESS_ONLY|0',
      sourceSheetName: 'Sheet1',
      rowNumber: 15,
      materialCode: '109910977',
      supplierCode: 'SUP-01',
      errorStage: 'ROW_MATCH',
      errorCode: 'BUSINESS_ONLY',
      message: '在 importdata1 中未找到对应记录',
    })
  })

  it('成功和部分成功结果都明确展示新增、跳过、冲突与失败', () => {
    assert.equal(
      linkedImportResultText({
        importStatus: 'SUCCESS',
        linkedVersionCreatedCount: 3,
        linkedUnchangedSkippedCount: 2,
        canonicalFactorConflictCount: 0,
        errors: [],
      }),
      '导入完成：新增版本 3，未变化跳过 2，冲突 0，失败 0',
    )
    assert.equal(
      linkedImportResultText({
        importStatus: 'PARTIAL',
        linkedCreatedCount: 2,
        linkedSkippedCount: 1,
        monthlyPriceConflictCount: 1,
        errors: [{ message: '一行失败' }],
      }),
      '部分导入完成：新增版本 2，未变化跳过 1，冲突 1，失败 1',
    )
  })
})
