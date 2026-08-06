import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildImportBasisDifferenceRows,
  normalizeImportBasis,
  taxExecutionText,
  taxIncludedText,
} from '../src/components/priceLinkedImportBasisUtils.js'

const DRAWER = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/components/PriceLinkedImportBasisDrawer.vue'),
  'utf-8',
)
const PAGE = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/pages/PriceLinkedResultPage.vue'),
  'utf-8',
)
const API = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/api/priceLinkedItems.js'),
  'utf-8',
)

describe('PLI2-11 查看导入依据抽屉', () => {
  it('主表行按钮受列表权限控制并打开抽屉', () => {
    assert.match(
      PAGE,
      /v-hasPermi="\['price:linked-item:list'\]"[\s\S]{0,140}@click="openImportBasis\(row\)"[\s\S]{0,100}查看导入依据/,
    )
    assert.match(PAGE, /<PriceLinkedImportBasisDrawer/)
    assert.match(PAGE, /v-model:visible="importBasisDrawerVisible"/)
  })

  it('API 调用只读 import-basis 端点', () => {
    assert.match(API, /export\s+const\s+fetchLinkedImportBasis\b/)
    assert.match(API, /\/items\/\$\{id\}\/import-basis/)
    assert.match(DRAWER, /fetchLinkedImportBasis\(linkedItemId\)/)
  })

  it('完整依据展示来源、公式、输入、因素、税转换和双口径差异', () => {
    for (const text of [
      '来源文件',
      '导入批次',
      '来源位置',
      'Excel 原始公式',
      '系统公式',
      '原始输入字段、单元格和值',
      '计算采用值',
      '空白按 0',
      '影响因素绑定',
      '税转换与价格差异',
      'Excel 结果',
      '系统结果',
    ]) {
      assert.match(DRAWER, new RegExp(text))
    }
  })

  it('完整响应可整理成业务抽屉模型', () => {
    const basis = normalizeImportBasis({
      importBasisAvailable: true,
      sourceFileName: '类型2.xls',
      sourceBatchNo: 'BATCH-01',
      sourceUploadBatchId: 9001,
      sourceSheetName: 'Sheet1',
      sourceRowNumber: 6,
      sourceFormulaCellRef: 'R6',
      sourceFormula: '$E$2+G6',
      systemFormula: '[factor_identity_191]+23',
      factorBindings: [{ originalName: '1#Cu', factorIdentityId: 191 }],
      snapshot: {
        inputCells: [{
          header: '加工费',
          cellRef: 'G6',
          numericValue: null,
          calculationValue: 0,
          blankDefaultedToZero: true,
        }],
        taxBasis: {
          originalTaxIncluded: 0,
          normalizedTaxIncluded: 0,
          taxAdjustmentRequired: true,
        },
        reconcileBasis: {
          tolerance: 0.0001,
          taxIncluded: {
            excelPrice: 113,
            systemPrice: 113,
            absoluteDifference: 0,
            compared: true,
            passed: true,
          },
          taxExcluded: {
            excelPrice: 100,
            systemPrice: 100,
            absoluteDifference: 0,
            compared: true,
            passed: true,
          },
        },
      },
    })

    assert.equal(basis.sourceFileName, '类型2.xls')
    assert.equal(basis.sourceBatchText, 'BATCH-01 / ID 9001')
    assert.equal(basis.sourceLocation, 'Sheet1 / 第 6 行 / R6')
    assert.equal(basis.inputCells.length, 1)
    assert.equal(basis.inputCells[0].calculationValue, 0)
    assert.equal(basis.inputCells[0].blankDefaultedToZero, true)
    assert.equal(basis.factorBindings[0].factorIdentityId, 191)
    assert.equal(taxExecutionText(basis), '最终执行除税')
    assert.equal(taxIncludedText(basis.taxBasis.originalTaxIncluded), '不含税')
    assert.equal(buildImportBasisDifferenceRows(basis).length, 2)
    assert.equal(buildImportBasisDifferenceRows(basis)[1].passed, true)
  })

  it('老记录没有快照时显示友好提示而不报错', () => {
    const basis = normalizeImportBasis({
      importBasisAvailable: false,
      message: '历史联动价暂无类型2导入依据',
    })
    assert.equal(basis.available, false)
    assert.match(basis.emptyMessage, /历史联动价暂无类型2导入依据/)
    assert.match(DRAWER, /v-else-if="loaded && !basis\.available"/)
    assert.match(DRAWER, /basis\.emptyMessage/)
  })

  it('无权限或 API 失败时在抽屉和消息框中显示错误', () => {
    assert.match(DRAWER, /loadError\.value\s*=\s*error\?\.message\s*\|\|\s*'获取导入依据失败'/)
    assert.match(DRAWER, /ElMessage\.error\(loadError\.value\)/)
    assert.match(DRAWER, /v-if="loadError"/)
  })
})
