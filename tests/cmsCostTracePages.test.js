import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const API_FILE = path.resolve(import.meta.dirname, '../src/api/cmsCost.js')
const PLAN_PAGE = path.resolve(import.meta.dirname, '../src/pages/CmsPlanCostRawPage.vue')
const WORKSHOP_PAGE = path.resolve(import.meta.dirname, '../src/pages/CmsWorkshopLaborRawPage.vue')
const SUBJECT_PAGE = path.resolve(import.meta.dirname, '../src/pages/CmsProductSubjectCostRawPage.vue')
const SUBJECT_SETTING_PAGE = path.resolve(import.meta.dirname, '../src/pages/CmsSubjectSettingPage.vue')
const EFFECTIVE_PAGE = path.resolve(import.meta.dirname, '../src/pages/CmsCostEffectiveSourcePage.vue')

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const planContent = fs.readFileSync(PLAN_PAGE, 'utf-8')
const workshopContent = fs.readFileSync(WORKSHOP_PAGE, 'utf-8')
const subjectContent = fs.readFileSync(SUBJECT_PAGE, 'utf-8')
const subjectSettingContent = fs.readFileSync(SUBJECT_SETTING_PAGE, 'utf-8')
const effectiveContent = fs.readFileSync(EFFECTIVE_PAGE, 'utf-8')

describe('T14 CMS 成本查询 API', () => {
  it('封装入库记录、原始数据、科目设置和派生日志查询接口', () => {
    assert.doesNotMatch(apiContent, /export const fetchCmsCostBatches/)
    assert.doesNotMatch(apiContent, /\/api\/v1\/cms-cost\/batches/)
    assert.match(apiContent, /export const fetchCmsCostImportRecords/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/import-records/)
    assert.match(apiContent, /export const fetchCmsPlanCostRows/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/plan-rows/)
    assert.match(apiContent, /export const fetchCmsWorkshopLaborRows/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/workshop-rows/)
    assert.match(apiContent, /export const fetchCmsProductSubjectCostRows/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/subject-rows/)
    assert.match(apiContent, /export const fetchCmsSubjectSettings/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/subject-settings/)
    assert.match(apiContent, /export const fetchCmsCostDeriveLogs/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/derive-logs/)
    assert.match(apiContent, /export const fetchCmsCostEffectiveSources/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/effective-sources/)
    assert.match(apiContent, /export const fetchCmsCostEffectiveSourceLogs/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/effective-source-logs/)
    assert.match(apiContent, /refreshCmsCostEffectiveSource/)
  })

  it('查询参数使用后端 T11 的 current 和 size 分页字段', () => {
    assert.match(apiContent, /toCmsCostPageParams/)
    assert.match(apiContent, /current,/)
    assert.match(apiContent, /size,/)
    assert.match(apiContent, /normalizeCmsCostPage/)
  })
})

describe('T14 CMS 原始数据页', () => {
  it('计划成本页按成品料号、年度和期间查询并展示未审批项', () => {
    assert.match(planContent, /fetchCmsPlanCostRows/)
    assert.doesNotMatch(planContent, /filters\.batchNo/)
    assert.doesNotMatch(planContent, /importBatchId/)
    assert.doesNotMatch(planContent, /批次号|批次ID/)
    assert.match(planContent, /filters\.parentCode/)
    assert.match(planContent, /filters\.costYear/)
    assert.match(planContent, /filters\.period/)
    assert.match(planContent, /effectivePeriod/)
    assert.match(planContent, /unapprovedItems/)
    assert.match(planContent, /BasePagination/)
  })

  it('车间料工费页按成品料号、期间查询并展示分、元和 CMS 原始 ID', () => {
    assert.match(workshopContent, /fetchCmsWorkshopLaborRows/)
    assert.doesNotMatch(workshopContent, /filters\.batchNo/)
    assert.doesNotMatch(workshopContent, /importBatchId/)
    assert.doesNotMatch(workshopContent, /批次号|批次ID/)
    assert.match(workshopContent, /filters\.costYear/)
    assert.match(workshopContent, /filters\.period/)
    assert.match(workshopContent, /workingCostCent/)
    assert.match(workshopContent, /workingCostYuan/)
    assert.match(workshopContent, /sourceRowId/)
    assert.match(workshopContent, /BasePagination/)
  })

  it('科目成本页按科目名称查询并展示材料计价分和元', () => {
    assert.match(subjectContent, /fetchCmsProductSubjectCostRows/)
    assert.doesNotMatch(subjectContent, /filters\.batchNo/)
    assert.doesNotMatch(subjectContent, /importBatchId/)
    assert.doesNotMatch(subjectContent, /批次号|批次ID/)
    assert.match(subjectContent, /filters\.costYear/)
    assert.match(subjectContent, /filters\.subjectCode/)
    assert.match(subjectContent, /filters\.subjectName/)
    assert.match(subjectContent, /secondSubjectCode/)
    assert.match(subjectContent, /materialPrice/)
    assert.match(subjectContent, /materialPriceYuan/)
    assert.match(subjectContent, /BasePagination/)
  })

  it('科目设置页按一级科目、二级编码和二级科目查询', () => {
    assert.match(subjectSettingContent, /fetchCmsSubjectSettings/)
    assert.match(subjectSettingContent, /filters\.firstSubjectName/)
    assert.match(subjectSettingContent, /filters\.secondSubjectCode/)
    assert.match(subjectSettingContent, /filters\.secondSubjectName/)
    assert.match(subjectSettingContent, /firstSubjectCode/)
    assert.match(subjectSettingContent, /secondSubjectCode/)
    assert.match(subjectSettingContent, /thirdSubjectCode/)
    assert.match(subjectSettingContent, /BasePagination/)
  })

  it('原始明细页接收来源追溯 query 参数', () => {
    const rawPages = [planContent, workshopContent, subjectContent, subjectSettingContent].join('\n')
    assert.match(rawPages, /route\.query\.parentCode/)
    assert.match(rawPages, /route\.query\.period/)
    assert.match(rawPages, /route\.query\.costYear/)
    assert.match(subjectContent, /route\.query\.subjectCode/)
  })

  it('原始 CMS 页面保持只读，不提供新增编辑删除导入动作', () => {
    const rawPages = [planContent, workshopContent, subjectContent, subjectSettingContent].join('\n')
    assert.doesNotMatch(rawPages, /openCreate|openEdit|submitRow|removeRow|delete[A-Z]/)
    assert.doesNotMatch(rawPages, /el-upload/)
    assert.doesNotMatch(rawPages, /type="danger"/)
  })
})

describe('T14 CMS 公共生效来源页', () => {
  it('按年度、料号、期间、成本类型和科目筛选当前生效来源', () => {
    assert.match(effectiveContent, /fetchCmsCostEffectiveSources/)
    assert.match(effectiveContent, /filters\.costYear/)
    assert.match(effectiveContent, /filters\.parentCode/)
    assert.match(effectiveContent, /filters\.period/)
    assert.match(effectiveContent, /filters\.sourceType/)
    assert.match(effectiveContent, /filters\.subjectCode/)
    assert.match(effectiveContent, /BasePagination/)
  })

  it('默认来源自动补齐，页面保留更新到其他期间和查看日志', () => {
    assert.doesNotMatch(effectiveContent, /生成默认来源/)
    assert.doesNotMatch(effectiveContent, /generateDefaultCmsCostEffectiveSources/)
    assert.match(effectiveContent, /默认按已审批 CMS 数据自动取当年 1 月起最早期间/)
    assert.match(effectiveContent, /更新来源/)
    assert.match(effectiveContent, /openRefreshFromFilters/)
    assert.doesNotMatch(effectiveContent, /@click="openRefresh\(row\)"/)
    assert.match(effectiveContent, /refreshCmsCostEffectiveSource/)
    assert.match(effectiveContent, /refreshForm\.costYear/)
    assert.match(effectiveContent, /refreshForm\.parentCode/)
    assert.match(effectiveContent, /refreshForm\.newPeriod/)
    assert.match(effectiveContent, /refreshForm\.refreshReason/)
    assert.match(effectiveContent, /fetchCmsCostEffectiveSourceLogs/)
    assert.match(effectiveContent, /logFilters\.actionType/)
  })

  it('能跳转到来源原始行页面追溯工资和辅料来源', () => {
    assert.match(effectiveContent, /openSourceRows/)
    assert.match(effectiveContent, /\/base\/cms-cost\/workshop-rows/)
    assert.match(effectiveContent, /\/base\/cms-cost\/subject-rows/)
  })
})
