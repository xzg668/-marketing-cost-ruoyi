import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTechnicalDataProfile } from '../src/utils/technicalDataWorkbench.js'

test('all four optional inputs enforce the same decimal bounds independently of old switches', () => {
  for (const hasAdditionalFees of [true, false, null, undefined]) {
    for (const field of ['unitMouldFee', 'unitCertificationFee', 'unitDepreciationFee', 'unitToolingFee']) {
      const profile = { productProperty: '非标品', expectedVersion: 0, hasAdditionalFees }
      for (const value of [null, undefined, '', ' ', '/', '0', '0.000000', '1.234567', '999999999999.999999']) {
        assert.equal(validateTechnicalDataProfile({ ...profile, [field]: value }), '', `${field}:${value}`)
      }
      for (const value of ['-1', '+1', '1e3', 'NaN', 'Infinity', '1,000', '0.0000000', '0000000000000']) {
        assert.notEqual(validateTechnicalDataProfile({ ...profile, [field]: value }), '', `${field}:${value}`)
      }
    }
  }
})
