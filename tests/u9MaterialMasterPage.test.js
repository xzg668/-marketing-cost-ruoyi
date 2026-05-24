import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_FILE = path.join(ROOT, 'src/api/u9MaterialMaster.js')
const PAGE_FILE = path.join(ROOT, 'src/pages/U9MaterialMasterPage.vue')

const apiContent = fs.readFileSync(API_FILE, 'utf-8')
const pageContent = fs.readFileSync(PAGE_FILE, 'utf-8')

describe('U9MM-08 U9 料品主档 API', () => {
  it('封装 U9 料品主档页面所需后端接口', () => {
    assert.match(apiContent, /\/api\/v1\/base\/u9\/material-master/)
    assert.match(apiContent, /fetchU9MaterialBatches/)
    assert.match(apiContent, /importU9MaterialExcel/)
    assert.match(apiContent, /fetchU9MaterialRaw/)
    assert.match(apiContent, /fetchU9MaterialTemplateMapping/)
    assert.match(apiContent, /\/template-mapping/)
    assert.doesNotMatch(apiContent, /compareU9Material/)
    assert.doesNotMatch(apiContent, /syncU9Material/)
  })

  it('提供 Excel 校验、FormData 和响应归一化', () => {
    assert.match(apiContent, /U9_MATERIAL_MAX_FILE_SIZE = 150 \* 1024 \* 1024/)
    assert.match(apiContent, /U9_MATERIAL_IMPORT_TIMEOUT = 10 \* 60 \* 1000/)
    assert.match(apiContent, /validateU9MaterialFile/)
    assert.match(apiContent, /仅支持 \.xlsx \/ \.xls 文件/)
    assert.match(apiContent, /toU9MaterialImportFormData/)
    assert.match(apiContent, /formData\.append\('file', file\)/)
    assert.match(apiContent, /timeout:\s*U9_MATERIAL_IMPORT_TIMEOUT/)
    assert.match(apiContent, /normalizeU9MaterialRawPage/)
    assert.match(apiContent, /normalizeU9MaterialImportResult/)
    assert.doesNotMatch(apiContent, /normalizeU9MaterialDiffReport/)
  })
})

describe('U9MM-08 U9 料品主档页面', () => {
  it('页面加载时拉取批次列表和 raw 分页数据', () => {
    assert.match(pageContent, /onMounted\(refreshAll\)/)
    assert.match(pageContent, /async function fetchBatches/)
    assert.match(pageContent, /async function fetchRows/)
    assert.match(pageContent, /fetchU9MaterialBatches/)
    assert.match(pageContent, /fetchU9MaterialRaw\(queryParams\(\)\)/)
    assert.match(pageContent, /BasePagination/)
    assert.match(pageContent, /pageSize = ref\(50\)/)
  })

  it('查询条件和表格字段覆盖任务要求', () => {
    ;[
      'label="料号"',
      'label="名称"',
      'label="规格"',
      'label="型号"',
      'label="图号"',
      'label="物料形态"',
      'label="主分类"',
      'label="成本要素"',
      'label="事业部"',
      'label="部门"',
      'label="批次"',
      'prop="materialCode" label="料号"',
      'prop="materialName" label="名称"',
      'prop="materialSpec" label="规格"',
      'prop="materialModel" label="型号"',
      'prop="drawingNo" label="图号"',
      'prop="shapeAttr" label="物料形态"',
      'prop="mainCategoryCode" label="主分类代码"',
      'prop="mainCategoryName" label="主分类名称"',
      'prop="costElement" label="成本要素"',
      'prop="productionDivision" label="事业部"',
      'prop="departmentName" label="部门"',
      'prop="importBatchId" label="批次"',
      '更新时间',
    ].forEach((text) => assert.match(pageContent, new RegExp(text)))
  })

  it('上传成功和失败路径都有明确反馈', () => {
    assert.match(pageContent, /handleUploadChange/)
    assert.match(pageContent, /validateU9MaterialFile/)
    assert.match(pageContent, /ElMessage\.warning\(validation\.message\)/)
    assert.match(pageContent, /submitImport/)
    assert.match(pageContent, /importU9MaterialExcel/)
    assert.match(pageContent, /normalizeU9MaterialImportResult/)
    assert.match(pageContent, /U9 料品主档导入完成/)
    assert.match(pageContent, /U9 料品主档导入失败/)
    assert.match(pageContent, /importResult\.errors/)
  })

  it('页面不再暴露差异报告和手工同步入口', () => {
    assert.doesNotMatch(pageContent, /差异报告/)
    assert.doesNotMatch(pageContent, /同步选中/)
    assert.doesNotMatch(pageContent, /openDiffReport/)
    assert.doesNotMatch(pageContent, /confirmSync/)
    assert.doesNotMatch(pageContent, /compareU9Material/)
    assert.doesNotMatch(pageContent, /syncU9Material/)
    assert.doesNotMatch(pageContent, /base:u9-material:compare/)
    assert.doesNotMatch(pageContent, /base:u9-material:sync/)
  })

  it('字段映射和按钮权限对齐页面保留能力', () => {
    assert.match(pageContent, /openMappingDrawer/)
    assert.match(pageContent, /fetchU9MaterialTemplateMapping/)
    assert.match(pageContent, /base:u9-material:list/)
    assert.match(pageContent, /base:u9-material:import/)
    assert.match(pageContent, /base:u9-material:export/)
  })
})
