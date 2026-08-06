import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const page = fs.readFileSync(path.join(ROOT, 'src/pages/MaterialQuoteShapePolicyPage.vue'), 'utf8')
const api = fs.readFileSync(path.join(ROOT, 'src/api/materialQuoteShapePolicies.js'), 'utf8')

describe('QEB-13 物料形态规则页面', () => {
  it('提供完整搜索条件、客户端分页和动态菜单页面组件', () => {
    assert.match(page, /报价 BOM 物料形态规则/)
    assert.match(page, /filters\.materialCode/)
    assert.match(page, /filters\.materialName/)
    assert.match(page, /filters\.materialModel/)
    assert.match(page, /filters\.materialSpec/)
    assert.match(page, /filters\.effectiveMonth/)
    assert.match(page, /BasePagination/)
    assert.match(page, /pagedRows/)
  })

  it('为财务提供简化的物料选择、处理方式和生效月份表单', () => {
    assert.match(page, /POLICY_MODE_FIXED/)
    assert.match(page, /POLICY_MODE_SUPPLIER_RATIO/)
    assert.match(page, /名称、型号、规格由 U9 料品主档自动带出/)
    assert.match(page, /仅对当前选中的特殊物料生效/)
    assert.match(page, /内部主供按制造件并保留下级/)
    assert.match(page, /外部主供时排除的直接子件/)
    assert.match(page, /只排除当前特殊物料下匹配的直接子件及其子树/)
    assert.match(page, /高级设置/)
    assert.match(page, /设置结束月份/)
    assert.match(page, /新规则默认从下月生效/)
    assert.match(page, /不会改变本月已经冻结的报价 BOM/)
    assert.doesNotMatch(page, /v-model="form\.conditionConfigJson"/)
    assert.doesNotMatch(page, /v-model="form\.actionConfigJson"/)
    assert.doesNotMatch(page, /internalSupplierCodes|internalTargetShape|externalTargetShape/)
  })

  it('新增、编辑、启停、删除和保存失败分支均接入真实API', () => {
    assert.match(page, /createMaterialQuoteShapePolicy/)
    assert.match(page, /updateMaterialQuoteShapePolicy/)
    assert.match(page, /toggleMaterialQuoteShapePolicy/)
    assert.match(page, /deleteMaterialQuoteShapePolicy/)
    assert.match(page, /catch \(error\)[\s\S]{0,160}物料形态规则保存失败/)
    assert.match(page, /deleted !== true/)
    assert.match(api, /\/api\/v1\/bom\/material-shape-policies/)
  })

  it('移除重复的比例模拟并保留全局操作日志入口', () => {
    assert.doesNotMatch(page, /供应商比例规则模拟|simulateSupplierRatioPolicy|模拟判断结果/)
    assert.match(page, /操作日志/)
    assert.match(api, /\/api\/v1\/system\/operation-log/)
    assert.match(api, /title: '料品形态规则'/)
  })
})
