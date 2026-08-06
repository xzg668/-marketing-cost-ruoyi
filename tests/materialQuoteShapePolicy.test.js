import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  POLICY_MODE_FIXED,
  POLICY_MODE_SUPPLIER_RATIO,
  MATERIAL_SHAPE_OPTIONS,
  buildPolicyQuery,
  buildPolicyRequest,
  createEmptyPolicyForm,
  nextMonthValue,
  normalizePolicyList,
  policyTargetSummary,
} from '../src/utils/materialQuoteShapePolicy.js'

describe('QEB-13 物料形态规则数据转换', () => {
  it('新规则默认下月生效，跨年时正确进入下一年', () => {
    assert.equal(nextMonthValue(new Date(2026, 7, 4)), '2026-09')
    assert.equal(nextMonthValue(new Date(2026, 11, 20)), '2027-01')
    assert.equal(createEmptyPolicyForm(new Date(2026, 7, 4)).effectiveFromMonth, '2026-09')
  })

  it('固定报价形态不再提供虚拟件，历史配置仍可辨识', () => {
    assert.deepEqual(
      MATERIAL_SHAPE_OPTIONS.map((item) => item.value),
      ['MANUFACTURE', 'PURCHASE', 'OUTSOURCE']
    )
    assert.equal(
      policyTargetSummary({ policyMode: POLICY_MODE_FIXED, fixedTargetShape: 'VIRTUAL' }),
      '虚拟件（历史配置）'
    )
  })

  it('查询参数支持料号、名称、型号、规格并保留停用状态0', () => {
    assert.deepEqual(
      buildPolicyQuery({
        materialOrgCode: ' COMMERCIAL ',
        materialCode: ' 201850113 ',
        materialName: ' 烧结基座 ',
        materialModel: ' M-01 ',
        materialSpec: ' S-01 ',
        policyMode: ' FIXED ',
        effectiveMonth: ' 2026-09 ',
        enabled: 0,
      }),
      {
        materialOrgCode: 'COMMERCIAL',
        materialCode: '201850113',
        materialName: '烧结基座',
        materialModel: 'M-01',
        materialSpec: 'S-01',
        policyMode: 'FIXED',
        enabled: 0,
        effectiveMonth: '2026-09',
      }
    )
  })

  it('兼容后端直接数组及常见分页响应', () => {
    const rows = [{ id: 1 }]
    assert.deepEqual(normalizePolicyList(rows), rows)
    assert.deepEqual(normalizePolicyList({ list: rows }), rows)
    assert.deepEqual(normalizePolicyList({ records: rows }), rows)
    assert.deepEqual(normalizePolicyList(null), [])
  })

  it('FIXED提交时清空供应商模式残留JSON', () => {
    const form = createEmptyPolicyForm(new Date(2026, 7, 4))
    Object.assign(form, {
      materialCode: ' 201850113 ',
      materialName: ' 烧结基座 ',
      policyMode: POLICY_MODE_FIXED,
      fixedTargetShape: 'PURCHASE',
      excludedDirectChildMaterialCodes: ['311034930'],
    })

    const request = buildPolicyRequest(form)

    assert.equal(request.materialCode, '201850113')
    assert.equal(request.fixedTargetShape, 'PURCHASE')
    assert.equal(request.conditionConfigJson, null)
    assert.equal(request.actionConfigJson, null)
  })

  it('SUPPLIER_RATIO提交时不重复保存供应商名单，只保留排除子件', () => {
    const form = createEmptyPolicyForm(new Date(2026, 7, 4))
    Object.assign(form, {
      materialCode: '201850113',
      policyMode: POLICY_MODE_SUPPLIER_RATIO,
      fixedTargetShape: 'PURCHASE',
      excludedDirectChildMaterialCodes: ['311034930', ' 311034930 '],
    })

    const request = buildPolicyRequest(form)

    assert.equal(request.fixedTargetShape, null)
    assert.equal(request.conditionConfigJson, null)
    assert.deepEqual(JSON.parse(request.actionConfigJson), {
      excludedDirectChildMaterialCodes: ['311034930'],
    })
  })
})
