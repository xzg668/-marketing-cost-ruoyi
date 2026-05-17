import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  displayCmsAmountCalcMode,
  displayCmsLockStatus,
  displayCmsSource,
} from '../src/utils/cmsCostSourceDisplay.js'

const SALARY_PAGE = path.resolve(import.meta.dirname, '../src/pages/SalaryCostPage.vue')
const AUX_PAGE = path.resolve(import.meta.dirname, '../src/pages/AuxSubjectPage.vue')

const salaryContent = fs.readFileSync(SALARY_PAGE, 'utf-8')
const auxContent = fs.readFileSync(AUX_PAGE, 'utf-8')

describe('T15 CMS 来源展示工具', () => {
  it('CMS 派生记录显示为 CMS、首月锁定、直接金额', () => {
    assert.equal(displayCmsSource('CMS'), 'CMS')
    assert.equal(displayCmsLockStatus('LOCKED', 'CMS'), '首月锁定')
    assert.equal(displayCmsAmountCalcMode('DIRECT', 'CMS'), '直接金额')
  })

  it('手工记录缺少来源字段时仍按手工和未锁定展示', () => {
    assert.equal(displayCmsSource(''), '手工')
    assert.equal(displayCmsLockStatus('', ''), '未锁定')
    assert.equal(displayCmsAmountCalcMode('', ''), '上浮率')
  })
})

describe('T15 工资表 CMS 首月锁定展示', () => {
  it('工资表展示首次期间、来源、锁定状态和来源批次', () => {
    assert.match(salaryContent, /prop="period"\s+label="首次期间"/)
    assert.match(salaryContent, /prop="source"\s+label="来源"/)
    assert.match(salaryContent, /prop="lockStatus"\s+label="锁定状态"/)
    assert.match(salaryContent, /prop="sourceImportBatchId"\s+label="来源批次ID"/)
    assert.match(salaryContent, /prop="lockReason"\s+label="锁定说明"/)
    assert.match(salaryContent, /displayCmsLockStatus\(row\.lockStatus,\s*row\.source\)/)
    assert.match(salaryContent, /displayCmsSource\(row\.source\)/)
  })
})

describe('T15 辅料表 CMS 金额模式展示', () => {
  it('辅料表展示首次期间、来源、金额模式、锁定状态和来源批次', () => {
    assert.match(auxContent, /prop="period"\s+label="首次期间"/)
    assert.match(auxContent, /prop="source"\s+label="来源"/)
    assert.match(auxContent, /prop="amountCalcMode"\s+label="金额模式"/)
    assert.match(auxContent, /prop="lockStatus"\s+label="锁定状态"/)
    assert.match(auxContent, /prop="sourceImportBatchId"\s+label="来源批次ID"/)
    assert.match(auxContent, /displayCmsAmountCalcMode\(row\.amountCalcMode,\s*row\.source\)/)
    assert.match(auxContent, /displayCmsLockStatus\(row\.lockStatus,\s*row\.source\)/)
    assert.match(auxContent, /displayCmsSource\(row\.source\)/)
  })
})
