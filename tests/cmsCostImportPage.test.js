import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_FILE = path.resolve(import.meta.dirname, '../src/pages/CmsCostImportPage.vue')
const API_FILE = path.resolve(import.meta.dirname, '../src/api/cmsCost.js')

const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')
const apiContent = fs.readFileSync(API_FILE, 'utf-8')

describe('T13 CMS 成本导入 API', () => {
  it('封装 /api/v1/cms-cost/import 可选文件上传接口', () => {
    assert.match(apiContent, /export const importCmsCostExcel/)
    assert.match(apiContent, /\/api\/v1\/cms-cost\/import/)
    assert.match(apiContent, /appendOptionalFile\(formData,\s*'planFile'/)
    assert.match(apiContent, /appendOptionalFile\(formData,\s*'workshopFile'/)
    assert.match(apiContent, /appendOptionalFile\(formData,\s*'subjectFile'/)
    assert.match(apiContent, /appendOptionalFile\(formData,\s*'subjectSettingFile'/)
    assert.match(apiContent, /formData\.append\('dryRun'/)
    assert.match(apiContent, /formData\.append\('businessUnitType'/)
  })

  it('只允许 Excel 文件并限制 20MB', () => {
    assert.match(apiContent, /CMS_COST_ACCEPTED_EXTENSIONS\s*=\s*\['\.xlsx',\s*'\.xls'\]/)
    assert.match(apiContent, /CMS_COST_MAX_FILE_SIZE\s*=\s*20\s*\*\s*1024\s*\*\s*1024/)
    assert.match(apiContent, /validateCmsCostFile/)
    assert.match(apiContent, /lowerName\.endsWith\(ext\)/)
  })

  it('至少选择一个文件即可提交', () => {
    assert.match(apiContent, /canSubmitCmsCostImport/)
    assert.match(apiContent, /files\?\.planFile \|\| files\?\.workshopFile \|\| files\?\.subjectFile \|\| files\?\.subjectSettingFile/)
    assert.match(apiContent, /missingCmsCostFileLabel/)
    assert.match(apiContent, /至少一个 CMS Excel 文件/)
  })

  it('导入结果规范化为统计面板需要的字段', () => {
    assert.match(apiContent, /normalizeCmsCostImportResult/)
    assert.match(apiContent, /batchNo/)
    assert.match(apiContent, /status/)
    assert.match(apiContent, /planRowCount/)
    assert.match(apiContent, /workshopRowCount/)
    assert.match(apiContent, /subjectRowCount/)
    assert.match(apiContent, /subjectSettingRowCount/)
    assert.match(apiContent, /salaryInsertCount/)
    assert.match(apiContent, /salarySkipCount/)
    assert.match(apiContent, /salaryBlockedCount/)
    assert.match(apiContent, /auxInsertCount/)
    assert.match(apiContent, /auxSkipCount/)
    assert.match(apiContent, /errorCount/)
  })
})

describe('T13 CMS 成本导入页面', () => {
  it('页面上传四类 CMS 文件并提交导入', () => {
    assert.match(pageContent, /产品计划成本汇总/)
    assert.match(pageContent, /产品车间料工费汇总/)
    assert.match(pageContent, /产品科目成本汇总/)
    assert.match(pageContent, /科目设置导出/)
    assert.match(pageContent, /回收废料映射导入/)
    assert.match(pageContent, /\/base\/cms-cost\/material-scrap-refs/)
    assert.match(pageContent, /handleSubmit/)
    assert.match(pageContent, /importCmsCostExcel/)
  })

  it('没有选择任何文件时阻止提交，上传失败展示错误', () => {
    assert.match(pageContent, /canSubmitCmsCostImport\(files\)/)
    assert.match(pageContent, /missingCmsCostFileLabel\(files\)/)
    assert.match(pageContent, /submitError/)
    assert.match(pageContent, /ElMessage\.error/)
  })

  it('上传成功后展示统计，不再跳转独立导入批次页', () => {
    assert.match(pageContent, /科目设置行数/)
    assert.match(pageContent, /工资新增/)
    assert.match(pageContent, /工资跳过/)
    assert.match(pageContent, /工资阻断/)
    assert.match(pageContent, /辅料新增/)
    assert.match(pageContent, /辅料跳过/)
    assert.match(pageContent, /异常数量/)
    assert.doesNotMatch(pageContent, /goBatch/)
    assert.doesNotMatch(pageContent, /goDeriveLogs/)
    assert.doesNotMatch(pageContent, /\/base\/cms-cost\/batches/)
  })

  it('不在前端解析 Excel', () => {
    assert.doesNotMatch(pageContent, /from\s+['"]xlsx['"]/i)
    assert.doesNotMatch(pageContent, /from\s+['"]exceljs['"]/i)
    assert.doesNotMatch(pageContent, /FileReader/)
    assert.doesNotMatch(apiContent, /from\s+['"]xlsx['"]/i)
    assert.doesNotMatch(apiContent, /from\s+['"]exceljs['"]/i)
    assert.doesNotMatch(apiContent, /FileReader/)
  })
})
