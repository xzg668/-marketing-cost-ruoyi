import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  POLICY_MODE_FIXED,
  POLICY_MODE_SUPPLIER_RATIO,
  createEmptyPolicyForm,
  policyToForm,
  simulateSupplierRatioPolicy,
  switchPolicyMode,
  validatePolicyForm,
} from '../src/utils/materialQuoteShapePolicy.js'

const supplierForm = () => ({
  ...createEmptyPolicyForm(new Date(2026, 7, 4)),
  materialCode: '201850113',
  policyMode: POLICY_MODE_SUPPLIER_RATIO,
  fixedTargetShape: '',
  excludedDirectChildMaterialCodes: ['311034930'],
})

describe('QEB-13 规则表单校验与模式清理', () => {
  it('两种模式切换会清理另一模式的残留字段', () => {
    const fixed = switchPolicyMode(supplierForm(), POLICY_MODE_FIXED)
    assert.deepEqual(fixed.excludedDirectChildMaterialCodes, [])

    const ratio = switchPolicyMode(fixed, POLICY_MODE_SUPPLIER_RATIO)
    assert.equal(ratio.fixedTargetShape, '')
  })

  it('月份倒置和空排除子件在前端直接阻断', () => {
    const form = supplierForm()
    form.effectiveToMonth = '2026-08'
    form.excludedDirectChildMaterialCodes = ['']
    const errors = validatePolicyForm(form)
    assert.ok(errors.includes('生效结束月不能早于开始月'))
    assert.ok(errors.includes('排除直接子件料号不能为空'))
  })

  it('编辑历史规则时拒绝损坏的JSON配置', () => {
    assert.throws(
      () => policyToForm({
        policyMode: POLICY_MODE_SUPPLIER_RATIO,
        actionConfigJson: '{bad-json}',
      }),
      /不是有效 JSON/
    )
  })
})

describe('QEB-13 供应商比例规则模拟', () => {
  it('唯一最大且属于内部供应商时解析为制造件', () => {
    const result = simulateSupplierRatioPolicy(supplierForm(), [
      { supplierCode: 'SUP-210', supplierName: '商用制冷', materialShape: '制造件', supplyRatio: 60 },
      { supplierCode: 'EXT-001', supplierName: '外部供应商', materialShape: '采购件', supplyRatio: 40 },
    ])
    assert.equal(result.status, 'RESOLVED')
    assert.equal(result.supplierCode, 'SUP-210')
    assert.equal(result.targetShape, 'MANUFACTURE')
    assert.deepEqual(result.excludedDirectChildMaterialCodes, [])
  })

  it('唯一最大且不属于内部供应商时解析为委外并展示排除子件', () => {
    const result = simulateSupplierRatioPolicy(supplierForm(), [
      { supplierCode: 'SUP-210', materialShape: '制造件', supplyRatio: 40 },
      { supplierCode: 'EXT-001', materialShape: '采购件', supplyRatio: 60 },
    ])
    assert.equal(result.status, 'RESOLVED')
    assert.equal(result.targetShape, 'OUTSOURCE')
    assert.deepEqual(result.excludedDirectChildMaterialCodes, ['311034930'])
  })

  it('最大比例并列时阻断且不擅自选择供应商', () => {
    const result = simulateSupplierRatioPolicy(supplierForm(), [
      { supplierCode: 'SUP-210', materialShape: '制造件', supplyRatio: 50 },
      { supplierCode: 'EXT-001', materialShape: '采购件', supplyRatio: 50 },
    ])
    assert.equal(result.status, 'BLOCKED_TIED_MAX')
    assert.match(result.message, /最大供货比例并列/)
  })

  it('没有正数比例时阻断', () => {
    const result = simulateSupplierRatioPolicy(supplierForm(), [
      { supplierCode: 'SUP-210', materialShape: '制造件', supplyRatio: 0 },
      { supplierCode: 'EXT-001', materialShape: '采购件', supplyRatio: -1 },
    ])
    assert.equal(result.status, 'BLOCKED_NO_RATIO')
  })

  it('同一供应商重复出现时阻断且不累加比例', () => {
    const result = simulateSupplierRatioPolicy(supplierForm(), [
      { supplierCode: 'SUP-210', materialShape: '制造件', supplyRatio: 30 },
      { supplierCode: 'SUP-210', materialShape: '制造件', supplyRatio: 40 },
    ])
    assert.equal(result.status, 'BLOCKED_DUPLICATE_SUPPLIER')
  })
})
