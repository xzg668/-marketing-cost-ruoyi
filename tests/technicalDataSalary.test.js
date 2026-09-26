import test from 'node:test'
import assert from 'node:assert/strict'
import { salaryReferencePayload, salaryUploadPayload, salaryTotal } from '../src/utils/technicalDataSalary.js'

const source = () => ({ materialNo: 'REF-A', fingerprint: 'fingerprint-a',
  direct: { amountYuan: '4.050877', sourcePeriod: '2026-11' },
  indirect: { amountYuan: '0.099600', sourcePeriod: '2026-01' }, issues: [] })

test('工资参考一次选择两项，仅提交身份，不由客户端改写金额和来源期间', () => {
  assert.deepEqual(salaryReferencePayload(source(), 7), { entryMode: 'REFERENCE', expectedVersion: 7,
    referenceMaterialNo: 'REF-A', referenceFingerprint: 'fingerprint-a' })
  assert.equal(salaryTotal('4.050877', '0.099600'), '4.150477')
  assert.equal(salaryTotal('3.998735', '0.099600'), '4.098335')
})
test('工资展示区分缺失和有效零金额，十进制求和不丢精度', () => {
  assert.equal(salaryTotal(null, '1'), '—')
  assert.equal(salaryTotal('0', '0'), '0.000000')
  assert.equal(salaryTotal('0.1', '0.2'), '0.300000')
  assert.equal(salaryTotal('999999999999.999999', '0.000001'), '1000000000000.000000')
  assert.equal(salaryTotal('0.00000001', '0.00000002'), '0.00000003')
})
test('参考产品缺一项或来源异常不能保存，单项免补规则仅用于本产品', () => {
  for (const value of [null, { ...source(), direct: null }, { ...source(), indirect: null }, { ...source(), issues: ['来源异常'] }]) {
    assert.throws(() => salaryReferencePayload(value, 1), /请选择同时具有/)
  }
})
test('上传的元金额不再除以100，仅提交文件摘要和辅助工资来源', () => {
  const upload = { fileSha256: 'file-a', amountFen: '52.6034', amountYuan: '0.52603400', items: [{ row: 3 }], issues: [] }
  const indirect = { ...source(), direct: null }
  assert.deepEqual(salaryUploadPayload(upload, indirect, 9), { entryMode: 'UPLOAD', expectedVersion: 9,
    fileSha256: 'file-a', referenceMaterialNo: 'REF-A', referenceFingerprint: 'fingerprint-a' })
  assert.equal(salaryTotal(upload.amountYuan, indirect.indirect.amountYuan), '0.625634')
  assert.throws(() => salaryUploadPayload({ ...upload, issues: ['公式错误'] }, indirect, 9), /校验通过/)
  assert.throws(() => salaryUploadPayload(upload, source(), 9), /辅助人员/)
  assert.throws(() => salaryUploadPayload(upload, null, 9), /辅助人员/)
})
