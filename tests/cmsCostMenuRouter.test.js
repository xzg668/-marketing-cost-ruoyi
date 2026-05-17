import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGES_DIR = path.join(ROOT, 'src/pages')
const COMPONENTS_DIR = path.join(ROOT, 'src/components')
const LAYOUT_DIR = path.join(ROOT, 'src/layout/components')
const MENU_MIGRATION_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V65__cms_cost_menu_seed.sql'
)
const SUBJECT_SETTING_MIGRATION_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V66__cms_subject_setting_source.sql'
)
const MATERIAL_SCRAP_REF_MENU_MIGRATION_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V70__cms_material_scrap_ref_menu.sql'
)
const MATERIAL_SCRAP_REF_MENU_REPAIR_FILE = path.resolve(
  ROOT,
  '../marketing-cost-api/marketing-cost-biz/src/main/resources/db/V71__cms_material_scrap_ref_menu_repair.sql'
)

const migrationContent = [
  fs.readFileSync(MENU_MIGRATION_FILE, 'utf-8'),
  fs.readFileSync(SUBJECT_SETTING_MIGRATION_FILE, 'utf-8'),
  fs.readFileSync(MATERIAL_SCRAP_REF_MENU_MIGRATION_FILE, 'utf-8'),
  fs.readFileSync(MATERIAL_SCRAP_REF_MENU_REPAIR_FILE, 'utf-8'),
].join('\n')
const pageShellContent = fs.readFileSync(path.join(COMPONENTS_DIR, 'CmsCostPageShell.vue'), 'utf-8')
const subjectSettingPageContent = fs.readFileSync(path.join(PAGES_DIR, 'CmsSubjectSettingPage.vue'), 'utf-8')
const effectiveSourcePageContent = fs.readFileSync(path.join(PAGES_DIR, 'CmsCostEffectiveSourcePage.vue'), 'utf-8')
const sidebarContent = fs.readFileSync(path.join(LAYOUT_DIR, 'Sidebar.vue'), 'utf-8')

const cmsPages = [
  'CmsCostImportPage.vue',
  'CmsPlanCostRawPage.vue',
  'CmsWorkshopLaborRawPage.vue',
  'CmsProductSubjectCostRawPage.vue',
  'CmsSubjectSettingPage.vue',
  'CmsMaterialScrapRefPage.vue',
  'CmsCostEffectiveSourcePage.vue',
]

describe('T12 CMS 成本数据菜单和路由', () => {
  it('新增 CMS 成本数据页面组件', () => {
    assert.ok(fs.existsSync(path.join(COMPONENTS_DIR, 'CmsCostPageShell.vue')))
    cmsPages.forEach((file) => {
      assert.ok(fs.existsSync(path.join(PAGES_DIR, file)), `${file} should exist`)
    })
  })

  it('菜单挂在基础数据下并提供 CMS 用户入口和隐藏追溯路由', () => {
    assert.match(migrationContent, /40159,\s*'基础数据'/)
    assert.match(migrationContent, /40230,\s*'CMS 成本数据',\s*40159/)
    assert.match(migrationContent, /\/base\/cms-cost\/import/)
    assert.match(migrationContent, /\/base\/cms-cost\/plan-rows/)
    assert.match(migrationContent, /\/base\/cms-cost\/workshop-rows/)
    assert.match(migrationContent, /\/base\/cms-cost\/subject-rows/)
    assert.match(migrationContent, /\/base\/cms-cost\/subject-settings/)
    assert.match(migrationContent, /\/base\/cms-cost\/material-scrap-refs/)
    assert.match(migrationContent, /'CMS 回收废料映射'/)
    assert.match(migrationContent, /\/base\/cms-cost\/effective-sources/)
    assert.doesNotMatch(migrationContent, /\/base\/cms-cost\/aux-subject-config/)
    assert.doesNotMatch(migrationContent, /'CMS 辅料科目配置'/)
    assert.doesNotMatch(migrationContent, /\/base\/cms-cost\/batches/)
    assert.doesNotMatch(migrationContent, /'导入批次'/)
  })

  it('动态菜单组件指向 pages 组件，避免依赖静态路由', () => {
    assert.match(migrationContent, /'pages:CmsCostImportPage'/)
    assert.match(migrationContent, /'pages:CmsPlanCostRawPage'/)
    assert.match(migrationContent, /'pages:CmsWorkshopLaborRawPage'/)
    assert.match(migrationContent, /'pages:CmsProductSubjectCostRawPage'/)
    assert.match(migrationContent, /'pages:CmsSubjectSettingPage'/)
    assert.match(migrationContent, /'pages:CmsMaterialScrapRefPage'/)
    assert.match(migrationContent, /'pages:CmsCostEffectiveSourcePage'/)
    assert.doesNotMatch(migrationContent, /'pages:CmsAuxSubjectConfigPage'/)
    assert.doesNotMatch(migrationContent, /'pages:CmsCostBatchPage'/)
  })

  it('菜单权限对齐 T10/T11 后端权限点', () => {
    assert.match(migrationContent, /'cms:cost:import'/)
    assert.match(migrationContent, /'cms:cost:list'/)
    assert.match(migrationContent, /\(1,\s*40231\)/)
    assert.match(migrationContent, /\(10,\s*40231\)/)
    assert.match(migrationContent, /\(11,\s*40231\)/)
    assert.match(migrationContent, /\(1,\s*40237\)/)
    assert.match(migrationContent, /\(1,\s*40239\)/)
    assert.match(migrationContent, /\(1,\s*40420\)/)
    assert.match(migrationContent, /'cms:cost:effective:refresh'/)
    assert.match(migrationContent, /\(1,\s*40238\)/)
    assert.match(migrationContent, /\(10,\s*40237\)/)
    assert.match(migrationContent, /\(10,\s*40239\)/)
    assert.match(migrationContent, /\(10,\s*40420\)/)
    assert.match(migrationContent, /\(10,\s*40238\)/)
    assert.match(migrationContent, /\(11,\s*40237\)/)
    assert.match(migrationContent, /\(11,\s*40239\)/)
    assert.match(migrationContent, /\(11,\s*40420\)/)
    assert.match(migrationContent, /\(11,\s*40238\)/)
    assert.doesNotMatch(migrationContent, /\(\d+,\s*40236\)/)
    assert.match(migrationContent, /DELETE FROM sys_role_menu WHERE menu_id = 40236/)
    assert.match(migrationContent, /DELETE FROM sys_menu WHERE menu_id = 40236/)
    assert.match(migrationContent, /SELECT DISTINCT role_id,\s*40237[\s\S]*WHERE menu_id IN \(40230\)/)
    assert.match(migrationContent, /SELECT DISTINCT role_id,\s*40238[\s\S]*WHERE menu_id IN \(40230,\s*40237\)/)
  })

  it('不移动既有工资表和辅料管理入口', () => {
    assert.doesNotMatch(migrationContent, /工资表'\s*,\s*40230/)
    assert.doesNotMatch(migrationContent, /辅料管理'\s*,\s*40230/)
  })

  it('侧边栏隐藏原始明细叶子菜单，原始明细改由追溯页 tab 切换', () => {
    assert.match(sidebarContent, /CMS_RAW_DETAIL_MENU_IDS = new Set\(\[40233,\s*40234,\s*40235\]\)/)
    assert.match(pageShellContent, /traceNav: \{ type: Boolean, default: false \}/)
    assert.match(pageShellContent, /v-if="traceNav"/)
    assert.match(pageShellContent, /label: '计划成本'/)
    assert.match(pageShellContent, /label: '车间料工费'/)
    assert.match(pageShellContent, /label: '科目成本'/)
    assert.match(pageShellContent, /label: '科目设置'/)
    assert.match(pageShellContent, /label: '回收废料映射导入'/)
    assert.match(pageShellContent, /label: '生效来源'/)
    assert.doesNotMatch(subjectSettingPageContent, /trace-nav/)
    assert.match(effectiveSourcePageContent, /trace-nav/)
    assert.doesNotMatch(pageShellContent, /label: '导入'/)
    assert.doesNotMatch(pageShellContent, /label: '辅料科目配置'/)
  })
})
